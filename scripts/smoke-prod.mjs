const base = 'http://127.0.0.1:8090';
const checks = [
  ['/', 200], ['/healthz', 200], ['/api/health', 200], ['/manifest.webmanifest', 200], ['/sw.js', 200], ['/nope.js', 404]
];
for (const [p, want] of checks) {
  try {
    const r = await fetch(base + p, { signal: AbortSignal.timeout(10000) });
    const b = await r.text();
    console.log(`${r.status === want ? 'OK  ' : 'FAIL'} ${p.padEnd(24)} HTTP ${r.status} (want ${want}) len=${b.length} cc=${r.headers.get('cache-control') ?? '-'}`);
    if (p === '/') console.log('   csp:', (r.headers.get('content-security-policy') ?? '-').slice(0, 60) + '…');
  } catch (e) { console.log(`FAIL ${p} -> ${e.message}`); }
}
const r = await fetch(base + '/api/lookup?number=03331234567', { signal: AbortSignal.timeout(60000) });
const b = await r.json();
const owner = (b.results ?? []).find(x => x.provider === 'pakdb');
console.log(`\n/api/lookup -> HTTP ${r.status} results=${b.results?.length} partial=${b.partial?.length}`);
console.log(owner?.fields?.records?.length ? `OWNER OK: ${owner.fields.records[0].name} | ${owner.fields.records[0].cnic}` : 'owner: none');
const inv = await fetch(base + '/api/lookup?number=abc');
console.log('/api/lookup?number=abc ->', inv.status);
