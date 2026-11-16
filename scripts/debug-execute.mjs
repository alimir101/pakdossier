/**
 * Last untried lever: turnstile.execute() forces the challenge and fires the
 * callback itself, instead of waiting for a passive managed challenge.
 */
import puppeteer from 'puppeteer-core';

const SITE = 'https://pakistandataba.se/databases/sim.php';
const API = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const v = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 200000, defaultViewport: { width: 1280, height: 900 } });
const page = await browser.newPage();

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
await page.evaluate(() => {
  window.__ev = [];
  window.__log = [];
  window.addEventListener('message', (e) => {
    try { const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; if (d?.event) window.__ev.push(d.event); } catch {}
  });
});
if ((await page.evaluate(() => typeof window.turnstile).catch(() => 'x')) !== 'object') {
  await page.addScriptTag({ url: API }).catch(() => {});
}

const sitekey = await page.evaluate(() => document.querySelector('[data-sitekey]')?.getAttribute('data-sitekey') ?? null);
const widgetId = await page.evaluate((sk) => {
  const el = document.querySelector('.cf-turnstile, [data-sitekey]');
  if (!el || !window.turnstile) return null;
  try {
    window.__cb = false;
    return window.turnstile.render(el, {
      sitekey: sk,
      callback: () => { window.__cb = true; },
      'error-callback': (e) => window.__log.push('errorcb:' + e),
      'timeout-callback': () => window.__log.push('timeoutcb'),
    });
  } catch (e) {
    window.__log.push('renderErr:' + e.message);
    return null;
  }
}, sitekey);
console.log('widgetId:', widgetId);

const token = () => page.evaluate(() => document.querySelector('input[name="cf-turnstile-response"]')?.value ?? '').catch(() => '');

const t0 = Date.now();
let executed = false;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const tok = await token();
  const ev = await page.evaluate(() => window.__ev ?? []);
  const logs = await page.evaluate(() => window.__log ?? []);

  if (tok.length > 20) {
    console.log(`\n*** TOKEN after ${Math.round((Date.now() - t0) / 1000)}s (executed=${executed})`);
    const out = await page.evaluate(async (url, t) => {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `search_query=03331234567&cf-turnstile-response=${encodeURIComponent(t)}` });
      const x = (await r.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      return /TOO MANY/i.test(x) ? 'LIMITED' : /TOTAL HITS/i.test(x) ? '*** REPORT: ' + (x.match(/TOTAL HITS\s*\d+/i)?.[0] ?? '') : 'other';
    }, SITE, tok);
    console.log('POST ->', out);
    break;
  }

  // after the first interactive phase shows up, force an execute
  if (!executed && (ev.includes('interactiveBegin') || Date.now() - t0 > 45000)) {
    executed = true;
    const res = await page.evaluate((id) => {
      try { window.turnstile.execute(id); return 'executed'; } catch (e) { return 'execErr:' + e.message; }
    }, widgetId).catch((e) => 'evalErr:' + e.message);
    console.log(`called turnstile.execute() at t+${Math.round((Date.now() - t0) / 1000)}s -> ${res}`);
  }

  if (i % 5 === 0) {
    const phase = ev.filter((e) => /interactive|overrun|succ|fail/.test(e)).slice(-3).join(',');
    console.log(`t+${Math.round((Date.now() - t0) / 1000)}s token=0 executed=${executed} ${phase} ${logs.join(',')}`);
  }
}

console.log('events:', (await page.evaluate(() => (window.__ev ?? []).slice(-8))).join(' | '));
console.log('logs:', (await page.evaluate(() => window.__log ?? [])).join(','));
await page.close();
browser.disconnect();
