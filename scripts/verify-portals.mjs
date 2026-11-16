/**
 * Verify every URL in the portal catalogue actually resolves today.
 * Run: node scripts/verify-portals.mjs
 *
 * Honest output: a 403/CAPTCHA is reported as such, not as a pass.
 */
import { readFileSync } from 'node:fs';
import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

const file = JSON.parse(readFileSync('src/data/portals.json', 'utf8'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

const rows = [];
for (const e of file.entries) {
  if (e.kind !== 'url') continue;
  const host = new URL(e.url).hostname;
  let dnsOk = true;
  try {
    await dns.promises.resolve4(host);
  } catch {
    dnsOk = false;
  }
  if (!dnsOk) {
    rows.push([e.id, host, 'DNS-FAIL']);
    continue;
  }
  try {
    const r = await fetch(e.url, { headers: { 'user-agent': UA, accept: 'text/html,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
    const body = await r.text();
    const cloudflare = /just a moment|cf-chl|cloudflare/i.test(body.slice(0, 4000));
    rows.push([e.id, host, `HTTP ${r.status}${cloudflare ? ' (cloudflare challenge)' : ''} len=${body.length}`]);
  } catch (err) {
    rows.push([e.id, host, `FAIL ${err.cause?.code || err.message}`]);
  }
}

rows.sort((a, b) => a[0].localeCompare(b[0]));
let ok = 0;
for (const [id, host, status] of rows) {
  if (/^HTTP 2\d\d/.test(status)) ok++;
  console.log(`${status.startsWith('HTTP 2') ? 'OK  ' : '!!  '} ${id.padEnd(20)} ${host.padEnd(34)} ${status}`);
}
console.log(`\n${ok}/${rows.length} url entries returned 2xx`);
