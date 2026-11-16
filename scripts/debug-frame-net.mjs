/** Did the browser ever request the real (long) widget frame URL, and what came back? */
import puppeteer from 'puppeteer-core';

const SITE = 'https://pakistandataba.se/databases/sim.php';
const API = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const DBG = process.env.OBSCURA_HTTP ?? 'http://127.0.0.1:9222';
const v = await (await fetch(`${DBG}/json/version`)).json();
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 120000 });
const page = await browser.newPage();

const seen = [];
page.on('response', (r) => { if (/challenges\.cloudflare\.com/i.test(r.url())) seen.push(`${r.status()} ${r.url().slice(0, 130)}`); });
page.on('requestfailed', (r) => { if (/challenges\.cloudflare\.com/i.test(r.url())) seen.push(`FAIL ${r.url().slice(0, 120)} :: ${r.failure()?.errorText}`); });

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
if ((await page.evaluate(() => typeof window.turnstile).catch(() => 'x')) !== 'object') {
  await page.addScriptTag({ url: API }).catch(() => {});
}
await page.evaluate(() => {
  const el = document.querySelector('.cf-turnstile, [data-sitekey]');
  if (el && window.turnstile) { try { window.turnstile.render(el); } catch {} }
}).catch(() => {});

await new Promise((r) => setTimeout(r, 20000));

console.log('iframe src in DOM:', await page.evaluate(() => [...document.querySelectorAll('iframe')].map((f) => f.src).join(' | ') || '(none)'));
console.log('child frames:', page.frames().map((f) => f.url().slice(0, 120)).join('\n   '));
console.log('\ncloudflare responses seen:');
for (const l of seen.slice(0, 15)) console.log('  ', l);

await page.close();
browser.disconnect();
