process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const get = async u => { const r = await fetch(u, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(30000) }); return { status: r.status, url: r.url, body: await r.text() }; };

const targets = [
  ['sngpl.com.pk', 'https://sngpl.com.pk/', /bill|consumer|account|duplicate|inquiry/i],
  ['ke.com.pk', 'https://ke.com.pk/', /bill|pay|ebill|consumer|account/i],
  ['ptcl.com.pk', 'https://ptcl.com.pk/', /directory|phone|directorysearch/i],
  ['fbr.gov.pk', 'https://www.fbr.gov.pk/', /atl|tax-directory|verif|e\.fbr|esbn/i],
];
for (const [label, u, re] of targets) {
  try {
    const r = await get(u);
    const links = [...new Set([...r.body.matchAll(/href=["']([^"']+)["']/gi)].map(m => m[1]))].filter(l => re.test(l));
    console.log(`\n### ${label} status=${r.status}`);
    console.log(links.slice(0, 30).join('\n'));
  } catch (e) { console.log(`\n### ${label} ERR ${e.cause?.code || e.message}`); }
}

console.log('\n### extra pages');
for (const u of [
  'https://www.kpexcise.gov.pk/mvrecords/', 'https://dls.gos.pk/', 'https://excise.gos.pk/vehicle/vehicle_search',
  'https://sngpl.com.pk/?page_id=2', 'https://borelra.balochistan.gov.pk/', 'https://borsindh.gos.pk/',
]) {
  try { const r = await get(u); const t = (r.body.match(/<title[^>]*>([\s\S]{0,120}?)<\/title>/i) || [, ''])[1].replace(/\s+/g, ' ').trim(); console.log(`${u} | HTTP ${r.status} final=${r.url} title="${t}"`); }
  catch (e) { console.log(`${u} | ERR ${e.cause?.code || e.message}`); }
}
