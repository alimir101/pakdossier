/**
 * Round-5 end-to-end: the app's own server, with the sidecar wired in.
 * Proves the whole chain is connected: UI bundle + worker + sidecar + mirror.
 */
const base = 'http://localhost:4173';

const index = await (await fetch(base + '/')).text();
const script = index.match(/src="([^"]+\.js)"/)?.[1];
console.log(`index: ${index.length} bytes, bundle ${script}`);
const js = await (await fetch(base + script)).text();
for (const needle of ['PakDossier', 'CNIC mil gaya', 'CNIC tab mein le jayein', 'Official checks aur portals', 'Live providers']) {
  console.log(`  ${js.includes(needle) ? 'ok  ' : 'MISS'} ${needle}`);
}

const health = await (await fetch(base + '/api/health')).json();
console.log(`health: providers=${health.providers.length} keyless=${health.keyless}`);
console.log('  pakdb configured:', health.providers.find((p) => p.id === 'pakdb')?.keyPresent);

const started = Date.now();
const r = await fetch(base + '/api/lookup?number=03331234567');
const body = await r.json();
console.log(`lookup: HTTP ${r.status} in ${Date.now() - started}ms results=${body.results?.length} partial=${body.partial?.length}`);
for (const res of body.results ?? []) {
  console.log(`  result ${res.provider} [${res.carrierKind}] records=${res.fields.records?.length ?? 0} carrier=${res.fields.carrier ?? '-'}`);
}
for (const p of body.partial ?? []) console.log(`  partial ${p.provider}: ${p.reason}${p.detail ? ' — ' + p.detail : ''}`);
