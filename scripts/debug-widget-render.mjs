/** Precise widget diagnosis: does render() succeed, and does a token ever appear? */
import puppeteer from 'puppeteer-core';

const SITE = process.env.SITE ?? 'https://pakistandataba.se/databases/sim.php';
const v = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 180000 });
const page = await browser.newPage();
page.on('console', (m) => console.log('  console:', m.type(), m.text().slice(0, 140)));
page.on('pageerror', (e) => console.log('  pageerror:', String(e).slice(0, 160)));

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => console.log('goto:', e.message));
await page.waitForFunction(() => typeof window.turnstile === 'object', { timeout: 20000, polling: 250 }).catch(() => console.log('turnstile API never appeared'));

const before = await page.evaluate(() => {
  const el = document.querySelector('.cf-turnstile, [data-sitekey]');
  const cs = el ? getComputedStyle(el) : null;
  return {
    found: !!el,
    sitekey: el?.getAttribute('data-sitekey') ?? null,
    display: cs?.display ?? null,
    visibility: cs?.visibility ?? null,
    w: el?.getBoundingClientRect().width ?? -1,
    h: el?.getBoundingClientRect().height ?? -1,
    docVisibility: document.visibilityState,
    hasRender: typeof window.turnstile?.render,
  };
});
console.log('before render:', JSON.stringify(before));

const rendered = await page.evaluate(() => {
  const el = document.querySelector('.cf-turnstile, [data-sitekey]');
  if (!el || !window.turnstile) return 'no-el';
  try {
    const id = window.turnstile.render(el, {
      callback: () => { window.__pdTok = true; },
      'error-callback': (e) => { window.__pdErr = String(e); },
    });
    return 'render-id:' + id;
  } catch (e) {
    return 'render-threw:' + String(e).slice(0, 120);
  }
});
console.log('render():', rendered);

for (let i = 1; i <= 8; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const s = await page.evaluate(() => ({
    tok: document.querySelector('input[name="cf-turnstile-response"]')?.value?.length ?? 0,
    cb: !!window.__pdTok,
    err: window.__pdErr ?? null,
    iframes: document.querySelectorAll('iframe').length,
  }));
  console.log(`  t+${i * 5}s`, JSON.stringify(s));
  if (s.tok > 20) break;
}

await page.close();
browser.disconnect();
