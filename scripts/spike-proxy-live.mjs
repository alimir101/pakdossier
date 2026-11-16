/**
 * The throttle is per source network. Mint the token locally (obscura), then
 * POST through a proxy so the mirror sees a different IP.
 *
 * Run: HTTPS_PROXY=http://host:port NODE_USE_ENV_PROXY=1 NO_PROXY=127.0.0.1,localhost node scripts/spike-proxy-live.mjs
 */
import puppeteer from 'puppeteer-core';

const SITE = 'https://pakistandataba.se/databases/sim.php';
const NUM = process.env.SPIKE_NUMBER ?? '03331234567';

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
console.log(`token len=${token.length}`);
await page.close();
browser.disconnect();

const body = `search_query=${NUM}&cf-turnstile-response=${encodeURIComponent(token)}`;

let text = '';
let lastErr = '';
for (let attempt = 1; attempt <= 4 && !text; attempt++) {
  try {
    const r = await fetch(SITE, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', referer: SITE, origin: 'https://pakistandataba.se' },
      body,
      signal: AbortSignal.timeout(45000),
    });
    text = await r.text();
  } catch (e) {
    lastErr = e.cause?.code ?? e.message;
    console.log(`  proxy POST attempt ${attempt} failed: ${lastErr}`);
    await new Promise((r) => setTimeout(r, 800 * attempt));
  }
}
if (!text) {
  console.log('proxy POST never succeeded:', lastErr);
  process.exitCode = 1;
}

const flat = text.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

if (/TOO MANY SEARCHES/i.test(flat)) {
  console.log('LIMITED:', /TOO MANY SEARCHES[^.]*/.exec(flat)[0]);
} else if (/TOTAL HITS/i.test(flat)) {
  const i = flat.indexOf('TOTAL HITS');
  console.log('LIVE REPORT via proxy:\n ' + flat.slice(i, i + 400));
} else {
  console.log('other:', flat.slice(0, 200));
}
