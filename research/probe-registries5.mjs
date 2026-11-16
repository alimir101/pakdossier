process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const CAND = [
  'https://dastak.punjab.gov.pk/', 'https://dastak.punjab.gov.pk/eng-site/',
  'https://igp-8787-center.psca.gop.pk/online/complaint', 'https://pkm.punjab.gov.pk/public',
  'https://viewbill.ssgc.com.pk/', 'https://ke.com.pk/billpay',
  'https://eservices.secp.gov.pk/eServices/NameSearch.jsp',
  'https://e.fbr.gov.pk/esbn/ActiveTaxPayerList', 'https://www.fbr.gov.pk/tax-directory',
  'https://dgip.gov.pk/', 'https://www.dgip.gov.pk/',
  'https://kplr.kp.gov.pk/Pages/Home.aspx',
  'https://rentregistrar.gos.pk/', 'https://rent.sindh.gov.pk/',
  'https://mcl.gov.pk/', 'https://kmc.gos.pk/',
  'https://www.nadra.gov.pk/frc/', 'https://id.nadra.gov.pk/frc/',
  'https://www.psca.gop.pk/', 'https://www.pitb.gov.pk/',
];
const doh = async n => { try { const r = await fetch(`https://dns.google/resolve?name=${n}&type=A`, { signal: AbortSignal.timeout(12000) }); const j = await r.json(); return { s: j.Status, a: (j.Answer || []).filter(x => x.type === 1).map(x => x.data) }; } catch { return { s: 'ERR', a: [] }; } };
async function run(u) {
  const h = new URL(u).hostname;
  const d = await doh(h);
  if (!d.a.length) return `${u} | DNS status=${d.s} NO-A`;
  try {
    const r = await fetch(u, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(28000) });
    const b = await r.text();
    const title = (b.match(/<title[^>]*>([\s\S]{0,140}?)<\/title>/i) || [, ''])[1].replace(/\s+/g, ' ').trim();
    const txt = b.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    return `${u} | HTTP ${r.status} final=${r.url} title="${title}" | ${txt.slice(0, 190)}`;
  } catch (e) { return `${u} | FETCH-FAIL ${e.cause?.code || e.message}`; }
}
const out = [];
for (let i = 0; i < CAND.length; i += 6) out.push(...await Promise.all(CAND.slice(i, i + 6).map(run)));
console.log(out.join('\n'));
