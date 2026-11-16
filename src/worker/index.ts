/**
 * Worker entry point. Web-standard Request/Response only, so the same handler
 * runs on Cloudflare Workers, in Node (dev server + tests) and anywhere else.
 *
 * Zero configuration is a supported mode: with no keys at all, the keyless
 * provider still runs and the response honestly lists what was skipped.
 */
import { normalize } from '../core/normalize.ts';
import { formatCnic, isCnic } from '../core/formats.ts';
import { parsePakdbReport } from './adapters/pakdb-html.ts';
import { ADAPTERS, providerInfo } from './registry.ts';
import { Counters, kvCache, memoryCache } from './cache.ts';
import { runPool } from './pool.ts';
import type { CachePort, Deps, EnvWithSecrets, ErrorResponse, HealthResponse, LookupResponse } from './types.ts';

export const VERSION = '0.1.0';
export { ADAPTERS, providerInfo };

export interface HandlerDeps extends Partial<Deps> {
  /** pass a persistent cache to survive across calls (dev server, tests) */
  cache?: CachePort;
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * Cache resolution. A module-level fallback matters: without it, every request
 * would build a fresh in-memory cache and never hit (i.e. every call would burn
 * a provider quota). On Workers the module scope persists per isolate; with a KV
 * binding configured we use KV instead.
 */
let fallbackCache: CachePort | null = null;

function resolveCache(env: EnvWithSecrets, deps: Deps, overrides: HandlerDeps): CachePort {
  if (overrides.cache) return overrides.cache;
  if (env.CACHE) return kvCache(env.CACHE);
  fallbackCache ??= memoryCache(deps);
  return fallbackCache;
}

function corsHeaders(env: EnvWithSecrets): Record<string, string> {
  return {
    'access-control-allow-origin': env.ALLOWED_ORIGIN ?? '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

function json(body: unknown, status: number, env: EnvWithSecrets, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(env), ...extra },
  });
}

function fail(code: ErrorResponse['code'], message: string, status: number, env: EnvWithSecrets, reason?: string): Response {
  const body: ErrorResponse = { ok: false, code, message, ...(reason ? { reason } : {}) };
  return json(body, status, env);
}

