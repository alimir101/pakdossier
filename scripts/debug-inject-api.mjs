/** Fallback: if the page's own turnstile <script> never fires, inject it ourselves. */
import puppeteer from 'puppeteer-core';

const SITE = 'https://pakistandataba.se/databases/sim.php';
const API = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const v = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 150000 });
const page = await browser.newPage();

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => console.log('goto:', e.message.slice(0, 70)));

const hasApi = await page.evaluate(() => typeof window.turnstile).catch(() => 'err');
console.log('turnstile before inject:', hasApi);

if (hasApi !== 'object' && hasApi !== 'function') {
  const t0 = Date.now();
  try {
    await page.addScriptTag({ url: API });
    console.log(`injected api.js in ${Date.now() - t0}ms -> typeof window.turnstile = ${await page.evaluate(() => typeof window.turnstile)}`);
  } catch (e) {
    console.log('inject ERR', e.message.slice(0, 120));
  }
}

// render explicitly, then wait
const sitekey = await page.evaluate(() => document.querySelector('[data-sitekey]')?.getAttribute('data-sitekey') ?? null);
console.log('sitekey:', sitekey);
await page
  .evaluate(() => {
    const el = document.querySelector('.cf-turnstile, [data-sitekey]');
    if (el && window.turnstile && !el.getAttribute('data-pd')) {
      try { window.turnstile.render(el); el.setAttribute('data-pd', '1'); } catch (e) {}
    }
  })
  .catch(() => {});

for (let i = 1; i <= 10; i++) {
  await new Promise((r) => setTimeout(r, 4000));
  const s = await page.evaluate(() => ({
    tok: document.querySelector('input[name="cf-turnstile-response"]')?.value?.length ?? 0,
    frames: window.frames.length,
  }));
  console.log(`t+${i * 4}s`, JSON.stringify(s));
  if (s.tok > 20) {
    const tok = await page.$eval('input[name="cf-turnstile-response"]', (el) => el.value);
    console.log(`*** TOKEN len=${tok.length}`);
    // and immediately prove it works
    const out = await page.evaluate(async (url, t) => {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `search_query=03331234567&cf-turnstile-response=${encodeURIComponent(t)}` });
      const x = (await r.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      return /TOO MANY/i.test(x) ? 'LIMITED' : /TOTAL HITS/i.test(x) ? 'REPORT ' + (x.match(/TOTAL HITS\s*\d+/i)?.[0] ?? '') : 'other';
    }, SITE, tok);
    console.log('POST ->', out);
    break;
  }
}

await page.close();
browser.disconnect();
