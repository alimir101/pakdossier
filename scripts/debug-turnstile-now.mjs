/** Why is the Turnstile widget not producing a token now? */
import puppeteer from 'puppeteer-core';

const SITE = 'https://pakistandataba.se/databases/sim.php';
const v = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 120000 });
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`console:${m.type()}:${m.text().slice(0, 120)}`));
page.on('pageerror', (e) => logs.push(`pageerror:${String(e).slice(0, 160)}`));
page.on('requestfailed', (r) => logs.push(`reqfail:${r.url().slice(0, 90)} :: ${r.failure()?.errorText}`));

try {
  const resp = await page.goto(SITE, { waitUntil: 'load', timeout: 90000 });
  console.log('goto status', resp?.status());
} catch (e) {
  console.log('goto ERR', e.message);
}
await new Promise((r) => setTimeout(r, 20000));

const info = await page.evaluate(() => ({
  title: document.title,
  hasWidgetDiv: !!document.querySelector('.cf-turnstile'),
  hasHiddenInput: !!document.querySelector('input[name="cf-turnstile-response"]'),
  hiddenValueLen: document.querySelector('input[name="cf-turnstile-response"]')?.value?.length ?? -1,
  turnstileGlobal: typeof window.turnstile,
  scripts: [...document.querySelectorAll('script[src]')].map((s) => s.src).filter((s) => /challenge|turnstile/i.test(s)),
  bodyStart: document.body.innerText.replace(/\s+/g, ' ').slice(0, 220),
  cfChallenge: /just a moment|checking your browser|cf-chl/i.test(document.documentElement.innerHTML),
}));
console.log(JSON.stringify(info, null, 2));
console.log('--- events ---');
for (const l of logs.slice(0, 25)) console.log(' ', l);

await page.close();
browser.disconnect();
