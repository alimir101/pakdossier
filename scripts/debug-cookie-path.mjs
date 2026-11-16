/** Last cheap idea: does the site accept a POST with Cloudflare cookies but no token? */
import puppeteer from 'puppeteer-core';

const SITE = 'https://pakistandataba.se/databases/sim.php';
const API = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const v = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 120000 });
const page = await browser.newPage();
page.on('console', (m) => console.log('  console:', m.text().slice(0, 120)));

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
if ((await page.evaluate(() => typeof window.turnstile).catch(() => 'err')) !== 'object') {
  await page.addScriptTag({ url: API }).catch(() => {});
}
await page.evaluate(() => {
  const el = document.querySelector('.cf-turnstile, [data-sitekey]');
  if (el && window.turnstile) { try { window.turnstile.render(el); } catch {} }
}).catch(() => {});
await new Promise((r) => setTimeout(r, 12000));

const cookies = await page.cookies();
console.log('cookies:', cookies.map((c) => c.name).join(' ') || '(none)');
const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

async function tryPost(label, token) {
  const out = await page
    .evaluate(
      async (url, ck, t) => {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', ...(ck ? { cookie: ck } : {}) },
          body: `search_query=03331234567&cf-turnstile-response=${encodeURIComponent(t)}`,
        });
        const x = (await r.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        if (/TOO MANY/i.test(x)) return 'LIMITED';
        if (/TOTAL HITS/i.test(x)) return '*** REPORT: ' + (x.match(/TOTAL HITS\s*\d+/i)?.[0] ?? '');
        if (/CAPTCHA REQUIRED/i.test(x)) return 'CAPTCHA-REQUIRED';
        if (/VERIFICATION FAILED/i.test(x)) return 'VERIFICATION-FAILED';
        return 'other: ' + x.slice(0, 80);
      },
      SITE,
      cookieHeader,
      token,
    )
    .catch((e) => 'ERR ' + e.message.slice(0, 60));
  console.log(`${label} -> ${out}`);
}

await tryPost('cookie + empty token', '');
await tryPost('cookie + garbage token', 'x'.repeat(30));
await tryPost('no cookie + garbage token', 'x'.repeat(30));

await page.close();
browser.disconnect();
