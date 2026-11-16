/**
 * Phase 4 spike, via Obscura's CDP endpoint (no browser spawn from Node, so the
 * sandbox's EPERM never happens).
 *
 *  1. get a real Turnstile token on their page
 *  2. reuse that token from plain node fetch -> owner data, prove the server half
 *  3. try minting a token from OUR origin with their sitekey (decides if the PWA
 *     can do it client-side, or whether a sidecar is required)
 */
import puppeteer from 'puppeteer-core';

const CDP = process.env.OBSCURA_CDP ?? 'ws://127.0.0.1:9222';
const HTTP = CDP.replace(/^ws/, 'http').replace(/\/devtools\/browser.*$/, '');
const SITE = 'https://pakistandataba.se/databases/sim.php';
const SITEKEY = '0x4AAAAAADMujqAjT0iboJUw';
const NUMBER = '92304439955'; // 0300 4439955 — a number we know has records

// Ask the CDP server for its exact browser websocket URL rather than guessing
// the path (the bare /devtools/browser path 404s).
const version = await (await fetch(`${HTTP}/json/version`)).json();
const wsUrl = version.webSocketDebuggerUrl ?? CDP;
console.log('cdp:', wsUrl);

const browser = await puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: { width: 1280, height: 900 } });
console.log('connected |', await browser.version());

const page = await browser.newPage();

// ---------- step 1 -----------------------------------------------------------
await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 90000 });
let token = null;
try {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('input[name="cf-turnstile-response"]');
      return !!(el && typeof el.value === 'string' && el.value.length > 20);
    },
    { timeout: 60000 },
  );
  token = await page.$eval('input[name="cf-turnstile-response"]', (el) => el.value);
  console.log(`\nSTEP 1 OK — real token len=${token.length}`);
} catch (e) {
  const text = (await page.content()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  console.log(`\nSTEP 1 FAIL (${e.message})`);
  console.log('  page:', text.slice(0, 300));
}
await page.close();

// ---------- step 2 -----------------------------------------------------------
if (token) {
  const r = await fetch(SITE, {
    method: 'POST',
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157 Safari/537.36',
      'content-type': 'application/x-www-form-urlencoded',
      referer: SITE,
      origin: 'https://pakistandataba.se',
    },
    body: `search_query=${NUMBER}&cf-turnstile-response=${encodeURIComponent(token)}`,
  });
  const html = await r.text();
  const start = html.indexOf('console-hint');
  const end = html.indexOf('// DATA SOURCES');
  const region = html
    .slice(start >= 0 ? start : 0, end > start ? end : html.length)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  console.log(`\nSTEP 2 status=${r.status} len=${html.length}`);
  console.log('  RESULT REGION:', region.slice(0, 900) || '(khali)');
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) => m[0]);
  console.log(`  tables=${tables.length}`);
  if (tables.length) console.log('  RAW TABLE:', tables[0].slice(0, 1200));
}

// ---------- step 3 -----------------------------------------------------------
const app = await browser.newPage();
await app.setContent(
  `<!doctype html><html><head><meta charset="utf-8"></head><body>
     <div class="cf-turnstile" data-sitekey="${SITEKEY}" data-callback="__ok" data-error-callback="__bad"></div>
     <script>window.__tok=null;window.__err=null;window.__ok=(t)=>{window.__tok=t};window.__bad=(e)=>{window.__err=e};</script>
     <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
   </body></html>`,
  { waitUntil: 'networkidle2', timeout: 60000 },
);
try {
  await app.waitForFunction(() => window.__tok !== null || window.__err !== null, { timeout: 45000 });
  const res = await app.evaluate(() => ({ tok: window.__tok, err: window.__err }));
  console.log(`\nSTEP 3 our-origin token: ${res.tok ? `OK len=${res.tok.length}` : `FAILED (${res.err})`}`);
  if (res.tok) {
    const r2 = await fetch(SITE, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', referer: SITE, origin: 'https://pakistandataba.se' },
      body: `search_query=${NUMBER}&cf-turnstile-response=${encodeURIComponent(res.tok)}`,
    });
    const h2 = await r2.text();
    console.log(`  cross-origin token reuse -> HTTP ${r2.status}, verificationFailed=${/VERIFICATION FAILED/i.test(h2)}`);
  }
} catch (e) {
  console.log(`\nSTEP 3 FAIL — ${e.message}`);
}
await app.close();

browser.disconnect();
