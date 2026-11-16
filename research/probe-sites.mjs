import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const N = '03001234567';
const get = (u, opt = {}) => fetch(u, { headers: { 'user-agent': UA, ...(opt.headers || {}) }, signal: AbortSignal.timeout(30000), ...opt });
const strip = h => h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

for (const url of ['https://paksim.info/', 'https://sims.pk/', 'https://checksimownerdetails.pk/', 'https://simsownersdetail.com/']) {
  try {
    const r = await get(url);
    const h = await r.text();
    const t = strip(h);
    console.log(`\n=== ${url} status=${r.status} len=${h.length}`);
    console.log(t.slice(0, 550));
    console.log('inputs:', [...h.matchAll(/<input[^>]*name="([^"]+)"[^>]*>/gi)].map(m => m[0].replace(/\s+/g, ' ')).slice(0, 8).join(' | '));
  } catch (e) { console.log(`\n=== ${url} ERR ${e.message} cause=${e.cause?.code || e.cause?.message || ''}`); }
}

console.log('\n=== pakistandatabase POST raw form region');
try {
  const r = await get('https://pakistandataba.se/databases/sim.php', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', referer: 'https://pakistandataba.se/databases/sim.php', origin: 'https://pakistandataba.se' },
    body: `search_query=${N}`,
  });
  const h = await r.text();
  const i = h.indexOf('CAPTCHA');
  console.log(h.slice(Math.max(0, i - 1400), i + 600));
  console.log('\n--- form tags:', [...h.matchAll(/<form[\s\S]{0,500}?>/gi)].map(m => m[0].replace(/\s+/g, ' ')).join('\n---\n'));
} catch (e) { console.log('ERR', e.message); }