function intOf(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function handleRequest(
  request: Request,
  env: EnvWithSecrets = {},
  overrides: HandlerDeps = {},
): Promise<Response> {
  const deps: Deps = { fetch: overrides.fetch ?? globalThis.fetch, now: overrides.now ?? (() => Date.now()) };
  const cache: CachePort = resolveCache(env, deps, overrides);
  const counters = new Counters(cache, deps);

  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }
  if (request.method !== 'GET') {
    return fail('bad-request', 'Sirf GET chalta hai', 405, env);
  }

  if (url.pathname === '/api/health') {
    const providers = providerInfo(env);
    const body: HealthResponse = {
      ok: true,
      service: 'pakdossier-worker',
      version: VERSION,
      providers,
      keyless: providers.some((p) => !p.needsKey),
      cache: env.CACHE ? 'kv' : 'memory',
    };
    return json(body, 200, env);
  }

  if (url.pathname === '/api/status') {
    const used = await counters.all(ADAPTERS.map((a) => a.id));
    const cooled: Record<string, boolean> = {};
    for (const a of ADAPTERS) cooled[a.id] = await counters.inCooldown(a.id);
    return json({ ok: true, day: deps.now(), used, cooldown: cooled }, 200, env);
  }

  if (url.pathname === '/api/lookup') {
    const raw = url.searchParams.get('number') ?? '';
    const n = normalize(raw);
    if (!n.ok || !n.e164 || !n.national || !n.significant) {
      return fail('invalid-number', 'Number samajh nahi aaya', 400, env, n.reason);
    }

    const cacheKey = `lk:${n.e164}`;
    if (url.searchParams.get('fresh') !== '1') {
      const hit = await cache.get(cacheKey);
      if (hit) {
        try {
          const parsed = JSON.parse(hit) as LookupResponse;
          return json({ ...parsed, cached: true }, 200, env, { 'x-pakdossier-cache': 'hit' });
        } catch {
          /* fall through and refresh */
        }
      }
    }

    const { results, partial } = await runPool(
      { e164: n.e164, national: n.national, significant: n.significant },
      env,
      {
        ...deps,
        counters,
        timeoutMs: intOf(env.LOOKUP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
        ...(url.searchParams.get('fresh') === '1' ? { fresh: true } : {}),
      },
    );

    const body: LookupResponse = {
      ok: true,
      input: { e164: n.e164, national: n.national, significant: n.significant },
      results,
      partial,
      cached: false,
      servedAt: new Date(deps.now()).toISOString(),
    };

    if (results.length > 0) {
      await cache.put(cacheKey, JSON.stringify(body), intOf(env.CACHE_TTL_SECONDS, DEFAULT_TTL_SECONDS));
    }

    return json(body, 200, env, { 'x-pakdossier-cache': 'miss', 'x-pakdossier-providers': String(results.length) });
  }

  if (url.pathname === '/api/cnic') {
    const raw = url.searchParams.get('cnic') ?? '';
    const d = raw.replace(/\D/g, '');
    if (!isCnic(d)) return fail('bad-request', 'CNIC 13 digits ka hona chahiye (0 se shuru nahi)', 400, env);

    const base = (env.PAKDB_BROWSER_URL ?? '').replace(/\/$/, '');
    if (!base) {
      return json(
        { ok: false, code: 'no-sidecar', message: 'PAKDB_BROWSER_URL set nahi hai — sidecar band hai' },
        503,
        env,
      );
    }

    const cacheKey = `cn:${d}`;
    if (url.searchParams.get('fresh') !== '1') {
      const hit = await cache.get(cacheKey);
      if (hit) return json({ ...JSON.parse(hit), cached: true }, 200, env, { 'x-pakdossier-cache': 'hit' });
    }

    let sidecar: { ok?: boolean; reason?: string; detail?: string; html?: string };
    try {
      const fresh = url.searchParams.get('fresh') === '1' ? '&fresh=1' : '';
      const r = await deps.fetch(`${base}/pakdb?query=${d}${fresh}`, {
        // stay inside Cloudflare's ~100s origin limit: the sidecar has its own
        // 70s budget, so a slow mirror must never become an HTML 502
        signal: AbortSignal.timeout(85_000),
      });
      if (!r.ok && r.headers.get('content-type')?.includes('json') === false) {
        throw new Error(`sidecar HTTP ${r.status}`);
      }
      sidecar = (await r.json()) as typeof sidecar;
    } catch (e) {
      const message = String((e as Error).message ?? e).slice(0, 160);
      return json(
        {
          ok: true,
          cnic: formatCnic(d),
          totalHits: 0,
          records: [],
          notFound: true,
          cached: false,
          servedAt: new Date(deps.now()).toISOString(),
          note: `sidecar se jawab nahi aaya: ${message}`,
        },
        200,
        env,
      );
    }

    if (!sidecar.ok || !sidecar.html) {
      return json(
        {
          ok: true,
          cnic: formatCnic(d),
          totalHits: 0,
          records: [],
          notFound: true,
          cached: false,
          servedAt: new Date(deps.now()).toISOString(),
          note: `mirror ne jawab nahi diya (${sidecar.reason ?? 'unknown'})`,
        },
        200,
        env,
      );
    }

    const report = parsePakdbReport(sidecar.html);
    const body = {
      ok: true as const,
      cnic: formatCnic(d),
      totalHits: report.totalHits,
      records: report.records,
      notFound: report.notFound,
      ...(report.rateLimitedMinutes ? { rateLimitedMinutes: report.rateLimitedMinutes } : {}),
      ...(report.ref ? { ref: report.ref } : {}),
      cached: false,
      servedAt: new Date(deps.now()).toISOString(),
      note: 'Leaked/public mirror se — official NADRA record nahi.',
    };

    if (report.records.length > 0) {
      await cache.put(cacheKey, JSON.stringify(body), intOf(env.CACHE_TTL_SECONDS, DEFAULT_TTL_SECONDS));
    }
    return json(body, 200, env, { 'x-pakdossier-cache': 'miss' });
  }

  return fail('not-found', `Unknown route ${url.pathname}`, 404, env);
}

export default {
  fetch: (request: Request, env: EnvWithSecrets) => handleRequest(request, env),
};
