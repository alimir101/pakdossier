/** Capture the widget's postMessage to the parent — it carries the real error code. */
import puppeteer from 'puppeteer-core';

const SITE = 'https://pakistandataba.se/databases/sim.php';
const API = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const DBG = process.env.OBSCURA_HTTP ?? 'http://127.0.0.1:9222';
const v = await (await fetch(`${DBG}/json/version`)).json();
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 120000 });
const page = await browser.newPage();

page.on('console', (m) => console.log('  console:', m.type(), m.text().slice(0, 160)));
page.on('pageerror', (e) => console.log('  pageerror:', String(e).slice(0, 160)));

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
await page.evaluate(() => {
  window.__msgs = [];
  window.addEventListener('message', (e) => {
    try { window.__msgs.push(typeof e.data === 'string' ? e.data.slice(0, 200) : JSON.stringify(e.data).slice(0, 200)); } catch {}
  });
});
if ((await page.evaluate(() => typeof window.turnstile).catch(() => 'x')) !== 'object') {
  await page.addScriptTag({ url: API }).catch(() => {});
}
await page.evaluate(() => {
  const el = document.querySelector('.cf-turnstile, [data-sitekey]');
  if (el && window.turnstile) { try { window.turnstile.render(el); } catch {} }
}).catch(() => {});

for (let i = 1; i <= 5; i++) {
  await new Promise((r) => setTimeout(r, 4000));
  const msgs = await page.evaluate(() => window.__msgs ?? []);
  const tok = await page.evaluate(() => document.querySelector('input[name="cf-turnstile-response"]')?.value?.length ?? 0);
  console.log(`t+${i * 4}s token=${tok} messages=${msgs.length}`);
  if (msgs.length) console.log('   ' + msgs.join('\n   '));
  if (tok > 20) break;
}

await page.close();
browser.disconnect();
