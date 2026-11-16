/**
 * Round-4 spike: can we get owner name/CNIC out of PakistanDatabase without a
 * browser? Try every cheap trick before reaching for a headless browser.
 */
import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const N = '923001234567'; // 0300 1234567
const SITE = 'https://pakistandataba.se/databases/sim.php';

const strip = (h) =>
  h
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');

function verdict(label, status, html) {
  const captcha = /CAPTCHA REQUIRED/i.test(html);
  const t = strip(html);
  // a result table would carry the number back, or a name/address label
  const hasTable = /<table/i.test(html) && /(name|cnic|address)/i.test(html);
  const idx = t.search(/(NAME|CNIC|ADDRESS|Mobile)/i);
  console.log(`\n=== ${label}\nstatus=${status} len=${html.length} captcha=${captcha} looks_like_result=${hasTable}`);
  if (idx >= 0) console.log('  ' + t.slice(Math.max(0, idx - 120), idx + 400));
  else console.log('  ' + t.slice(0, 260));
}

async function post(label, body, extraHeaders = {}) {
  try {
    const r = await fetch(SITE, {
      method: 'POST',
      headers: {
        'user-agent': UA,
        'content-type': 'application/x-www-form-urlencoded',
        referer: SITE,
        origin: 'https://pakistandataba.se',
        ...extraHeaders,
      },
      body,
      signal: AbortSignal.timeout(30000),
    });
    verdict(label, r.status, await r.text());
  } catch (e) {
    console.log(`\n=== ${label}\nERR ${e.cause?.code || e.message}`);
  }
}

await post('1. dummy short token', `search_query=${N}&cf-turnstile-response=x`);
await post(
  '2. dummy long token (0. + 40 chars)',
  `search_query=${N}&cf-turnstile-response=0.${'A'.repeat(30)}`,
);
await post('3. no token field at all', `search_query=${N}`);

// 4. their documented API host — maybe a demo/empty key works
for (const host of [
  'https://fuckingapisystem.pakistandatabase.com/api/search',
  'https://api.pakistandatabase.com/api/search',
]) {
  for (const key of ['', 'PAKDB', 'DEMO', 'test']) {
    try {
      const url = `${host}?key=${key}&query=${N}`;
      const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
      const body = await r.text();
      console.log(`\n=== 4. ${host} key="${key}" -> HTTP ${r.status}\n  ${body.slice(0, 220).replace(/\s+/g, ' ')}`);
    } catch (e) {
      console.log(`\n=== 4. ${host} key="${key}" -> ERR ${e.cause?.code || e.message}`);
    }
  }
}

// 5. GET with token in the query string
try {
  const r = await fetch(`${SITE}?search_query=${N}&cf-turnstile-response=x`, {
    headers: { 'user-agent': UA },
    signal: AbortSignal.timeout(25000),
  });
  verdict('5. GET with token param', r.status, await r.text());
} catch (e) {
  console.log(`\n=== 5. GET ERR ${e.cause?.code || e.message}`);
}
