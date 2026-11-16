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
import puppeteer from 'puppeteer-core';

const PORT = Number(process.env.PAKDB_SIDECAR_PORT ?? 8788);
const CDP_HTTP = process.env.OBSCURA_HTTP ?? 'http://127.0.0.1:9222';
const ATTEMPTS = Number(process.env.PAKDB_ATTEMPTS ?? 3);
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
  const v = await (await fetch(`${CDP_HTTP}/json/version`)).json();
  browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl });
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

async function mintToken(site) {
  await gotoRetry(site);

  // The Turnstile api.js renders `.cf-turnstile` divs on the window `load` event.
  // That event can be very late (or never arrive) while a subresource hangs, so
  // the widget silently never appears. Wait for the API, then render explicitly.
  await page
    .waitForFunction(() => typeof window.turnstile === 'object', { timeout: 20000, polling: 250 })
    .catch(() => {});
  await page
    .evaluate(() => {
      const el = document.querySelector('.cf-turnstile, [data-sitekey]');
      if (!el || !window.turnstile || el.getAttribute('data-pd-rendered')) return;
      try {
        window.turnstile.render(el);
        el.setAttribute('data-pd-rendered', '1');
      } catch {
        /* implicit render may still win; the wait below covers both */
      }
    })
    .catch(() => {});

  await page.waitForFunction(
    () => {
      const el = document.querySelector('input[name="cf-turnstile-response"]');
      return !!(el && typeof el.value === 'string' && el.value.length > 20);
    },
    { timeout: 45000, polling: 500 },
  );

  return page.$eval('input[name="cf-turnstile-response"]', (el) => el.value);
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
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    // alternate hosts across attempts so a dead host is skipped quickly
    const site = SITES[(attempt - 1) % SITES.length];
    try {
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
      // a dead page/connection is recoverable: force a reattach next round
      if (/Target closed|Session closed|detached|QUIC|net::|fetch failed/i.test(lastErr)) {
        try {
          page = null;
          browser = null;
        } catch {
          /* ignore */
        }
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

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[sidecar] listening on http://127.0.0.1:${PORT}  (obscura at ${CDP_HTTP})`);
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
