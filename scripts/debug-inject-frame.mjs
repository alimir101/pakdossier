/**
 * ROOT CAUSE: the widget's child frame gets an empty document — obscura drops the
 * iframe's own subresources too. We already proved injecting into the main frame
 * works, so inject the frame's scripts into the frame as well.
 */
import puppeteer from 'puppeteer-core';

const SITE = 'https://pakistandataba.se/databases/sim.php';
const API = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const v = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 120000 });
const page = await browser.newPage();

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
if ((await page.evaluate(() => typeof window.turnstile).catch(() => 'err')) !== 'object') {
  await page.addScriptTag({ url: API }).catch(() => {});
}
await page.evaluate(() => {
  const el = document.querySelector('.cf-turnstile, [data-sitekey]');
  if (el && window.turnstile) { try { window.turnstile.render(el); } catch {} }
}).catch(() => {});

// wait for the widget frame
let frame = null;
for (let i = 0; i < 10 && !frame; i++) {
  await new Promise((r) => setTimeout(r, 1500));
  frame = page.frames().find((f) => /challenge-platform|turnstile\/v0/i.test(f.url())) ?? null;
}
if (!frame) {
  console.log('widget frame nahi mila');
  process.exit(0);
}
console.log('widget frame:', frame.url());

// what does that frame's HTML ask for?
const html = await (await fetch(frame.url())).text();
console.log('frame html len:', html.length);
const scripts = [...html.matchAll(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi)].map((m) => new URL(m[1], frame.url()).href);
const inline = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).filter((s) => s.trim().length > 20);
console.log('external scripts:', scripts.length, scripts.map((s) => s.slice(0, 70)));
console.log('inline scripts:', inline.length, inline.map((s) => s.length));

for (const url of scripts) {
  await frame.addScriptTag({ url }).then(() => console.log('  injected', url.slice(0, 70))).catch((e) => console.log('  inject fail', url.slice(0, 50), e.message.slice(0, 40)));
}
for (const content of inline) {
  await frame.addScriptTag({ content }).catch(() => {});
}
if (inline.length) console.log('  injected inline x' + inline.length);

for (let i = 1; i <= 10; i++) {
  await new Promise((r) => setTimeout(r, 4000));
  const s = await page.evaluate(() => ({ tok: document.querySelector('input[name="cf-turnstile-response"]')?.value?.length ?? 0 }));
  let flen = -1;
  try { flen = await frame.evaluate(() => document.body?.innerHTML.length ?? -1); } catch { flen = -2; }
  console.log(`t+${i * 4}s token=${s.tok} frameBodyLen=${flen}`);
  if (s.tok > 20) {
    const tok = await page.$eval('input[name="cf-turnstile-response"]', (el) => el.value);
    const out = await page.evaluate(async (url, t) => {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `search_query=03331234567&cf-turnstile-response=${encodeURIComponent(t)}` });
      const x = (await r.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      return /TOO MANY/i.test(x) ? 'LIMITED' : /TOTAL HITS/i.test(x) ? '*** REPORT: ' + (x.match(/TOTAL HITS\s*\d+/i)?.[0] ?? '') : 'other';
    }, SITE, tok);
    console.log('POST ->', out);
    break;
  }
}

await page.close();
browser.disconnect();
