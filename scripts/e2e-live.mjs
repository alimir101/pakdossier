/**
 * End-to-end check against the app's own preview server:
 * the same process serves the PWA *and* mounts the real worker on /api.
 *
 * Run after `npm run preview` is up.  node scripts/e2e-live.mjs
 */
const base = 'http://localhost:4173';

async function hit(path, expect) {
  try {
    const r = await fetch(base + path, { signal: AbortSignal.timeout(30000) });
    const body = await r.text();
    const ok = r.status === expect;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${path} -> HTTP ${r.status} (wanted ${expect}) ${r.headers.get('x-pakdossier-cache') ?? ''}`);
    return { status: r.status, body };
  } catch (e) {
    console.log(`FAIL ${path} -> ${e.message}`);
    return { status: 0, body: '' };
  }
}

const index = await hit('/', 200);
console.log(`  index len=${index.body.length}, has bundle: ${/src="[^"]+\.js"/.test(index.body)}`);

const health = await hit('/api/health', 200);
try {
  const h = JSON.parse(health.body);
  console.log(`  service=${h.service} cache=${h.cache} keyless=${h.keyless} providers=${h.providers.length}`);
  console.log(`  leaked a secret? ${JSON.stringify(h).includes('KEY"')}`);
} catch {
  console.log('  health body not json');
}

const first = await hit('/api/lookup?number=03004439955', 200);
try {
  const b = JSON.parse(first.body);
  console.log(`  results=${b.results.length} partial=${b.partial.length} cached=${b.cached}`);
  for (const r of b.results) {
    console.log(`   - ${r.provider} [${r.carrierKind}/${r.confidence}] ${r.latencyMs}ms fields=${Object.keys(r.fields).join(',')}`);
    console.log(`     carrier=${r.fields.carrier} area=${r.fields.numberingArea} safe=${r.fields.safeReports} spam=${r.fields.spamReports}`);
  }
  console.log(`  skipped: ${b.partial.map((p) => `${p.provider}:${p.reason}`).join(', ')}`);
} catch {
  console.log('  lookup body not json');
}

await hit('/api/lookup?number=03004439955', 200).then((r) => {
  try {
    const b = JSON.parse(r.body);
    console.log(`  second call cached=${b.cached} (cache header above must say hit)`);
  } catch {
    /* ignore */
  }
});

await hit('/api/lookup?number=abc', 400);
await hit('/api/nope', 404);
