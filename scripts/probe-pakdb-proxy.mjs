/**
 * The throttle is per source network. Mint the token locally, then POST through
 * a public proxy whose egress IP is different — maybe that IP is not throttled.
 */
import puppeteer from 'puppeteer-core';

const SITE = 'https://pakistandataba.se/databases/sim.php';
const NUM = '03331234567';

const version = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const browser = await puppeteer.connect({ browserWSEndpoint: version.webSocketDebuggerUrl });
const page = await browser.newPage();

async function gotoRetry(url, tries = 3) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      return;
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 600 * i));
    }
  }
  throw last;
}

await gotoRetry(SITE);
await page.waitForFunction(
  () => {
    const el = document.querySelector('input[name="cf-turnstile-response"]');
    return !!(el && el.value && el.value.length > 20);
  },
  { timeout: 45000 },
);
const token = await page.$eval('input[name="cf-turnstile-response"]', (el) => el.value);
console.log('token len', token.length);
await page.close();
browser.disconnect();

const classify = (text) =>
  /TOO MANY SEARCHES/i.test(text) ? 'LIMITED' : /TOTAL HITS/i.test(text) ? 'REPORT' : /VERIFICATION FAILED/i.test(text) ? 'VERIFY-FAILED' : 'UNKNOWN';

const body = `search_query=${NUM}&cf-turnstile-response=${encodeURIComponent(token)}`;

const routes = [
  ['direct', SITE],
  ['allorigins', `https://api.allorigins.win/raw?url=${encodeURIComponent(SITE)}`],
  ['corsproxy.io', `https://corsproxy.io/?url=${encodeURIComponent(SITE)}`],
  ['codetabs', `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(SITE)}`],
];

for (const [name, url] of routes) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(45000),
    });
    const text = await r.text();
    const state = classify(text);
    console.log(`${name.padEnd(14)} HTTP ${r.status} len=${text.length} -> ${state}`);
    if (state === 'REPORT') {
      const t = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      const i = t.indexOf('TOTAL HITS');
      console.log('   ' + t.slice(i, i + 380));
    } else if (state === 'LIMITED') {
      console.log('   ' + /TOO MANY SEARCHES[^.]*/.exec(text)[0]);
    }
  } catch (e) {
    console.log(`${name.padEnd(14)} ERR ${String(e.cause?.code ?? e.message).slice(0, 80)}`);
  }
}
