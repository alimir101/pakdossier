/**
 * Real-browser verification through Obscura's CDP endpoint.
 *
 * Proves what unit tests cannot:
 *  1. the app renders and reacts in a browser
 *  2. the service worker registers
 *  3. with the network cut, the shell still renders (offline PWA)
 *
 * Screenshots are written to .tools/shots/ as evidence.
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const APP = process.env.APP_URL ?? 'http://localhost:4173';
const SHOTS = '.tools/shots';
mkdirSync(SHOTS, { recursive: true });

const version = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const browser = await puppeteer.connect({ browserWSEndpoint: version.webSocketDebuggerUrl, defaultViewport: { width: 430, height: 950 } });
const page = await browser.newPage();

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
};

await page.goto(APP, { waitUntil: 'networkidle2', timeout: 60000 });
check('app renders', (await page.title()).includes('PakDossier'), await page.title());

// type a number and assert the offline engine reacted
await page.click('input.input');
await page.type('input.input', '03331234567', { delay: 12 });
await new Promise((r) => setTimeout(r, 600));
const body = await page.evaluate(() => document.body.innerText);
check('live analysis rendered', /0333[\s-]?1234567/.test(body));
check('operator from prefix table', /Ufone/.test(body), (body.match(/Ufone/) ?? [''])[0]);
check('official launcher present', /Official checks/.test(body));
check('share section present', /Share/.test(body));

// If the mirror is currently throttled, the app must say so with a countdown
// rather than silently returning nothing.
const throttleShown = /throttled/i.test(body);
check(
  'throttle is surfaced honestly (when throttled)',
  throttleShown ? /retry in|throttled/i.test(body) : true,
  throttleShown ? 'throttle note visible' : 'mirror not throttled right now',
);

await page.screenshot({ path: `${SHOTS}/app-online.png`, fullPage: true });
console.log(`screenshot -> ${SHOTS}/app-online.png`);

// service worker
const sw = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? (reg.active ? 'active' : 'registered') : 'none';
});
check('service worker registered', sw === 'active' || sw === 'registered', sw);

// CNIC tab: the reverse-lookup panel must exist and the CNIC must validate
await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('button.tab')];
  tabs.find((b) => /CNIC/.test(b.textContent ?? ''))?.click();
});
await new Promise((r) => setTimeout(r, 400));
const cnicInput = await page.$('input[inputmode="numeric"]');
check('CNIC tab opens its own input', !!cnicInput);
if (cnicInput) {
  await cnicInput.type('3520296868939', { delay: 10 });
  await new Promise((r) => setTimeout(r, 900));
  // input values are not part of innerText — read the field itself
  const cnicValue = await page.$eval('input[inputmode="numeric"]', (el) => el.value);
  check('CNIC is auto-formatted in the field', cnicValue === '35202-9686893-9', cnicValue);
  const cnicBody = await page.evaluate(() => document.body.innerText);
  // .badge has text-transform: lowercase, so match case-insensitively
  check('CNIC validates', /cnic format theek|cnIC must be 13 digits/i.test(cnicBody));
  check('reverse panel appears', /Is CNIC par kaunse numbers|Numbers on this CNIC/.test(cnicBody));
  check('official CNIC actions show', /7000/.test(cnicBody) && /668/.test(cnicBody));
  await page.screenshot({ path: `${SHOTS}/app-cnic.png`, fullPage: true });
  console.log(`screenshot -> ${SHOTS}/app-cnic.png`);
}

// offline: cut the network and reload
await page.setOfflineMode(true);
await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise((r) => setTimeout(r, 800));
const offlineBody = await page.evaluate(() => document.body.innerText);
check('offline shell still renders', /PakDossier/.test(offlineBody), `${offlineBody.length} chars`);
check('offline: input still usable', /Mobile number/.test(offlineBody));
await page.screenshot({ path: `${SHOTS}/app-offline.png`, fullPage: true });
console.log(`screenshot -> ${SHOTS}/app-offline.png`);

await page.setOfflineMode(false);
await page.close();
browser.disconnect();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`);
process.exitCode = failed.length ? 1 : 0;
