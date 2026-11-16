/** The widget is alive and heart-beating. Does it eventually succeed if we just wait? */
import puppeteer from 'puppeteer-core';

const SITE = 'https://pakistandataba.se/databases/sim.php';
const API = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const DBG = process.env.OBSCURA_HTTP ?? 'http://127.0.0.1:9222';
const v = await (await fetch(`${DBG}/json/version`)).json();
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 180000 });
const page = await browser.newPage();

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
await page.evaluate(() => {
  window.__ev = [];
  window.addEventListener('message', (e) => {
    try {
      const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (d?.event) window.__ev.push(`${d.event}${d.seq ? '#' + d.seq : ''}${d.code ? ' code=' + d.code : ''}${d.mode ? ' mode=' + d.mode : ''}`);
    } catch {}
  });
});
if ((await page.evaluate(() => typeof window.turnstile).catch(() => 'x')) !== 'object') {
  await page.addScriptTag({ url: API }).catch(() => {});
}
await page.evaluate(() => {
  const el = document.querySelector('.cf-turnstile, [data-sitekey]');
  if (el && window.turnstile) { try { window.turnstile.render(el); } catch {} }
}).catch(() => {});

const t0 = Date.now();
let lastCount = 0;
for (let i = 0; i < 18; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const tok = await page.evaluate(() => document.querySelector('input[name="cf-turnstile-response"]')?.value ?? '');
  const ev = await page.evaluate(() => window.__ev ?? []);
  const fresh = ev.slice(lastCount);
  lastCount = ev.length;
  const notable = fresh.filter((e) => !/^food/.test(e));
  console.log(`t+${Math.round((Date.now() - t0) / 1000)}s token=${tok.length} events=${ev.length}${notable.length ? ' NEW: ' + notable.join(', ') : ''}`);
  if (tok.length > 20) {
    console.log(`\n*** TOKEN after ${Math.round((Date.now() - t0) / 1000)}s: ${tok.slice(0, 30)}…`);
    const out = await page.evaluate(async (url, t) => {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `search_query=03331234567&cf-turnstile-response=${encodeURIComponent(t)}` });
      const x = (await r.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      return /TOO MANY/i.test(x) ? 'LIMITED' : /TOTAL HITS/i.test(x) ? '*** REPORT: ' + (x.match(/TOTAL HITS\s*\d+/i)?.[0] ?? '') : 'other';
    }, SITE, tok);
    console.log('POST ->', out);
    break;
  }
}

console.log('\nevent tail:', (await page.evaluate(() => (window.__ev ?? []).slice(-6))).join(' | '));
await page.close();
browser.disconnect();
