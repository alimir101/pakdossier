const base = 'http://localhost:4173';
const idx = await fetch(base + '/');
console.log('app:', idx.status, 'bytes=' + (await idx.text()).length);
const h = await (await fetch(base + '/api/health')).json();
console.log('health: providers=' + h.providers.length, 'pakdb=' + (h.providers.find(p=>p.id==='pakdb')?.keyPresent));
const t0 = Date.now();
const r = await fetch(base + '/api/lookup?number=03331234567');
const b = await r.json();
const owner = (b.results ?? []).find(x => x.provider === 'pakdb');
console.log(`lookup: HTTP ${r.status} in ${Date.now()-t0}ms cachedHeader=${r.headers.get('x-pakdossier-cache')}`);
if (owner?.fields?.records?.length) {
  console.log('OWNER DATA READY:');
  for (const rec of owner.fields.records) console.log(`   ${rec.mobile} | ${rec.name} | ${rec.cnic} | ${rec.address}`);
} else {
  console.log('pakdb partial:', JSON.stringify((b.partial??[]).find(p=>p.provider==='pakdb')));
  console.log('other results:', (b.results??[]).map(x=>x.provider).join(', '));
}
const c = await (await fetch(base + '/api/cnic?cnic=3520296868939')).json();
console.log('cnic reverse:', c.ok ? `records=${c.records?.length} hits=${c.totalHits}` : JSON.stringify(c));
