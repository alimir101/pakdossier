/**
 * Token minting works — now find whether their SIM index actually has records.
 * Mint a fresh token per number on their own page, then POST with plain fetch.
 */
import puppeteer from 'puppeteer-core';

const HTTP = 'http://127.0.0.1:9222';
const SITE = 'https://pakistandataba.se/databases/sim.php';
const version = await (await fetch(`${HTTP}/json/version`)).json();
const browser = await puppeteer.connect({ browserWSEndpoint: version.webSocketDebuggerUrl });
const page = await browser.newPage();

const numbers = [
  '923001111111', '923004439955', '923001234567', '923211234567', '923451234567',
  '923331234567', '923121234567', '923131234567', '923221234567', '923341234567',
  '923351234567', '923009876543',
];

const stats = (html) => {
  const hits = /TOTAL HITS\s*(\d+)/i.exec(html.replace(/<[^>]+>/g, ' '))?.[1];
  const noRecords = /NO RECORDS/i.test(html);
  const region = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
  const i = region.indexOf('QUERY');
  return { hits, noRecords, region: region.slice(i, i + 520).trim() };
};

let token = null;
async function freshToken() {
  await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector('input[name="cf-turnstile-response"]');
      return !!(el && el.value && el.value.length > 20);
    },
    { timeout: 45000 },
  );
  token = await page.$eval('input[name="cf-turnstile-response"]', (el) => el.value);
}

for (const n of numbers) {
  try {
    await freshToken();
    const r = await fetch(SITE, {
      method: 'POST',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157 Safari/537.36',
        'content-type': 'application/x-www-form-urlencoded',
        referer: SITE,
        origin: 'https://pakistandataba.se',
      },
      body: `search_query=${n}&cf-turnstile-response=${encodeURIComponent(token)}`,
    });
    const html = await r.text();
    const s = stats(html);
    console.log(`\n${n} -> HTTP ${r.status} hits=${s.hits ?? '?'} noRecords=${s.noRecords}`);
    if (s.noRecords === false) console.log('   FULL:', s.region);
    else console.log('   ' + s.region.slice(0, 120));
  } catch (e) {
    console.log(`\n${n} ERR ${e.message}`);
  }
}

await page.close();
browser.disconnect();
