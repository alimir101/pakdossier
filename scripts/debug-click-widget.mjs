/**
 * Hypothesis: the challenge has escalated to INTERACTIVE, so no token appears
 * until the widget is clicked. Test: wait, click the widget, wait again.
 */
import puppeteer from 'puppeteer-core';

const SITE = 'https://pakistandataba.se/databases/sim.php';
const v = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 120000 });
const page = await browser.newPage();

const tokenLen = () =>
  page.evaluate(() => document.querySelector('input[name="cf-turnstile-response"]')?.value?.length ?? 0);

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => console.log('goto:', e.message));
await page.waitForFunction(() => typeof window.turnstile === 'object', { timeout: 15000, polling: 200 }).catch(() => console.log('no turnstile api'));

// give the widget a moment to mount
await new Promise((r) => setTimeout(r, 4000));
console.log('frames after load:', page.frames().length, page.frames().map((f) => f.url().slice(0, 50)).join(' | '));
console.log('token before click:', await tokenLen());

const box = await page.evaluate(() => {
  const el = document.querySelector('.cf-turnstile, [data-sitekey]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
console.log('widget box:', JSON.stringify(box));

if (box && box.w > 0) {
  // realistic click inside the widget (checkbox area is left of centre)
  const cx = box.x + Math.min(40, box.w / 3);
  const cy = box.y + (box.h > 0 ? box.h / 2 : 30);
  try {
    await page.mouse.move(cx - 40, cy - 10);
    await page.mouse.move(cx, cy, { steps: 8 });
    await page.mouse.click(cx, cy);
    console.log(`clicked at ${Math.round(cx)},${Math.round(cy)}`);
  } catch (e) {
    console.log('click ERR', e.message);
  }
} else if (box) {
  // zero-height container: click the widget's own coordinates from its rect origin
  try {
    await page.mouse.click(box.x + 30, box.y + 30);
    console.log('clicked zero-height container');
  } catch (e) {
    console.log('click ERR', e.message);
  }
}

for (let i = 1; i <= 8; i++) {
  await new Promise((r) => setTimeout(r, 4000));
  const len = await tokenLen();
  const frames = page.frames().length;
  console.log(`t+${i * 4}s tokenLen=${len} frames=${frames}`);
  if (len > 20) {
    const tok = await page.$eval('input[name="cf-turnstile-response"]', (el) => el.value.slice(0, 24));
    console.log(`*** TOKEN after click: len=${len} head=${tok}…`);
    break;
  }
}

await page.close();
browser.disconnect();
