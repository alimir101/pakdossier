const base = 'http://127.0.0.1:8090';
for (const [p, want] of [['/', 200], ['/sw.js', 200], ['/healthz', 200]]) {
  const r = await fetch(base + p);
  console.log(`${r.status === want ? 'OK  ' : 'FAIL'} ${p.padEnd(12)} HTTP ${r.status} cc=${r.headers.get('cache-control')}`);
}
console.log('--- sidecar (owner path) ---');
try {
  const r = await fetch(base + '/api/lookup?number=03331234567', { signal: AbortSignal.timeout(150000) });
  const b = await r.json();
  const owner = (b.results ?? []).find(x => x.provider === 'pakdb');
  const why = (b.partial ?? []).find(p => p.provider === 'pakdb');
  console.log('lookup HTTP', r.status, 'results', b.results?.length);
  console.log(owner?.fields?.records?.length ? `OWNER LIVE: ${owner.fields.records[0].name} | ${owner.fields.records[0].cnic} | ${owner.fields.records[0].address}` : `pakdb: ${why?.reason} — ${why?.detail?.slice(0,70)}`);
} catch (e) { console.log('lookup ERR', e.message); }
