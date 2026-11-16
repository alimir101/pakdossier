/**
 * PakDossier sidecar — the only piece that needs a real browser.
 *
 * Why it exists: pakistandataba.se protects its search with a Cloudflare
 * Turnstile widget whose sitekey is domain-restricted to their own host, so a
 * PWA on our origin cannot mint a token. We mint it on their page (through
 * Obscura's CDP endpoint) and reuse it from a plain fetch.
 *
 * Start Obscura first:   npm run dev:obscura
 * Then:                  npm run dev:sidecar
 * Endpoints:             GET /healthz   GET /pakdb?number=0300...
 *
 * Returns the raw report HTML; parsing lives in the worker so there is exactly
 * one parser.
 */
import { createServer } from 'node:http';

/**
 * JUGAAD: a bot-shaped headless browser makes Cloudflare's widget overrun and
 * then fail its interactive attempt. puppeteer-extra's stealth plugin patches the
 * usual automation tells, which is the standard fix. Falls back to puppeteer-core
 * when the plugin is not installed.
 */
let puppeteer;
let stealthOn = false;
try {
  const { default: pptr } = await import('puppeteer-extra');
  const { default: stealth } = await import('puppeteer-extra-plugin-stealth');
  pptr.use(stealth());
  puppeteer = pptr;
  stealthOn = true;
} catch {
  puppeteer = (await import('puppeteer-core')).default;
}
console.log(`[sidecar] puppeteer: ${stealthOn ? 'puppeteer-extra + stealth' : 'puppeteer-core (no stealth)'}`);

const PORT = Number(process.env.PAKDB_SIDECAR_PORT ?? 8788);
const CDP_HTTP = process.env.OBSCURA_HTTP ?? 'http://127.0.0.1:9222';
const CDP_TOKEN = process.env.OBSCURA_CDP_TOKEN;
const ATTEMPTS = Number(process.env.PAKDB_ATTEMPTS ?? 2);
/** whole-search budget: Cloudflare closes the origin at ~100s, so finish earlier */
const BUDGET_MS = Number(process.env.PAKDB_BUDGET_MS ?? 140_000);
/** how long to keep waiting for a widget token (this site's widget is very slow) */
const TOKEN_WAIT_MS = Number(process.env.PAKDB_TOKEN_WAIT_MS ?? 95_000);
const CACHE_TTL_MS = Number(process.env.PAKDB_CACHE_MS ?? 30 * 60 * 1000);
const cache = new Map();

/**
 * The mirror tells us when it will answer again. Remember it and stop navigating
 * the browser until then — probing during the window is pure waste.
 */
let limitedUntil = 0;
/** last throttle page, replayed while the window is closed (parser expects it) */
let limitedHtml = '<p>TOO MANY SEARCHES from your network — try again in 5 minutes.</p>';

/**
 * Two hosts, same backend, same Turnstile sitekey:
 *  - .se answers a plain node fetch, so it is the fast path
 *  - .com needs the POST issued from inside the page (node gets ECONNRESET)
 * Keeping both means one going down does not take the feature with it.
 * These sites die often — that is a lesson from the earlier research.
 */
const SITES = (process.env.PAKDB_SITES ?? 'https://pakistandataba.se/databases/sim.php,https://pakistandatabase.com/databases/sim.php')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36';

/** 0300-1234567 / +92 300 1234567 / 923001234567 -> 923001234567 */
export function to92(input) {
  const d = String(input ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('92')) return d;
  if (d.length === 11 && d.startsWith('0')) return `92${d.slice(1)}`;
  if (d.length === 10 && d.startsWith('3')) return `92${d}`;
  return undefined;
}

/** The same endpoint answers both: a mobile number OR a 13-digit CNIC. */
export function normalizeQuery(input) {
  const d = String(input ?? '').replace(/\D/g, '');
  if (d.length === 13) return { value: d, kind: 'cnic' };
  const n = to92(d);
  return n ? { value: n, kind: 'number' } : undefined;
}

let browser = null;
let page = null;

async function ensureBrowser() {
  if (browser?.connected && page && !page.isClosed()) return;
  const headers = CDP_TOKEN ? { Authorization: `Bearer ${CDP_TOKEN}` } : {};
  const response = await fetch(`${CDP_HTTP}/json/version`, { headers, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`browser discovery returned HTTP ${response.status}`);
  const v = await response.json();
  // obscura reports its own host/port; rewrite to the address we actually dialled
  const endpoint = new URL(v.webSocketDebuggerUrl);
  const origin = new URL(CDP_HTTP);
  endpoint.hostname = origin.hostname;
  endpoint.port = origin.port || endpoint.port;
  browser = await puppeteer.connect({ browserWSEndpoint: endpoint.href, headers, protocolTimeout: 90_000 });
  page = await browser.newPage();
  console.log(`[sidecar] attached to ${v.Browser}`);
}

/** obscura's navigation flaps (QUIC/protocol errors) — retry before giving up. */
async function gotoRetry(url, tries = 3) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      return;
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 700 * i));
    }
  }
  throw last;
}

const SITE_TURNSTILE_API = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

