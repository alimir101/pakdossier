// Is challenges.cloudflare.com reachable from this machine at all?
const t0 = Date.now();
try {
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/api.js', { signal: AbortSignal.timeout(25000) });
  const b = await r.text();
  console.log(`node fetch: HTTP ${r.status} in ${Date.now() - t0}ms len=${b.length}`);
} catch (e) { console.log('node fetch ERR', Date.now() - t0, e.cause?.code ?? e.message); }
// and through obscura (a page that only loads that script)
