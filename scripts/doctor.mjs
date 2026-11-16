/**
 * Health checks for every moving part, in one command.
 *
 *   npm run doctor            # fast: config + reachability, no searches
 *   npm run doctor -- --deep  # also does one real lookup (burns a mirror search)
 *
 * This project leans on flaky third-party sources (sites die, mirrors throttle,
 * obscura's navigation flaps), so "is everything plugged in?" deserves a single
 * command rather than a debugging session each time.
 */
import { existsSync, readFileSync } from 'node:fs';

const DEEP = process.argv.includes('--deep');
const OBSCURA = process.env.OBSCURA_HTTP ?? 'http://127.0.0.1:9222';
const SIDECAR = process.env.PAKDB_BROWSER_URL ?? 'http://127.0.0.1:8788';
const MIRROR = 'https://pakistandataba.se/databases/sim.php';

const rows = [];
const record = (name, status, detail, hint) => {
  rows.push({ name, status, detail, hint });
  const mark = status === 'ok' ? 'OK  ' : status === 'warn' ? 'WARN' : 'FAIL';
  console.log(`${mark} ${name.padEnd(38)} ${detail}${hint && status !== 'ok' ? `\n     → ${hint}` : ''}`);
};

async function probe(url, timeout = 8000) {
  const started = Date.now();
  const r = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  return { status: r.status, ms: Date.now() - started, text: await r.text() };
}

// ---- config ---------------------------------------------------------------
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
record('package.json', pkg.name === 'pakdossier' ? 'ok' : 'warn', `name=${pkg.name} v${pkg.version}`);
record('build output (dist/)', existsSync('dist/index.html') ? 'ok' : 'warn', existsSync('dist') ? 'present' : 'missing', 'npm run build');

const secretish = ['IPQS_KEY', 'VERIPHONE_KEY', 'NUMLOOKUPAPI_KEY', 'ABSTRACTAPI_KEY', 'NUMVERIFY_KEY'];
const present = secretish.filter((k) => process.env[k]);
record(
  'free provider keys (optional)',
  present.length ? 'ok' : 'warn',
  present.length ? `${present.length}/${secretish.length} set` : 'none set',
  'app still works: one keyless provider + the offline engine',
);

// ---- obscura (browser engine) ---------------------------------------------
let obscuraOk = false;
try {
  const v = await probe(`${OBSCURA}/json/version`);
  const parsed = JSON.parse(v.text);
  obscuraOk = true;
  record('obscura CDP', 'ok', `${parsed.Browser} @ ${OBSCURA} (${v.ms}ms)`);
} catch (e) {
  record('obscura CDP', 'fail', `${OBSCURA} unreachable`, 'npm run dev:obscura  (or npm run setup:obscura first)');
}

// ---- sidecar --------------------------------------------------------------
let sidecarOk = false;
if (!obscuraOk) {
  record('sidecar', 'warn', 'skipped (no obscura)', 'sidecar needs a browser');
} else {
  try {
    const h = await probe(`${SIDECAR}/healthz`);
    const parsed = JSON.parse(h.text);
    sidecarOk = true;
    record('sidecar', 'ok', `${(parsed.sites ?? []).length} host(s) configured @ ${SIDECAR}`);
  } catch (e) {
    record('sidecar', 'fail', `${SIDECAR} unreachable`, 'npm run dev:sidecar');
  }
}

// ---- mirror ---------------------------------------------------------------
try {
  const r = await probe(MIRROR, 20000);
  const hasTurnstile = /cf-turnstile/.test(r.text);
  record('mirror reachable (form)', r.status === 200 && hasTurnstile ? 'ok' : 'warn', `HTTP ${r.status}, turnstile=${hasTurnstile}`);
} catch (e) {
  record('mirror reachable (form)', 'fail', String(e.cause?.code ?? e.message), 'owner-name feature needs this host');
}

// ---- deep: one real lookup ------------------------------------------------
if (DEEP && sidecarOk) {
  try {
    const r = await fetch(`${SIDECAR}/pakdb?number=03331234567`, { signal: AbortSignal.timeout(150000) });
    const j = await r.json();
    const flat = String(j.html ?? '').replace(/<[^>]+>/g, ' ');
    if (/TOO MANY SEARCHES/i.test(flat)) {
      const mins = /try again in (\d+)/i.exec(flat)?.[1];
      record('deep: mirror search', 'warn', `throttled — ${mins} min baad`, 'per-network limit; cache + cooldown handle it');
    } else if (/TOTAL HITS/i.test(flat)) {
      record('deep: mirror search', 'ok', `report ok, attempts=${j.attempts}, ${j.ms}ms`);
    } else {
      record('deep: mirror search', 'warn', j.reason ?? 'unknown shape', j.detail ?? '');
    }
  } catch (e) {
    record('deep: mirror search', 'fail', String(e.message).slice(0, 80));
  }
} else if (DEEP) {
  record('deep: mirror search', 'warn', 'skipped', 'sidecar down');
}

// ---- official portals (a sample, not all 23) ------------------------------
const sample = [
  'https://cnic.sims.pk/',
  'https://mtmis.excise.punjab.gov.pk/',
  'https://e.fbr.gov.pk/esbn/Verification',
];
let portalOk = 0;
for (const url of sample) {
  try {
    const r = await probe(url, 20000);
    if (r.status >= 200 && r.status < 400) portalOk++;
  } catch {
    /* counted as not ok */
  }
}
record('official portals (3 sampled)', portalOk === sample.length ? 'ok' : 'warn', `${portalOk}/${sample.length} responsive`);

// ---- summary --------------------------------------------------------------
const fails = rows.filter((r) => r.status === 'fail').length;
const warns = rows.filter((r) => r.status === 'warn').length;
console.log(`\n${rows.length} checks: ${rows.length - fails - warns} ok, ${warns} warn, ${fails} fail`);
if (fails) console.log('FAIL = cheez chalegi nahi. WARN = chalegi magar adhoori.');
process.exitCode = fails ? 1 : 0;