/**
 * The page's own `<script src=…turnstile…>` sometimes never fires in a headless
 * engine, so `window.turnstile` stays undefined and the widget never mounts.
 * Injecting it over CDP provably works (~1.4s), so do that as a fallback.
 */
async function ensureTurnstileApi() {
  const t = await page.evaluate(() => typeof window.turnstile).catch(() => 'err');
  if (t === 'object' || t === 'function') return true;
  await page.addScriptTag({ url: SITE_TURNSTILE_API }).catch(() => {});
  const after = await page.evaluate(() => typeof window.turnstile).catch(() => 'err');
  return after === 'object' || after === 'function';
}

/**
 * Click the widget where it actually is. The container measures 0px high, so
 * guessed coordinates miss; the iframe's own box is the reliable target, and
 * `frame.click('body')` is the fallback.
 */
async function clickWidget() {
  const frame = page.frames().find((f) => /turnstile|challenge-platform/i.test(f.url()));
  if (!frame) return false;
  try {
    const el = await frame.frameElement();
    const box = await el.boundingBox();
    if (box && box.width > 4) {
      const x = box.x + Math.min(28, box.width / 3);
      const y = box.y + box.height / 2;
      await page.mouse.move(x - 60, y - 20);
      await page.mouse.move(x, y, { steps: 6 });
      await page.mouse.down();
      await new Promise((r) => setTimeout(r, 90));
      await page.mouse.up();
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    await frame.click('body');
    return true;
  } catch {
    return false;
  }
}
async function pokeWidgetFrame() {
  const frame = page.frames().find((f) => /challenge-platform|turnstile\/v0/i.test(f.url()));
  if (!frame) return false;
  try {
    const html = await (await fetch(frame.url(), { signal: AbortSignal.timeout(15000) })).text();
    const scripts = [...html.matchAll(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi)].map((m) => new URL(m[1], frame.url()).href);
    const inline = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)]
      .map((m) => m[1])
      .filter((s) => s.trim().length > 50);
    for (const url of scripts) await frame.addScriptTag({ url }).catch(() => {});
    for (const content of inline) await frame.addScriptTag({ content }).catch(() => {});
    return scripts.length + inline.length > 0;
  } catch {
    return false;
  }
}

async function mintToken(site) {
  await gotoRetry(site);
  await ensureTurnstileApi();

  // render explicitly (implicit render waits for a `load` event that can be late)
  const widgetId = await page
    .evaluate(() => {
      const el = document.querySelector('.cf-turnstile, [data-sitekey]');
      if (!el || !window.turnstile) return null;
      try {
        const id = window.turnstile.render(el);
        el.setAttribute('data-pd-rendered', '1');
        return id ?? 'rendered';
      } catch {
        return null;
      }
    })
    .catch(() => null);

  const readToken = () =>
    page.evaluate(() => {
      const el = document.querySelector('input[name="cf-turnstile-response"]');
      return el && typeof el.value === 'string' ? el.value : '';
    }).catch(() => '');

  /**
   * Measured behaviour of this site's widget in a headless browser:
   *   ~36s  overrunBegin        (non-interactive attempt timed out)
   *   ~82s  interactiveEnd      (interactive attempt finished)
   *   then it repeats. So we must (a) wait much longer than a normal widget and
   *   (b) actually click the widget once the interactive phase starts.
   */
  const started = Date.now();
  let lastClick = 0;
  let executed = false;
  while (Date.now() - started < TOKEN_WAIT_MS) {
    const tok = await readToken();
    if (tok && tok.length > 20) return tok;

    // force the challenge once, after the passive attempt has had its chance
    if (!executed && widgetId && Date.now() - started > 25_000) {
      executed = true;
      await page
        .evaluate((id) => {
          try {
            window.turnstile.execute(id);
            return true;
          } catch {
            return false;
          }
        }, widgetId)
        .catch(() => {});
      console.log('[sidecar] turnstile.execute() force-kiya');
    }

    if (Date.now() - started > 6000 && Date.now() - lastClick > 2500) {
      lastClick = Date.now();
      await clickWidget().catch(() => {});
      await pokeWidgetFrame().catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 700));
  }

  const tok = await readToken();
  if (!tok || tok.length <= 20) {
    throw new Error(`widget ne ${Math.round(TOKEN_WAIT_MS / 1000)}s mein token nahi diya`);
  }
  return tok;
}

/**
 * POST the search. Node fetch first (fast path); if the host refuses node
 * (ECONNRESET on .com), issue the same POST from inside the page where it is
 * same-origin anyway.
 */
async function postSearch(site, token, n) {
  const body = `search_query=${n}&cf-turnstile-response=${encodeURIComponent(token)}`;
  try {
    const r = await fetch(site, {
      method: 'POST',
      headers: {
        'user-agent': UA,
        'content-type': 'application/x-www-form-urlencoded',
        referer: site,
        origin: new URL(site).origin,
      },
      body,
      signal: AbortSignal.timeout(30000),
    });
    const html = await r.text();
    if (html.length > 2000) return html;
  } catch {
    /* fall through to the in-page POST */
  }
  const inPage = await page.evaluate(
    async (url, payload) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: payload,
      });
      return { status: res.status, text: await res.text() };
    },
    site,
    body,
  );
  return inPage.text;
}

