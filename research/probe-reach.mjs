import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const get = (u, opt = {}) => fetch(u, { headers: { 'user-agent': UA, ...(opt.headers || {}) }, signal: AbortSignal.timeout(30000), ...opt });

const cands = [
  'paksim.info', 'simsownersdetail.com', 'checksimownerdetails.pk', 'simchecker.pk',
  'freshsimownerdetails.org.pk', 'simdatabase.pk', 'siminfo.pk', 'simdatabase.com.pk',
  'simdatabse.pk', 'paksimsdata.com', 'simdetails.pk', 'paksim.info', 'cnic.sims.pk',
  'sims.pk', 'pakistandataba.se', 'www.whoseno.com', 'truecaller.com',
];
console.log('=== DNS/HTTPS reachability');
for (const h of cands) {
  try { await dns.promises.resolve4(h); } catch { console.log(`${h} DNS-FAIL`); continue; }
  try {
    const r = await get(`https://${h}/`);
    console.log(`${h} HTTP ${r.status} len=${(await r.text()).length}`);
  } catch (e) { console.log(`${h} HTTPS-FAIL ${e.cause?.code || e.message}`); }
}

console.log('\n=== paksim.info links (database targets)');
try {
  const h = await (await get('https://paksim.info/')).text();
  const links = [...new Set([...h.matchAll(/href="([^"]+)"/gi)].map(m => m[1]))].filter(l => /database|sim|track|search/i.test(l));
  console.log(links.slice(0, 40).join('\n'));
} catch (e) { console.log('ERR', e.message); }
