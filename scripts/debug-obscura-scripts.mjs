/** Can obscura load/execute external scripts at all right now? */
import puppeteer from 'puppeteer-core';

const v = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 120000 });

async function test(name, fn) {
  const page = await browser.newPage();
  const events = [];
  page.on('response', (r) => { if (/api\.js|jsdelivr|turnstile/.test(r.url())) events.push(`resp ${r.status()} ${r.url().slice(0, 70)}`); });
  page.on('requestfailed', (r) => events.push(`FAIL ${r.url().slice(0, 70)} :: ${r.failure()?.errorText}`));
  page.on('pageerror', (e) => events.push(`err ${String(e).slice(0, 100)}`));
  try {
    const out = await fn(page);
    console.log(`\n=== ${name}\n`, typeof out === 'string' ? out : JSON.stringify(out));
  } catch (e) {
    console.log(`\n=== ${name}\n ERR ${e.message}`);
  }
  if (events.length) console.log('  events:', events.slice(0, 6).join(' | '));
  await page.close();
}

// 1. real site: does the script element ever get an exec?
await test('real site: script executed?', async (page) => {
  await page.goto('https://pakistandataba.se/databases/sim.php', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => e.message);
  await new Promise((r) => setTimeout(r, 15000));
  return page.evaluate(() => ({
    turnstile: typeof window.turnstile,
    scriptTags: document.querySelectorAll('script[src*="turnstile"]').length,
  }));
});

// 2. minimal page with the same script
await test('minimal page + turnstile api.js', async (page) => {
  await page.setContent(
    `<!doctype html><html><body><div class="cf-turnstile" data-sitekey="0x4AAAAAADMujqAjT0iboJUw"></div>
     <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script></body></html>`,
    { waitUntil: 'domcontentloaded', timeout: 30000 },
  ).catch((e) => e.message);
  await new Promise((r) => setTimeout(r, 15000));
  return page.evaluate(() => ({ turnstile: typeof window.turnstile }));
});

// 3. a different CDN script, to see if it is turnstile-specific
await test('minimal page + jsdelivr script', async (page) => {
  await page.setContent(
    `<!doctype html><html><body><div id="x"></div>
     <script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js" onload="window.__loaded=true"></script></body></html>`,
    { waitUntil: 'domcontentloaded', timeout: 30000 },
  ).catch((e) => e.message);
  await new Promise((r) => setTimeout(r, 10000));
  return page.evaluate(() => ({ loaded: !!window.__loaded, marked: typeof window.marked }));
});

// 4. plain network from inside the page
await test('in-page fetch to challenges.cloudflare.com', async (page) => {
  await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => e.message);
  return page.evaluate(async () => {
    try {
      const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/api.js');
      return { status: r.status, len: (await r.text()).length };
    } catch (e) {
      return { error: String(e) };
    }
  });
});

browser.disconnect();
