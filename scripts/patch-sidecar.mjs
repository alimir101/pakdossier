import { readFileSync } from 'node:fs';
const f = 'tools/pakdb-sidecar.mjs';
const t = readFileSync(f, 'utf8');
const fixes = [
  [`  if (url.pathname === '/healthz') {\n    return send(res, 200, { ok: true, cdp: CDP_HTTP, attached: !!browser?.connected, site: SITE });`,
   `  if (url.pathname === '/healthz') {\n    return send(res, 200, { ok: true, cdp: CDP_HTTP, attached: !!browser?.connected, sites: SITES });`],
  [`      await ensureBrowser();\n      await mintToken();`, `      await ensureBrowser();\n      await mintToken(SITES[0]);`],
];
let out = t;
for (const [a, b] of fixes) { if (!out.includes(a)) console.log('anchor nahi mila:', a.slice(0, 60)); out = out.replace(a, b); }
require('node:fs');
