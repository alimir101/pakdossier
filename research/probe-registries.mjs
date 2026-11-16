import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const URLS = [
  // --- identity
  'https://cnic.sims.pk/',
  'https://www.nadra.gov.pk/',
  'https://id.nadra.gov.pk/',
  'https://pakidentity.nadra.gov.pk/',
  'https://www.nadra.gov.pk/verification-services/',
  'https://www.nadra.gov.pk/family-registration-certificate/',
  // --- vehicle
  'https://mtmis.excise.punjab.gov.pk/',
  'https://mtmis.excise.sindh.gov.pk/',
  'https://mtmis.kpexcise.gov.pk/',
  'https://mtmis.balochistan.gov.pk/',
  'https://dlims.punjab.gov.pk/',
  'https://dls.sindh.gov.pk/',
  'https://excise.punjab.gov.pk/',
  'https://excise.gos.pk/',
  'https://kp Excise'.replace(' ', '') ,
  'https://excise.kp.gov.pk/',
  // --- land
  'https://plra.punjab.gov.pk/',
  'https://arazi.punjab.gov.pk/',
  'https://eplra.punjab.gov.pk/',
  'https://sindhzameen.gos.pk/',
  'https://kplr.kp.gov.pk/',
  'https://estamp.punjab.gov.pk/',
  'https://estamp.sindh.gov.pk/',
  'https://epay.punjab.gov.pk/',
  'https://epay.sindh.gov.pk/',
  // --- business / tax
  'https://eservices.secp.gov.pk/eServices/',
  'https://e.fbr.gov.pk/esbn/Verification',
  'https://e.fbr.gov.pk/esbn/ActiveTaxpayerList',
  'https://taxdirectory.fbr.gov.pk/',
  'https://www.fbr.gov.pk/',
  'https://ipo.gov.pk/',
  // --- courts / police
  'https://ecourts.punjab.gov.pk/',
  'https://www.supremecourt.gov.pk/',
  'https://www.scp.gov.pk/',
  'https://casestatus.lhc.gov.pk/',
  'https://www.lhc.gov.pk/',
  'https://sindhhighcourt.gov.pk/',
  'https://pcr.punjab.gov.pk/',
  'https://www.punjabpolice.gov.pk/',
  'https://www.sindhpolice.gov.pk/',
  'https://kppolice.gov.pk/',
  // --- utilities
  'https://bill.pitc.com.pk/',
  'https://bill.pitc.com.pk/lescobill',
  'https://bill.pitc.com.pk/gepcobill',
  'https://www.ke.com.pk/',
  'https://www.ke.com.pk/bill-check/',
  'https://sngpl.com.pk/',
  'https://www.ssgc.com.pk/',
  'https://bill.sngpl.com.pk/',
  'https://www.ptcl.com.pk/',
  'https://www.pakpost.gov.pk/postcode.php',
  'https://www.pakpost.gov.pk/',
  // --- voter / misc
  'https://www.ecp.gov.pk/',
  'https://www.dgip.gov.pk/',
  'https://passport.gov.pk/',
  'https://onlinemrp.dgip.gov.pk/',
  'https://dirbs.pta.gov.pk/',
  'https://dirbs.pta.gov.pk/drs/',
  'https://www.hec.gov.pk/',
  'https://verify.hec.gov.pk/',
  'https://www.ibcc.edu.pk/',
  'https://www.biselahore.com/',
  'https://www.fia.gov.pk/',
];

async function probe(u) {
  const h = new URL(u).hostname;
  try { await dns.promises.resolve4(h); } catch { return `${u} | DNS-FAIL`; }
  try {
    const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'text/html,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
    const buf = await r.arrayBuffer();
    let body = Buffer.from(buf).toString('utf8');
    if (body.length > 600000) body = body.slice(0, 600000);
    const title = (body.match(/<title[^>]*>([\s\S]{0,160}?)<\/title>/i) || [, ''])[1].replace(/\s+/g, ' ').trim();
    const txt = body.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    const kws = ['captcha', 'otp', 'login', 'owner', 'fard', 'registration', 'consumer', 'name', 'address', 'challan', 'search']
      .filter(k => new RegExp(k, 'i').test(body));
    return `${u} | HTTP ${r.status} | final=${r.url} | len=${body.length} | title="${title}" | kw=${kws.join(',')} | text="${txt.slice(0, 260)}"`;
  } catch (e) { return `${u} | FETCH-FAIL ${e.cause?.code || e.message}`; }
}

const results = [];
const CONC = 8;
for (let i = 0; i < URLS.length; i += CONC) {
  const batch = URLS.slice(i, i + CONC);
  results.push(...await Promise.all(batch.map(probe)));
}
console.log(results.join('\n'));
