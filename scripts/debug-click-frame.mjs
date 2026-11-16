/**
 * The interactive phase starts but never gets a successful click — our clicks were
 * aimed at the container (which measured 0px high). Click the widget IFRAME's real
 * box instead, and click inside the frame as a fallback.
 */
import puppeteer from 'puppeteer-core';

const SITE = 'https://pakistandataba.se/databases/sim.php';
const API = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const DBG = process.env.OBSCURA_HTTP ?? 'http://127.0.0.1:9222';
const v = await (await fetch(`${DBG}/json/version`)).json();
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 180000, defaultViewport: { width: 1280, height: 900 } });
const page = await browser.newPage();
if (process.env.UA) await page.setUserAgent(process.env.UA).catch(() => {});

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

const token = () => page.evaluate(() => document.querySelector('input[name="cf-turnstile-response"]')?.value ?? '').catch(() => '');

const t0 = Date.now();
let clicks = 0;
let printedBox = false;

for (let i = 0; i < 90; i++) {
  await new Promise((r) => setTimeout(r, 1500));
  const tok = await token();
  const ev = await page.evaluate(() => window.__ev ?? []);

  if (tok.length > 20) {
    console.log(`\n*** TOKEN after ${Math.round((Date.now() - t0) / 1000)}s (clicks=${clicks})`);
    const out = await page.evaluate(async (url, t) => {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `search_query=03331234567&cf-turnstile-response=${encodeURIComponent(t)}` });
      const x = (await r.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      return /TOO MANY/i.test(x) ? 'LIMITED' : /TOTAL HITS/i.test(x) ? '*** REPORT: ' + (x.match(/TOTAL HITS\s*\d+/i)?.[0] ?? '') : 'other';
    }, SITE, tok);
    console.log('POST ->', out);
    break;
  }

  if (i % 4 === 0) {
    const phase = ev.filter((e) => /interactive|overrun|success|fail/.test(e)).slice(-4).join(',');
    console.log(`t+${Math.round((Date.now() - t0) / 1000)}s token=0 clicks=${clicks} ${phase}`);
  }

  // from 4s on, click the frame's real box (and inside the frame)
  if (Date.now() - t0 > 4000) {
    const frame = page.frames().find((f) => /turnstile|challenge-platform/i.test(f.url()));
    if (frame) {
      let box = null;
      try {
        const el = await frame.frameElement();
        box = await el.boundingBox();
      } catch {}
      if (box && !printedBox) {
        printedBox = true;
        console.log(`   iframe box: x=${Math.round(box.x)} y=${Math.round(box.y)} w=${Math.round(box.width)} h=${Math.round(box.height)}`);
      }
      if (box) {
        const x = box.x + Math.min(28, box.width / 3);
        const y = box.y + box.height / 2;
        try {
          await page.mouse.move(x - 60, y - 25);
          await page.mouse.move(x, y, { steps: 6 });
          await page.mouse.down();
          await new Promise((r) => setTimeout(r, 90));
          await page.mouse.up();
          clicks++;
        } catch {}
      } else {
        try {
          await frame.click('body');
          clicks++;
        } catch {}
      }
    }
  }
}

console.log('event tail:', (await page.evaluate(() => (window.__ev ?? []).slice(-10))).join(' | '));
await page.close();
browser.disconnect();
