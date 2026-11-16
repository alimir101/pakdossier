import puppeteer from "puppeteer-core";
const SITE = "https://pakistandataba.se/databases/sim.php";
const v = await (await fetch("http://127.0.0.1:9222/json/version")).json();
for (const vp of [{ width: 1280, height: 900 }, null]) {
  const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 120000, ...(vp ? { defaultViewport: vp } : {}) });
  const page = await browser.newPage();
  if (!vp) { try { await page.setViewport({ width: 1280, height: 900 }); } catch (e) { console.log("setViewport ERR", e.message); } }
  await page.goto(SITE, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => console.log("goto:", e.message));
  let tok = 0;
  try {
    await page.waitForFunction(() => { const el = document.querySelector('input[name="cf-turnstile-response"]'); return !!(el && el.value && el.value.length > 20); }, { timeout: 45000, polling: 500 });
    tok = await page.$eval('input[name="cf-turnstile-response"]', (el) => el.value.length);
  } catch { tok = 0; }
  const meta = await page.evaluate(() => ({ vw: window.innerWidth, vh: window.innerHeight, iframes: document.querySelectorAll("iframe").length }));
  console.log(`viewport=${vp ? "set on connect" : "null-then-setViewport"} -> tokenLen=${tok} | innerW/H=${meta.vw}x${meta.vh} iframes=${meta.iframes}`);
  await page.close();
  browser.disconnect();
}
