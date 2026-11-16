process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const CAND = [
  // police
  'https://www.punjabpolice.gov.pk/', 'https://punjabpolice.gov.pk/', 'https://pcr.punjab.gov.pk/Home',
  'https://pcr.punjab.gov.pk/Index', 'https://complaint.punjabpolice.gov.pk/', 'https://citizen.punjabpolice.gov.pk/',
  // ecp
  'https://ecp.gov.pk/voter-check', 'https://www.ecp.gov.pk/votercheck', 'https://ecp.gov.pk/votercheck',
  'https://www.ecp.gov.pk/ElectionResults', 'https://ecp.gov.pk/electoral-rolls',
  // passport
  'https://onlinemrp.dgip.gov.pk/Tracking', 'https://dgip.gov.pk/tracking', 'https://www.dgip.gov.pk/tracking'
    ,
  // ptcl
  'https://ptcl.com.pk/phone-directory', 'https://ptcl.com.pk/phonedirectory', 'https://ptcl.com.pk/Home/PhoneDirectory',
  'https://ptclphonebook.com/',
  // gas / ke
  'https://sngpl.com.pk/bill-check/', 'https://sngpl.com.pk/consumer-bill/', 'https://sngpl.com.pk/billcheck/',
  'https://ke.com.pk/bill-check', 'https://ke.com.pk/ebill/', 'https://ke.com.pk/customer-service/',
  'https://www.ssgc.com.pk/web/bill-check/', 'https://www.ssgc.com.pk/bill-check/',
  // fbr / secp
  'https://www.fbr.gov.pk/tax-directory', 'https://e.fbr.gov.pk/esbn/ATL', 'https://e.fbr.gov.pk/esbn/Atl',
  'https://eservices.secp.gov.pk/', 'https://www.secp.gov.pk/', 'https://eservices.secp.gov.pk/eServices/CompanyNameSearch',
  // lhc
  'https://lhc.gov.pk/case-status/', 'https://www.lhc.gov.pk/case-status', 'https://cases.shc.gov.pk/',
  // kp land / rent / trade
  'https://kplr.kp.gov.pk/Home', 'https://rentregistrar.sindh.gov.pk/', 'https://lma.punjab.gov.pk/',
  'https://www.dsjlahore.punjab.gov.pk/', 'https://dsjlahore.punjab.gov.pk/',
  // nadra frc
  'https://id.nadra.gov.pk/frc', 'https://www.nadra.gov.pk/services/',
];
const doh = async n => { try { const r = await fetch(`https://dns.google/resolve?name=${n}&type=A`, { signal: AbortSignal.timeout(12000) }); const j = await r.json(); return { s: j.Status, a: (j.Answer || []).filter(x => x.type === 1).map(x => x.data) }; } catch { return { s: 'DOH-ERR', a: [] }; } };
async function run(u) {
  const h = new URL(u).hostname;
  const d = await doh(h);
  if (!d.a.length) return `${u} | DNS status=${d.s} NO-A`;
  try {
    const r = await fetch(u, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
    const b = await r.text();
    const title = (b.match(/<title[^>]*>([\s\S]{0,140}?)<\/title>/i) || [, ''])[1].replace(/\s+/g, ' ').trim();
    const txt = b.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    return `${u} | HTTP ${r.status} final=${r.url} title="${title}" | ${txt.slice(0, 170)}`;
  } catch (e) { return `${u} | FETCH-FAIL ${e.cause?.code || e.message}`; }
}
const out = [];
for (let i = 0; i < CAND.length; i += 6) out.push(...await Promise.all(CAND.slice(i, i + 6).map(run)));
console.log(out.join('\n'));
