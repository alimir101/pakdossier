import dns from 'node:dns/promises';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const N = '923001234567';
const get = (u, opt = {}) => fetch(u, { headers: { 'user-agent': UA, ...(opt.headers || {}) }, signal: AbortSignal.timeout(30000), ...opt });
const strip = h => h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

async function show(label, url, opt) {
  try {
    const r = await get(url, opt);
    const h = await r.text();
    const t = strip(h);
    const i = Math.max(0, t.toLowerCase().indexOf('search_query') - 100);
    console.log(`\n=== ${label} status=${r.status} len=${h.length}`);
    console.log(t.slice(0, 260));
    console.log('--- around keyword:', t.slice(i, i + 700));
  } catch (e) { console.log(`\n=== ${label} ERR ${e.message}`); }
}

await show('GET ?search_query=', `https://pakistandataba.se/databases/sim.php?search_query=${N}`);
await show('POST search_query', 'https://pakistandataba.se/databases/sim.php', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded', referer: 'https://pakistandataba.se/databases/sim.php', origin: 'https://pakistandataba.se' },
  body: `search_query=${N}`,
});
await show('unified GET ?search_query=', `https://pakistandataba.se/?search_query=${N}`);
await show('unified POST search_query', 'https://pakistandataba.se/', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded', referer: 'https://pakistandataba.se/', origin: 'https://pakistandataba.se' },
  body: `search_query=${N}`,
});

console.log('\n=== DNS via 8.8.8.8');
const r8 = new dns.Resolver();
r8.setServers(['8.8.8.8', '1.1.1.1']);
for (const h of ['simdatabase.pk', 'siminfo.pk', 'simlivetracker.com.pk', 'simdatabase.com.pk', 'paksim.info', 'sims.pk', 'cnic.sims.pk', 'pakistandataba.se', 'simsownersdetail.com', 'checksimownerdetails.pk']) {
  try {
    const a = await r8.resolve4(h);
    console.log(`${h} -> ${a.join(',')}`);
  } catch (e) { console.log(`${h} -> FAIL ${e.code || e.message}`); }
}
