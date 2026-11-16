/** Look inside the widget's shadow root + capture its network to find the stall. */
import puppeteer from 'puppeteer-core';

const SITE = 'https://pakistandataba.se/databases/sim.php';
const v = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 180000 });
const page = await browser.newPage();

const seen = [];
page.on('response', async (r) => {
  const u = r.url();
  if (/turnstile|challenge-platform|cf-chl/i.test(u)) seen.push(`${r.status()} ${u.slice(0, 110)}`);
});
page.on('requestfailed', (r) => {
  if (/turnstile|challenge/i.test(r.url())) seen.push(`FAIL ${r.url().slice(0, 110)} :: ${r.failure()?.errorText}`);
});

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => console.log('goto:', e.message));
await page.waitForFunction(() => typeof window.turnstile === 'object', { timeout: 20000, polling: 250 }).catch(() => {});
await page.evaluate(() => {
  const el = document.querySelector('.cf-turnstile, [data-sitekey]');
  try { window.turnstile.render(el); } catch (e) { console.log('render threw', String(e).slice(0, 80)); }
});

for (let i = 1; i <= 6; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const s = await page.evaluate(() => {
    const el = document.querySelector('.cf-turnstile, [data-sitekey]');
    const sr = el?.shadowRoot ?? null;
    const iframes = sr ? [...sr.querySelectorAll('iframe')].map((f) => (f.src || '(nosrc)').slice(0, 100)) : [];
    return {
      shadow: !!sr,
      shadowHTML: sr ? sr.innerHTML.replace(/\s+/g, ' ').slice(0, 220) : null,
      iframes,
      tok: document.querySelector('input[name="cf-turnstile-response"]')?.value?.length ?? 0,
    };
  });
  console.log(`t+${i * 5}s`, JSON.stringify(s));
  if (s.tok > 20) break;
}
console.log('\nnetwork seen:');
for (const l of seen.slice(0, 12)) console.log('  ', l);

await page.close();
browser.disconnect();
