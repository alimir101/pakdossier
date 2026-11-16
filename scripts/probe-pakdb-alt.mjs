/**
 * Is the .com mirror a separate deployment with its own throttle?
 * Node-fetch gets ECONNRESET there, so drive it through Obscura.
 */
import puppeteer from 'puppeteer-core';

const SITES = ['https://pakistandatabase.com/databases/sim.php', 'https://pakistandataba.se/databases/sim.php'];
const version = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const browser = await puppeteer.connect({ browserWSEndpoint: version.webSocketDebuggerUrl });
const page = await browser.newPage();

/** obscura's navigation flaps with QUIC errors — retry like the sidecar does */
async function goto(url, tries = 3) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      return await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 600 * i));
    }
  }
  throw last;
}

for (const url of SITES) {
  console.log(`\n=== ${url}`);
  try {
    const r = await goto(url);
    const html = await page.content();
    const sitekey = /data-sitekey="([^"]+)"/.exec(html)?.[1];
    console.log(`  status=${r?.status()} len=${html.length} sitekey=${sitekey ?? '-'}`);

    if (!sitekey) {
      console.log('  form nahi mila');
      continue;
    }

    await page.waitForFunction(
      () => {
        const el = document.querySelector('input[name="cf-turnstile-response"]');
        return !!(el && el.value && el.value.length > 20);
      },
      { timeout: 45000 },
    );
    const token = await page.$eval('input[name="cf-turnstile-response"]', (el) => el.value);
    console.log(`  token len=${token.length}`);

    const post = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        referer: url,
        origin: new URL(url).origin,
      },
      body: `search_query=03331234567&cf-turnstile-response=${encodeURIComponent(token)}`,
    });
    const body = await post.text();
    const text = body.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const state = /TOO MANY SEARCHES/i.test(text)
      ? 'LIMITED'
      : /TOTAL HITS/i.test(text)
        ? 'REPORT'
        : /VERIFICATION FAILED/i.test(text)
          ? 'VERIFY-FAILED'
          : 'UNKNOWN';
    console.log(`  POST status=${post.status} len=${body.length} -> ${state}`);
    if (state === 'REPORT') {
      const i = text.indexOf('TOTAL HITS');
      console.log('   ' + text.slice(i, i + 400));
    } else if (state === 'LIMITED') {
      console.log('   ' + /TOO MANY SEARCHES[^.]*/.exec(text)[0]);
    }
  } catch (e) {
    console.log(`  ERR ${String(e.message).slice(0, 120)}`);
  }
}

await page.close();
browser.disconnect();
