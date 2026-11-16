/** Broad diagnosis: what does the headless browser actually get from the site? */
import puppeteer from 'puppeteer-core';

const SITE = 'https://pakistandataba.se/databases/sim.php';
const v = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 120000 });
const page = await browser.newPage();

const net = [];
page.on('response', (r) => { if (/turnstile|challenge|cdn-cgi/i.test(r.url())) net.push(`${r.status()} ${r.url().slice(0, 90)}`); });
page.on('requestfailed', (r) => { if (/turnstile|challenge/i.test(r.url())) net.push(`FAIL ${r.url().slice(0, 90)} :: ${r.failure()?.errorText}`); });

// try 'load' this time instead of domcontentloaded
let navErr = '';
try {
  await page.goto(SITE, { waitUntil: 'load', timeout: 55000 });
} catch (e) {
  navErr = e.message;
}
console.log('nav:', navErr || 'load fired OK');
await new Promise((r) => setTimeout(r, 15000));

const snap = await page.evaluate(() => ({
  title: document.title,
  readyState: document.readyState,
  turnstile: typeof window.turnstile,
  hidden: document.querySelector('input[name="cf-turnstile-response"]')?.value?.length ?? -1,
  frames: window.frames.length,
  body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 200),
  cfMarker: /just a moment|verifying you are human|checking your browser|enable javascript and cookies/i.test(document.documentElement.innerHTML),
}));
console.log('snapshot:', JSON.stringify(snap, null, 1));
console.log('cookies:', (await page.cookies()).map((c) => `${c.name}(${c.domain})`).join(' ') || '(none)');
console.log('net:', net.slice(0, 10).join('\n     ') || '(none)');

// does a cookie-only POST (no token) get accepted?
const ck = (await page.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
if (ck) {
  const html = await page.evaluate(async (url, cookie) => {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie }, body: 'search_query=03331234567&cf-turnstile-response=' });
    return (await r.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200);
  }, SITE, ck).catch((e) => 'ERR ' + e.message);
  console.log('cookie-only POST ->', html);
}

await page.close();
browser.disconnect();
