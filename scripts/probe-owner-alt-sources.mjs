/**
 * JUGAAD: skip Turnstile entirely. Sites that mirror the same data often do the
 * lookup server-side, so their own endpoint can be called with plain HTTP.
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const NUM = '03331234567';
const CANDIDATES = [
  'https://simownerdetailsonline.com.pk/',
  'https://paksim.info/',
  'https://simsownersdetail.com/',
  'https://freshsimownerdetails.org.pk/',
  'https://checksimownerdetails.pk/',
  'https://datacorporation.com.pk/',
  'https://www.dataautomation.pk/',
];

const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

for (const url of CANDIDATES) {
  console.log(`\n=== ${url}`);
  let html;
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    html = await r.text();
    console.log(`  get ${r.status} len=${html.length} turnstile=${/cf-turnstile|turnstile/i.test(html)}`);
  } catch (e) {
    console.log(`  get ERR ${e.cause?.code ?? e.message}`);
    continue;
  }
  const forms = [...html.matchAll(/<form[^>]*>[\s\S]{0,400}?<\/form>/gi)].map((m) => m[0]).slice(0, 3);
  const inputs = [...new Set([...html.matchAll(/<input[^>]*name=["']([^"']+)["']/gi)].map((m) => m[1]))].slice(0, 8);
  const actions = [...new Set([...html.matchAll(/action=["']([^"']+)["']/gi)].map((m) => m[1]))].slice(0, 5);
  const ajax = [...new Set([...html.matchAll(/["']([^"']*\.php[^"']*)["']/gi)].map((m) => m[1]))].slice(0, 6);
  console.log('  inputs:', inputs.join(', ') || '-');
  console.log('  actions:', actions.join(', ') || '-');
  console.log('  php refs:', ajax.join(', ') || '-');

  // try a POST with the most likely field names
  for (const field of ['number', 'mobile', 'num', 'search', 'search_query', 'mobileno', 'msisdn']) {
    try {
      const body = new URLSearchParams({ [field]: NUM }).toString();
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded', referer: url },
        body,
        redirect: 'follow',
        signal: AbortSignal.timeout(25000),
      });
      const t = await r.text();
      const flat = strip(t);
      const hit = /(\d{5}-\d{7}-\d|\bCNIC\b|NAME|Name)/.test(flat) && !/turnstile/i.test(t);
      if (hit || r.status < 400) {
        const idx = flat.search(/CNIC|Name|NAME|owner/i);
        console.log(`  POST[${field}] ${r.status} len=${t.length}${idx >= 0 ? ' :: ' + flat.slice(Math.max(0, idx - 60), idx + 160) : ''}`);
      }
    } catch (e) {
      console.log(`  POST[${field}] ERR ${e.cause?.code ?? e.message}`);
    }
  }
}
