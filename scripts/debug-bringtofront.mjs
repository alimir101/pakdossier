import puppeteer from "puppeteer-core";
const SITE = "https://pakistandataba.se/databases/sim.php";
const v = await (await fetch("http://127.0.0.1:9222/json/version")).json();
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, protocolTimeout: 150000, defaultViewport: { width: 1280, height: 900 } });
const page = await browser.newPage();
try { await page.bringToFront(); console.log("bringToFront ok"); } catch (e) { console.log("bringToFront ERR", e.message); }
await page.goto(SITE, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => console.log("goto:", e.message));
console.log("visibility:", await page.evaluate(() => document.visibilityState), "hidden:", await page.evaluate(() => document.hidden));
try { await page.bringToFront(); } catch {}
let tok = 0;
try {
  await page.waitForFunction(() => { const el = document.querySelector('input[name="cf-turnstile-response"]'); return !!(el && el.value && el.value.length > 20); }, { timeout: 60000, polling: 500 });
  tok = await page.$eval('input[name="cf-turnstile-response"]', (el) => el.value.length);
} catch { tok = 0; }
console.log("tokenLen after bringToFront:", tok, "| iframes:", await page.evaluate(() => document.querySelectorAll("iframe").length));
await page.close(); browser.disconnect();
