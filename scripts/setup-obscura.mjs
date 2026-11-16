/**
 * Download + unpack the Obscura Windows build into .tools/obscura.
 * Run: node scripts/setup-obscura.mjs
 */
import { createWriteStream, existsSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const VERSION = 'v0.2.7';
const ASSET = 'obscura-x86_64-windows-stealth.zip';
const URL_ = `https://github.com/h4ckf0r0day/obscura/releases/download/${VERSION}/${ASSET}`;
const DIR = '.tools';
const ZIP = `${DIR}/${ASSET}`;

mkdirSync(DIR, { recursive: true });

if (existsSync(ZIP) && statSync(ZIP).size > 40 * 1024 * 1024) {
  console.log(`zip already present (${(statSync(ZIP).size / 1048576).toFixed(1)}MB) — skipping download`);
} else {
  console.log(`downloading ${URL_}`);
  const t0 = Date.now();
  const r = await fetch(URL_, { redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const total = Number(r.headers.get('content-length') ?? 0);
  let seen = 0;
  const body = Readable.fromWeb(r.body);
  body.on('data', (c) => {
    seen += c.length;
    if (total && seen % (10 * 1024 * 1024) < c.length) {
      process.stdout.write(`  ${(seen / 1048576).toFixed(0)}/${(total / 1048576).toFixed(0)}MB\r`);
    }
  });
  await pipeline(body, createWriteStream(ZIP));
  console.log(`\ndownloaded ${(seen / 1048576).toFixed(1)}MB in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

const out = `${DIR}/obscura`;
if (!existsSync(out) || readdirSync(out).length === 0) {
  console.log(`extracting to ${out}`);
}
