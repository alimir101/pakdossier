/** Mirror the sidecar's exact flow and dump why the token never appears. */
import puppeteer from 'puppeteer-core';

const SITE = 'https://pakistandataba.se/databases/sim.php';
const v = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 150000 });
const page = await browser.newPage();
const net = [];
page.on('response', (r) => { if (/turnstile|challenge/i.test(r.url())) net.push(`${r.status()} ${r.url().slice(0, 80)}`); });
page.on('requestfailed', (r) => net.push(`FAIL ${r.url().slice(0, 80)} :: ${r.failure()?.errorText}`));

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => console.log('goto:', e.message));

const snap = async (label) => {
  const s = await page.evaluate(() => ({
    turnstile: typeof window.turnstile,
    widgetDivs: document.querySelectorAll('.cf-turnstile').length,
    hidden: document.querySelector('input[name="cf-turnstile-response"]')?.value?.length ?? -1,
    iframes: [...document.querySelectorAll('iframe')].map((f) => (f.src || '(no src)').slice(0, 90)),
    widgetError: document.querySelector('.cf-turnstile')?.getAttribute('data-error') ?? null,
  }));
  console.log(label, JSON.stringify(s));
};

for (const t of [3000, 8000, 15000, 25000, 40000]) {
  await new Promise((r) => setTimeout(r, t === 3000 ? 3000 : t - (t === 8000 ? 3000 : t === 15000 ? 8000 : t === 25000 ? 15000 : 25000)));
  await snap(`t+${t}ms`);
}
console.log('network:', net.slice(0, 8).join(' | ') || '(none)');
await page.close();
browser.disconnect();
