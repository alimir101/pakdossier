import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const get = u => fetch(u, { headers: { 'user-agent': UA, accept: 'text/html,*/*' }, signal: AbortSignal.timeout(30000), redirect: 'follow' });

const urls = [
  'https://mtmis.punjab.gov.pk/',
  'https://plra.punjab.gov.pk/',
  'https://eservices.secp.gov.pk/eServices/',
  'https://e.fbr.gov.pk/esbn/Verification',
  'https://ecourts.punjab.gov.pk/',
  'https://dirbs.pta.gov.pk/',
  'https://bill.pitc.com.pk/lescobill',
  'https://www.sngpl.com.pk/',
  'https://www.ecp.gov.pk/',
  'https://pakidentity.nadra.gov.pk/',
  'https://onlinelicense.punjab.gov.pk/',
  'https://ptcl.com.pk/',
  'https://www.pakpost.gov.pk/',
  'https://eportal.hec.gov.pk/',
  'https://www.punjabpolice.gov.pk/',
  'https://kpesed.gov.pk/',
  'https://www.sindhexcise.gov.pk/',
  'https://epay.punjab.gov.pk/',
];

for (const u of urls) {
  const host = new URL(u).hostname;
  try { await dns.promises.resolve4(host); }
  catch { console.log(`${u}\tDNS-FAIL`); continue; }
  try {
    const r = await get(u);
    const body = await r.text();
    const t = body.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const inputs = (body.match(/<input/gi) || []).length;
    const forms = (body.match(/<form/gi) || []).length;
    console.log(`${u}\tHTTP ${r.status}\tlen=${body.length}\tinputs=${inputs}\tforms=${forms}\t${t.slice(0, 160)}`);
  } catch (e) { console.log(`${u}\tFAIL ${e.cause?.code || e.message}`); }
}
