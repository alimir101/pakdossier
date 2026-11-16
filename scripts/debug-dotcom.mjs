import puppeteer from "puppeteer-core";
const v = await (await fetch("http://127.0.0.1:9222/json/version")).json();
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 150000, defaultViewport: { width: 1280, height: 900 } });
for (const site of ["https://pakistandatabase.com/databases/sim.php", "https://pakistandataba.se/databases/sim.php"]) {
  const page = await browser.newPage();
  await page.goto(site, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => console.log("  goto:", e.message));
  let tok = 0;
  try {
    await page.waitForFunction(() => { const el = document.querySelector('input[name="cf-turnstile-response"]'); return !!(el && el.value && el.value.length > 20); }, { timeout: 40000, polling: 500 });
    tok = await page.$eval('input[name="cf-turnstile-response"]', (el) => el.value.length);
  } catch {}
  console.log(`${new URL(site).host}: tokenLen=${tok} iframes=${await page.evaluate(() => document.querySelectorAll("iframe").length)}`);
  if (tok > 20) {
    const out = await page.evaluate(async (url) => {
      const el = document.querySelector('input[name="cf-turnstile-response"]');
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: `search_query=03331234567&cf-turnstile-response=${encodeURIComponent(el.value)}` });
      const t = (await r.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      return /TOO MANY/i.test(t) ? "LIMITED" : /TOTAL HITS/i.test(t) ? "REPORT " + (t.match(/TOTAL HITS\s*\d+/i) ?? [""])[0] : "other";
    }, site);
    console.log("  in-page POST ->", out);
  }
  await page.close();
}
browser.disconnect();
