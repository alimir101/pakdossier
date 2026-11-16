process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const CAND = [
  'punjab-zameen.gov.pk', 'es.punjab-zameen.gov.pk',
  'mtmis.gos.pk', 'mtmis.sindhexcise.gos.pk', 'mtmis.sindh.gov.pk', 'sindhexcise.gos.pk', 'sindh.gov.pk',
  'kpexcise.gov.pk', 'www.kpexcise.gov.pk',
  'dlkpk.com', 'dls.kp.gov.pk', 'kpdlms.kp.gov.pk',
  'ecourts.punjab.gov.pk', 'punjabjudiciary.gov.pk', 'dsj.punjab.gov.pk',
  'taxdirectory.fbr.gov.pk',
  'eservices.hec.gov.pk',
  'ptclphonebook.com.pk',
  'bill.ssgc.com.pk', 'ssgc.com.pk',
  'epay.gos.pk', 'epay.sindh.gov.pk',
  'sindhzameen.gos.pk',
  'passport.dgip.gov.pk',
  'islamabadexcise.gov.pk',
  'excise.balochistan.gov.pk',
  'complaint.punjabpolice.gov.pk', 'pcr.punjab.gov.pk',
  'fir.sindhpolice.gov.pk',
  'ecp.gov.pk',
];
const doh = async name => {
  try { const r = await fetch(`https://dns.google/resolve?name=${name}&type=A`, { signal: AbortSignal.timeout(12000) }); const j = await r.json(); return { s: j.Status, a: (j.Answer || []).filter(x => x.type === 1).map(x => x.data) }; }
  catch (e) { return { s: 'DOH-ERR', a: [] }; }
};
async function run(h) {
  const d = await doh(h);
  if (!d.a.length) return `${h} | DNS status=${d.s} NO-A`;
  let http;
  try {
    const r = await fetch('https://' + h, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
    const b = await r.text();
    const title = (b.match(/<title[^>]*>([\s\S]{0,140}?)<\/title>/i) || [, ''])[1].replace(/\s+/g, ' ').trim();
    const txt = b.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    http = `HTTP ${r.status} title="${title}" | ${txt.slice(0, 200)}`;
  } catch (e) { http = `HTTPS-FAIL ${e.cause?.code || e.message}`; }
  return `${h} | DNS ok (${d.a[0]}) | ${http}`;
}
const out = [];
for (let i = 0; i < CAND.length; i += 6) out.push(...await Promise.all(CAND.slice(i, i + 6).map(run)));
console.log(out.join('\n'));
