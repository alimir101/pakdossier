/**
 * The widget overruns its non-interactive attempt and switches to INTERACTIVE,
 * so it needs a click. Click the widget area repeatedly and see if a token lands.
 */
import puppeteer from 'puppeteer-core';

const SITE = 'https://pakistandataba.se/databases/sim.php';
const API = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const DBG = process.env.OBSCURA_HTTP ?? 'http://127.0.0.1:9222';
const v = await (await fetch(`${DBG}/json/version`)).json();
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 180000, defaultViewport: { width: 1280, height: 900 } });
const page = await browser.newPage();

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
await page.evaluate(() => {
  window.__ev = [];
  window.addEventListener('message', (e) => {
    try { const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; if (d?.event) window.__ev.push(d.event); } catch {}
  });
});
if ((await page.evaluate(() => typeof window.turnstile).catch(() => 'x')) !== 'object') {
  await page.addScriptTag({ url: API }).catch(() => {});
}
await page.evaluate(() => {
  const el = document.querySelector('.cf-turnstile, [data-sitekey]');
  if (el && window.turnstile) { try { window.turnstile.render(el); } catch {} }
}).catch(() => {});

const token = () => page.evaluate(() => document.querySelector('input[name="cf-turnstile-response"]')?.value ?? '');

const t0 = Date.now();
let clicked = 0;
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  const tok = await token();
  const ev = await page.evaluate(() => window.__ev ?? []);
  const phase = ev.filter((e) => /overrun|interactive|success|error|fail/.test(e)).join(',');
  if (tok.length > 20) {
    console.log(`\n*** TOKEN after ${Math.round((Date.now() - t0) / 1000)}s (clicks=${clicked}) len=${tok.length}`);
    const out = await page.evaluate(async (url, t) => {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `search_query=03331234567&cf-turnstile-response=${encodeURIComponent(t)}` });
      const x = (await r.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      return /TOO MANY/i.test(x) ? 'LIMITED' : /TOTAL HITS/i.test(x) ? '*** REPORT: ' + (x.match(/TOTAL HITS\s*\d+/i)?.[0] ?? '') : 'other: ' + x.slice(0, 60);
    }, SITE, tok);
    console.log('POST ->', out);
    break;
  }
  console.log(`t+${Math.round((Date.now() - t0) / 1000)}s token=0 events=${ev.length} ${phase}`);

  // from 12s onward, click the widget area (interactive phase starts after overrun)
  if (Date.now() - t0 > 12000 && i % 2 === 0) {
    const box = await page.evaluate(() => {
      const el = document.querySelector('.cf-turnstile, [data-sitekey]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    if (box) {
      const spots = [
        [box.x + 25, box.y + (box.h > 4 ? box.h / 2 : 22)],
        [box.x + 30, box.y + 18],
        [box.x + box.w / 2, box.y + (box.h > 4 ? box.h / 2 : 22)],
      ];
      for (const [x, y] of spots) {
        await page.mouse.click(x, y).catch(() => {});
        clicked++;
      }
    }
  }
}

console.log('event tail:', (await page.evaluate(() => (window.__ev ?? []).slice(-8))).join(' | '));
await page.close();
browser.disconnect();
