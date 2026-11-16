process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const get = async u => { const r = await fetch(u, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(30000) }); return { s: r.status, u: r.url, b: await r.text() }; };
const list = [
  'https://etanb.com/vehicle-verification/', 'https://sindhzameen.gos.pk/', 'https://epay.gos.pk/',
  'https://dls.gos.pk/', 'https://karachipolice.gov.pk/', 'https://punjab-zameen.gov.pk/',
  'https://kpexcise.gov.pk/verification/', 'https://www.kpexcise.gov.pk/new/verification/',
  'https://www.punjabpolice.gov.pk/', 'https://ipo.gov.pk/', 'https://punjab-zameen.gov.pk/plra/',
  'https://es.punjab-zameen.gov.pk/eStampCitizenPortal/ChallanFormView/VerifyStamp',
];
for (const u of list) {
  try {
    const r = await get(u);
    const t = (r.b.match(/<title[^>]*>([\s\S]{0,120}?)<\/title>/i) || [, ''])[1].replace(/\s+/g, ' ').trim();
    const txt = r.b.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 150);
    const kw = ['owner', 'name', 'address', 'captcha', 'login', 'otp', 'chassis', 'engine', 'fard', 'registration']
      .filter(k => new RegExp(k, 'i').test(r.b));
    console.log(`${u} | HTTP ${r.s} final=${r.u} title="${t}" | kw=${kw.join(',')} | ${txt}`);
  } catch (e) { console.log(`${u} | ERR ${e.cause?.code || e.message}`); }
}
