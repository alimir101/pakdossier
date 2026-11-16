/**
 * Round-3 research probe: is there a KEYLESS provider we can verify live?
 *  A) pakistandataba.se with a cookie jar (does Turnstile actually block a plain POST?)
 *  B) whoseno.com same-origin php endpoints
 */
import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const N = '923001234567';
const strip = (h) =>
  h
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

const cookiesOf = (r) => {
  const raw = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
  return raw.map((c) => c.split(';')[0]).join('; ');
};

async function probe(label, fn) {
  try {
    const out = await fn();
    console.log(`\n=== ${label}\n${out}`);
  } catch (e) {
    console.log(`\n=== ${label}\nERR ${e.cause?.code || e.message}`);
  }
}

await probe('A1 pakistandataba GET (cookie jar)', async () => {
  const url = 'https://pakistandataba.se/databases/sim.php';
  const r1 = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25000) });
  const cookie = cookiesOf(r1);
  await r1.text();
  const r2 = await fetch(url, {
    method: 'POST',
    headers: {
      'user-agent': UA,
      cookie,
      'content-type': 'application/x-www-form-urlencoded',
      referer: url,
      origin: 'https://pakistandataba.se',
    },
    body: `search_query=${N}&cf-turnstile-response=`,
    signal: AbortSignal.timeout(25000),
  });
  const h = await r2.text();
  const t = strip(h);
  return `cookie="${cookie}" | status=${r2.status} len=${h.length}\ncaptcha_required=${/CAPTCHA REQUIRED/i.test(h)}\n${t.slice(Math.max(0, t.toLowerCase().indexOf('sim') - 50), 600)}`;
});

await probe('A2 pakistandataba unified GET+POST', async () => {
  const url = 'https://pakistandataba.se/';
  const r1 = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25000) });
  const cookie = cookiesOf(r1);
  await r1.text();
  const r2 = await fetch(url, {
    method: 'POST',
    headers: { 'user-agent': UA, cookie, 'content-type': 'application/x-www-form-urlencoded', referer: url, origin: 'https://pakistandataba.se' },
    body: `search_query=${N}`,
    signal: AbortSignal.timeout(30000),
  });
  const h = await r2.text();
  const t = strip(h);
  return `status=${r2.status} len=${h.length} captcha=${/CAPTCHA REQUIRED/i.test(h)}\n${t.slice(0, 400)}`;
});

await probe('B1 whoseno lookup page → find api path', async () => {
  const r = await fetch(`https://www.whoseno.com/pk/${N}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25000) });
  const h = await r.text();
  const apis = [...new Set([...h.matchAll(/["'](\/tools\/[^"']*api\.php[^"']*)["']/g)].map((m) => m[1]))];
  const inline = /truecaller|carrier|lineType|line_type/i.test(h);
  return `status=${r.status} len=${h.length} apis=${JSON.stringify(apis)} mentions_fields=${inline}`;
});

for (const path of ['/tools/phone-number-lookup/api.php', '/tools/phone-lookup/api.php', '/api.php']) {
  await probe(`B2 POST whoseno ${path}`, async () => {
    const r = await fetch(`https://www.whoseno.com${path}`, {
      method: 'POST',
      headers: {
        'user-agent': UA,
        'content-type': 'application/x-www-form-urlencoded',
        referer: 'https://www.whoseno.com/tools/phone-number-generator/',
        origin: 'https://www.whoseno.com',
      },
      body: `number=${N}&phone=${N}&country=pk`,
      signal: AbortSignal.timeout(25000),
    });
    const b = await r.text();
    return `status=${r.status} ct=${r.headers.get('content-type')} len=${b.length}\n${b.slice(0, 300)}`;
  });
}

await probe('C provider endpoints reject without a key (URL sanity)', async () => {
  const targets = [
    `https://apilayer.net/api/validate?number=${N}`,
    `https://api.numlookupapi.com/v1/validate/${N}`,
  ];
  const out = [];
  for (const t of targets) {
    try {
      const r = await fetch(t, { signal: AbortSignal.timeout(20000) });
      out.push(`${new URL(t).host} -> HTTP ${r.status} ${(await r.text()).slice(0, 90).replace(/\s+/g, ' ')}`);
    } catch (e) {
      out.push(`${new URL(t).host} -> FAIL ${e.cause?.code || e.message}`);
    }
  }
  return out.join('\n');
});