async function search(query, force = false) {
  const q = normalizeQuery(query);
  if (!q) return { ok: false, reason: 'bad-input' };
  const n = q.value;

  // Per-number cache: the mirror throttles per network, so never ask twice for
  // the same number in the same session. Only real reports are cached.
  const hit = cache.get(n);
  if (hit && Date.now() - hit.at < (hit.ttl ?? CACHE_TTL_MS)) {
    return { ok: true, number: n, kind: q.kind, attempts: 0, ms: 0, cached: true, html: hit.html };
  }

  // The mirror already told us when it will answer again: do not even navigate.
  if (Date.now() < limitedUntil && !force) {
    const mins = Math.ceil((limitedUntil - Date.now()) / 60_000);
    return {
      ok: true,
      number: n,
      kind: q.kind,
      attempts: 0,
      ms: 0,
      limited: true,
      retryAfterMinutes: mins,
      html: limitedHtml,
    };
  }

  let lastErr = 'unknown';
  const startedAt = Date.now();
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    // never start an attempt we cannot finish inside the budget
    if (Date.now() - startedAt > BUDGET_MS) {
      lastErr = `budget ${BUDGET_MS}ms khatam (attempt ${attempt - 1} ke baad)`;
      break;
    }
    // alternate hosts across attempts so a dead host is skipped quickly
    const site = SITES[(attempt - 1) % SITES.length];
    try {
      // a previous attempt may have dropped the page (self-heal) — reattach first
      await ensureBrowser();
      const token = await mintToken(site);
      const html = await postSearch(site, token, n);
      if (/VERIFICATION FAILED/i.test(html)) {
        lastErr = `verification-failed (${site})`;
        continue;
      }
      if (/CAPTCHA REQUIRED/i.test(html)) {
        lastErr = `captcha-required (${site})`;
        continue;
      }
      if (/TOTAL HITS/i.test(html)) cache.set(n, { html, at: Date.now() });
      // A throttled page is also worth remembering briefly: it stops us from
      // burning a navigation on every request while the window is closed.
      else if (/TOO MANY SEARCHES/i.test(html)) {
        const mins = Number(/try again in (\d+)\s*minutes?/i.exec(html)?.[1] ?? 5);
        limitedHtml = html;
        limitedUntil = Date.now() + mins * 60_000;
        cache.set(n, { html, at: Date.now(), ttl: Math.min(mins, 10) * 60 * 1000 });
      }
      return { ok: true, number: n, kind: q.kind, attempts: attempt, site, html };
    } catch (e) {
      lastErr = `${String(e?.message ?? e).slice(0, 120)} (${site})`;
      // self-heal: a stalled widget leaves the page useless — drop it so the next
      // attempt gets a brand-new page instead of failing forever on the same one
      try {
        if (page && !page.isClosed()) await page.close().catch(() => {});
        page = null;
      } catch {
        /* ignore */
      }
      if (/Target closed|Session closed|detached|fetch failed|discovery/i.test(lastErr)) {
        browser = null;
      }
    }
  }
  return { ok: false, reason: 'exhausted', detail: lastErr };
}

const send = (res, status, body) => {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(json);
};

/** one search at a time — one shared page */
let chain = Promise.resolve();
const serialize = (fn) => {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);

  if (url.pathname === '/healthz') {
    return send(res, 200, {
      ok: true,
      cdp: CDP_HTTP,
      attached: !!browser?.connected,
      sites: SITES,
      limitedMinutes: limitedUntil > Date.now() ? Math.ceil((limitedUntil - Date.now()) / 60_000) : 0,
    });
  }

  if (url.pathname === '/pakdb') {
    const query = url.searchParams.get('query') ?? url.searchParams.get('number') ?? url.searchParams.get('cnic') ?? '';
    const force = url.searchParams.get('fresh') === '1';
    const started = Date.now();
    return void serialize(async () => {
      try {
        await ensureBrowser();
        const out = await search(query, force);
        send(res, out.ok ? 200 : 502, { ...out, ms: Date.now() - started });
      } catch (e) {
        send(res, 500, { ok: false, reason: 'internal', detail: String(e?.message ?? e) });
      }
    });
  }

  send(res, 404, { ok: false, reason: 'not-found', path: url.pathname });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[sidecar] listening on http://0.0.0.0:${PORT}  (browser at ${CDP_HTTP})`);
  void warmup();
});

/**
 * Cold start is the flakiest moment (first attach + first navigation), so do it
 * at boot instead of letting the first user request eat the failure.
 */
async function warmup() {
  for (let i = 1; i <= 4; i++) {
    try {
      await ensureBrowser();
      await mintToken(SITES[0]);
      console.log('[sidecar] warm ✅');
      return;
    } catch (e) {
      console.log(`[sidecar] warm attempt ${i} failed: ${String(e?.message ?? e).slice(0, 100)}`);
      page = null;
      browser = null;
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
  console.log('[sidecar] warm failed — pehli request slow ho sakti hai');
}
