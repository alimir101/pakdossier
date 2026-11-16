/** Does the widget's child frame actually navigate and run its own JS? */
import puppeteer from 'puppeteer-core';

const SITE = 'https://pakistandataba.se/databases/sim.php';
const API = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const v = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 120000 });
const page = await browser.newPage();

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
if ((await page.evaluate(() => typeof window.turnstile).catch(() => 'err')) !== 'object') {
  await page.addScriptTag({ url: API }).catch((e) => console.log('inject ERR', e.message.slice(0, 80)));
}
await page.evaluate(() => {
  const el = document.querySelector('.cf-turnstile, [data-sitekey]');
  if (el && window.turnstile) { try { window.turnstile.render(el); } catch {} }
}).catch(() => {});

for (let i = 1; i <= 5; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const frames = page.frames();
  console.log(`\n--- t+${i * 5}s : ${frames.length} frame(s)`);
  for (const f of frames) {
    let info = {};
    try {
      info = await f.evaluate(() => ({
        ready: document.readyState,
        len: document.body ? document.body.innerHTML.length : -1,
        hasInput: !!document.querySelector('input,button,#challenge-stage,.cb-lb'),
      }));
    } catch (e) {
      info = { err: String(e.message).slice(0, 40) };
    }
    console.log(`   url=${f.url().slice(0, 80) || '(empty)'} ${JSON.stringify(info)}`);
  }
  const tok = await page.evaluate(() => document.querySelector('input[name="cf-turnstile-response"]')?.value?.length ?? 0);
  console.log(`   token=${tok}`);
  if (tok > 20) break;
}

await page.close();
browser.disconnect();
