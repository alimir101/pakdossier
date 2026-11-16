import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const get = u => fetch(u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000), redirect: 'follow' });

const hosts = [
  'https://www.nadra.gov.pk/',
  'https://id.nadra.gov.pk/',
  'https://cnic.nadra.gov.pk/',
  'https://pakidentity.nadra.gov.pk/',
  'https://verisys.nadra.gov.pk/',
  'https://ecp.gov.pk/',
  'https://cnic.sims.pk/',
];
for (const u of hosts) {
  const h = new URL(u).hostname;
  try { await dns.promises.resolve4(h); } catch { console.log(`${u} DNS-FAIL`); continue; }
  try {
    const r = await get(u);
    const body = await r.text();
    const t = body.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    console.log(`\n=== ${u} HTTP ${r.status} len=${body.length}`);
    console.log(t.slice(0, 350));
    const kws = ['verisys', 'cnic', 'verif', 'api', 'family', 'login'].map(k => `${k}:${((body.match(new RegExp(k, 'gi')) || []).length)}`).join(' ');
    console.log('kw ->', kws);
    console.log('inputs:', [...body.matchAll(/<input[^>]*>/gi)].map(m => m[0].replace(/\s+/g, ' ')).slice(0, 6).join(' | ').slice(0, 400));
  } catch (e) { console.log(`${u} HTTPS-FAIL ${e.cause?.code || e.message}`); }
}
