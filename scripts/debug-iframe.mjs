/**
 * Hypothesis: obscura cannot load cross-origin IFRAMEs at all.
 * Turnstile renders inside an iframe, so that would explain the permanent stall
 * (api.js loads, render() returns an id, but no frame and never a token).
 */
import puppeteer from 'puppeteer-core';

const v = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 120000 });
const page = await browser.newPage();

await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((e) => console.log('goto:', e.message));

const before = page.frames().length;
await page.evaluate(() => {
  const f = document.createElement('iframe');
  f.id = 'probe';
  f.src = 'https://example.org/';
  f.width = 400;
  f.height = 200;
  document.body.appendChild(f);
});

await new Promise((r) => setTimeout(r, 8000));

const after = page.frames().length;
const info = await page.evaluate(() => {
  const f = document.getElementById('probe');
  let loaded = false;
  let href = 'n/a';
  try {
    loaded = !!f?.contentDocument;
    href = f?.contentWindow?.location?.href ?? 'n/a';
  } catch (e) {
    href = 'cross-origin-blocked';
  }
  return { exists: !!f, loaded, href };
});

console.log(`frames before=${before} after=${after}`);
console.log('iframe:', JSON.stringify(info));
console.log(after > before ? '=> IFRAMES WORK' : '=> IFRAMES DO NOT ATTACH (root cause candidate)');

// and the widget's own frame count on the real target
await page.goto('https://pakistandataba.se/databases/sim.php', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((e) => console.log('goto2:', e.message));
await new Promise((r) => setTimeout(r, 6000));
console.log('target frames:', page.frames().length, '| frame urls:', page.frames().map((f) => f.url().slice(0, 60)).join(' | '));
await page.close();
browser.disconnect();
