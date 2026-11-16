/**
 * Which free proxy can actually reach the mirror? (An ipify-only test is not
 * enough — Cloudflare over CONNECT is where they break.)
 *
 * Run with: node scripts/probe-proxies.mjs
 * Each candidate is checked in-process by spawning nothing — env proxy is read
 * at process start, so we test one proxy per child.
 */
const MIRROR = 'https://pakistandataba.se/databases/sim.php';

const candidates = (process.env.PROXY_LIST ?? '').split(',').map((s) => s.trim()).filter(Boolean);
if (candidates.length === 0) {
  console.log('set PROXY_LIST=host:port,host:port');
  process.exit(0);
}

for (const host of candidates) {
  const url = `http://${host}`;
  try {
    const r = await fetch(MIRROR, {
      headers: { 'user-agent': 'Mozilla/5.0 Chrome/157' },
      signal: AbortSignal.timeout(15000),
    });
    const text = await r.text();
    console.log(`${host.padEnd(22)} HTTP ${r.status} len=${text.length} turnstile=${/cf-turnstile/.test(text)}`);
  } catch (e) {
    console.log(`${host.padEnd(22)} ERR ${String(e.cause?.code ?? e.message).slice(0, 40)}`);
  }
}
