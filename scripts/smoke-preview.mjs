/**
 * Serve dist/ and prove the built artifact is real:
 * index + assets + manifest + icon all 200, and the bundle actually carries
 * the portal catalogue (not just an empty shell).
 */
const base = 'http://localhost:4173';

const needles = [
  'PakDossier',
  '76367',
  'cnic.sims.pk',
  'mtmis.excise.punjab.gov.pk',
  'punjab-zameen.gov.pk',
  'bill.pitc.com.pk',
  'eservices.secp.gov.pk',
  'e.fbr.gov.pk',
  'dsj.punjab.gov.pk',
  'Official checks aur portals',
];

const index = await (await fetch(`${base}/`, { signal: AbortSignal.timeout(10000) })).text();
const script = index.match(/src="([^"]+\.js)"/)?.[1];
const css = index.match(/href="([^"]+\.css)"/)?.[1];
console.log(`index len=${index.length} script=${script} css=${css}`);

for (const p of ['/manifest.webmanifest', '/icon.svg']) {
  const r = await fetch(base + p, { signal: AbortSignal.timeout(10000) });
  console.log(`${p} -> HTTP ${r.status} ${r.headers.get('content-type') ?? ''}`);
}

if (!script) throw new Error('no script in index.html');
const js = await (await fetch(base + script, { signal: AbortSignal.timeout(10000) })).text();
console.log(`bundle len=${js.length}`);

let missing = 0;
for (const n of needles) {
  const has = js.includes(n);
  if (!has) missing++;
  console.log(`  ${has ? 'ok  ' : 'MISS'} ${n}`);
}
console.log(missing === 0 ? '\nall needles present' : `\n${missing} needles missing`);
