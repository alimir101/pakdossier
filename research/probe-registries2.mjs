process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const CANDIDATES = [
  'pakidentity.nadra.gov.pk',
  'mtmis.excise.sindh.gov.pk', 'mtmis.excise.gos.pk', 'mtmis.sindh.gov.pk',
  'mtmis.kpexcise.gov.pk', 'mtmis.kp.gov.pk', 'mtmis.kpboit.gov.pk',
  'mtmis.balochistan.gov.pk', 'mtmis.balochistan.gob.pk',
  'dls.sindh.gov.pk', 'dls.gos.pk', 'dlims.sindh.gov.pk',
  'plra.punjab.gov.pk', 'arazi.punjab.gov.pk', 'eplra.punjab.gov.pk', 'fard.punjab.gov.pk', 'punjab-zameen.punjab.gov.pk',
  'estamp.punjab.gov.pk', 'estamp.sindh.gov.pk', 'estamp.kp.gov.pk',
  'epay.sindh.gov.pk', 'epay.punjab.gov.pk',
  'taxdirectory.fbr.gov.pk', 'e.fbr.gov.pk',
  'ecourts.punjab.gov.pk', 'casestatus.lhc.gov.pk', 'lhc.gov.pk', 'casestatus.supremecourt.gov.pk',
  'bill.sngpl.com.pk', 'sngpl.com.pk', 'www.sngpl.com.pk', 'sngpl.com.pk/bill',
  'passport.gov.pk', 'verify.hec.gov.pk', 'www.hec.gov.pk',
  'pcr.punjab.gov.pk', 'ecomplaint.punjab.gov.pk', 'ccpo.lahore.punjab.gov.pk',
  'sindhzameen.gos.pk', 'ipo.gov.pk', 'www.ipo.gov.pk',
  'kp.mtmis.gov.pk', 'excise.gos.pk', 'sindhexcise.gos.pk',
];

const doh = async (name) => {
  const r = await fetch(`https://dns.google/resolve?name=${name}&type=A`, { signal: AbortSignal.timeout(15000) });
  const j = await r.json();
  const a = (j.Answer || []).filter(x => x.type === 1).map(x => x.data);
  return { status: j.Status, a };
};

async function run(host) {
  try {
    const d = await doh(host);
    if (!d.a.length) return `${host} | DNS status=${d.status} NO-A`;
    let http = '';
    try {
      const r = await fetch('https://' + host, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
      const b = await r.text();
      const title = (b.match(/<title[^>]*>([\s\S]{0,140}?)<\/title>/i) || [, ''])[1].replace(/\s+/g, ' ').trim();
      http = `HTTP ${r.status} final=${r.url} title="${title}"`;
    } catch (e) { http = `HTTPS-FAIL ${e.cause?.code || e.message}`; }
    return `${host} | DNS ok (${d.a[0]}) | ${http}`;
  } catch (e) { return `${host} | DOH-FAIL ${e.message}`; }
}

const out = [];
for (let i = 0; i < CANDIDATES.length; i += 6) {
  out.push(...await Promise.all(CANDIDATES.slice(i, i + 6).map(run)));
}
console.log(out.join('\n'));
