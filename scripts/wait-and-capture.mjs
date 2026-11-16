/**
 * Wait for the mirror's throttle window to open, then capture the LIVE proof:
 * sidecar report -> worker response -> the real UI in a browser (screenshot).
 *
 * Polling is nearly free: while the window is closed the sidecar replays the
 * throttle page without navigating, so only the successful poll costs a search.
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const SIDECAR = process.env.PAKDB_BROWSER_URL ?? 'http://127.0.0.1:8788';
const APP = process.env.APP_URL ?? 'http://localhost:4173';
const NUMBER = process.env.WATCH_NUMBER ?? '03331234567';
const DEADLINE = Date.now() + Number(process.env.WATCH_MS ?? 19 * 60_000);
const SHOTS = '.tools/shots';
mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pollSidecar() {
  const r = await fetch(`${SIDECAR}/pakdb?number=${NUMBER}`, { signal: AbortSignal.timeout(120000) });
  const j = await r.json();
  const flat = String(j.html ?? '').replace(/<[^>]+>/g, ' ');
  if (/TOTAL HITS/i.test(flat)) return { kind: 'report', j, flat };
  if (/TOO MANY SEARCHES/i.test(flat)) return { kind: 'limited', j, flat };
  return { kind: 'other', j, flat };
}

console.log(`waiting for the throttle window (deadline ${new Date(DEADLINE).toISOString()})…`);
let report = null;
while (Date.now() < DEADLINE) {
  let out;
  try {
    out = await pollSidecar();
  } catch (e) {
    console.log(`  poll error: ${e.message}`);
    await sleep(20_000);
    continue;
  }
  if (out.kind === 'report') {
    report = out;
    break;
  }
  const mins = /try again in (\d+)\s*minutes?/i.exec(out.flat)?.[1] ?? '?';
  console.log(`  still throttled (~${mins} min) — next poll in 40s`);
  await sleep(40_000);
}

if (!report) {
  console.log('deadline reached without a report');
  process.exitCode = 1;
}

const hits = /TOTAL HITS\s*(\d+)/i.exec(report.flat)?.[1];
console.log(`\n*** MIRROR ANSWERED (hits=${hits}) ***`);
const i = report.flat.indexOf('TOTAL HITS');
console.log(' ' + report.flat.slice(i, i + 420).trim());

// ---- worker path ---------------------------------------------------------
let workerOk = false;
try {
  const r = await fetch(`${APP}/api/lookup?number=${NUMBER}&fresh=1`, { signal: AbortSignal.timeout(180000) });
  const body = await r.json();
  const owner = (body.results ?? []).find((x) => x.provider === 'pakdb');
  if (owner?.fields?.records?.length) {
    workerOk = true;
    console.log(`\n*** WORKER PATH OK *** records=${owner.fields.records.length}`);
    for (const rec of owner.fields.records) console.log(`  ${rec.mobile} | ${rec.name} | ${rec.cnic} | ${rec.address}`);
  } else {
    const why = (body.partial ?? []).find((p) => p.provider === 'pakdb');
    console.log(`\nworker path: pakdb nahi aaya — ${JSON.stringify(why)}`);
  }
} catch (e) {
  console.log(`worker path error: ${e.message}`);
}

// ---- real UI -------------------------------------------------------------
if (workerOk) {
  const version = await (await fetch('http://127.0.0.1:9222/json/version')).json();
  const browser = await puppeteer.connect({
    browserWSEndpoint: version.webSocketDebuggerUrl,
    defaultViewport: { width: 430, height: 1100 },
  });
  const page = await browser.newPage();
  await page.goto(APP, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.click('input.input');
  await page.type('input.input', NUMBER, { delay: 15 });

  let uiOk = false;
  for (let t = 0; t < 30; t++) {
    await sleep(1000);
    const body = await page.evaluate(() => document.body.innerText);
    if (/CNIC mil gaya|CNIC found/.test(body)) {
      uiOk = true;
      console.log('\n*** UI SHOWS THE OWNER ***');
      const at = body.search(/CNIC mil gaya|CNIC found/);
      console.log(body.slice(Math.max(0, at - 120), at + 340).replace(/\n{2,}/g, '\n'));
      const unlocked = /7000/.test(body) && /668/.test(body);
      console.log(`official CNIC actions present: ${unlocked}`);
      break;
    }
  }
  await page.screenshot({ path: `${SHOTS}/app-live-owner.png`, fullPage: true });
  console.log(`screenshot -> ${SHOTS}/app-live-owner.png`);
  await page.close();
  browser.disconnect();
  console.log(uiOk ? '\nRESULT: live owner data reached the UI ✅' : '\nRESULT: worker ok but UI did not show the chip ❌');
  process.exitCode = uiOk ? 0 : 1;
} else {
  process.exitCode = 1;
}
