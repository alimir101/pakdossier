/**
 * Obscura running behind a proxy: the page, the Turnstile widget AND the POST all
 * leave through a different IP, which should dodge the mirror's per-network
 * throttle. The POST is issued from inside the page so it uses obscura's stack.
 */
import puppeteer from 'puppeteer-core';

const CDP = process.env.OBSCURA_HTTP ?? 'http://127.0.0.1:9223';
const SITE = 'https://pakistandataba.se/databases/sim.php';
const NUM = process.env.SPIKE_NUMBER ?? '03331234567';

let version;
try {
  version = await (await fetch(`${CDP}/json/version`, { signal: AbortSignal.timeout(8000) })).json();
} catch (e) {
  console.log(`obscura ${CDP} reachable nahi: ${e.message}`);
  process.exit(1);
}
console.log('connected to', CDP, '|', version.Browser);

const browser = await puppeteer.connect({ browserWSEndpoint: version.webSocketDebuggerUrl, protocolTimeout: 150000 });
const page = await browser.newPage();

let lastErr;
for (let i = 1; i <= 3; i++) {
  try {
    await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    lastErr = undefined;
    break;
  } catch (e) {
    lastErr = e.message;
    await new Promise((r) => setTimeout(r, 700 * i));
  }
}
if (lastErr) {
  console.log('page load failed through proxy:', lastErr.slice(0, 120));
  await page.close();
  browser.disconnect();
  process.exit(1);
}

await page.waitForFunction(
  () => {
    const el = document.querySelector('input[name="cf-turnstile-response"]');
    return !!(el && el.value && el.value.length > 20);
  },
  { timeout: 120000, polling: 1000 },
);
const token = await page.$eval('input[name="cf-turnstile-response"]', (el) => el.value);
console.log(`token len=${token.length}`);

const out = await page.evaluate(
  async (url, number, tok) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `search_query=${number}&cf-turnstile-response=${encodeURIComponent(tok)}`,
    });
    return { status: res.status, text: await res.text() };
  },
  SITE,
  NUM.replace(/\D/g, '').replace(/^0/, '92'),
  token,
);

const flat = out.text.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
console.log(`POST status=${out.status} len=${out.text.length}`);
if (/TOO MANY SEARCHES/i.test(flat)) console.log('LIMITED:', /TOO MANY SEARCHES[^.]*/.exec(flat)[0]);
else if (/TOTAL HITS/i.test(flat)) {
  const i = flat.indexOf('TOTAL HITS');
  console.log('*** LIVE REPORT ***\n ' + flat.slice(i, i + 420));
} else console.log('other:', flat.slice(0, 200));

await page.close();
browser.disconnect();
