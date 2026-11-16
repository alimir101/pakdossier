import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { handleRequest, VERSION } from '../../src/worker/index';
import { memoryCache } from '../../src/worker/cache';
import type { Deps, EnvWithSecrets } from '../../src/worker/types';

const fixture = readFileSync('tests/fixtures/whoseno-pk-page.html', 'utf8');
const NOW = 1_700_000_000_000;
const deps: Deps = { fetch: (async () => new Response('{}')) as unknown as typeof fetch, now: () => NOW };

/** fetch mock: whoseno -> fixture, every other host -> the given json */
function mockFetch(json: unknown = {}, status = 200) {
  const calls: string[] = [];
  const impl = (async (url: RequestInfo | URL) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('whoseno.com')) return new Response(fixture, { status: 200 });
    return new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const get = (path: string) => new Request(`https://worker.test${path}`);

describe('routes — basics', () => {
  it('answers CORS preflight without touching providers', async () => {
    const r = await handleRequest(new Request('https://worker.test/api/lookup', { method: 'OPTIONS' }), {}, deps);
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('404s unknown routes as JSON', async () => {
    const r = await handleRequest(get('/nope'), {}, deps);
    expect(r.status).toBe(404);
    expect((await r.json()).code).toBe('not-found');
  });

  it('405s non-GET', async () => {
    const r = await handleRequest(new Request('https://worker.test/api/health', { method: 'POST' }), {}, deps);
    expect(r.status).toBe(405);
  });

  it('health lists every provider and leaks no key material', async () => {
    const env: EnvWithSecrets = { IPQS_KEY: 'super-secret', NUMLOOKUPAPI_KEY: 'k2' };
    const r = await handleRequest(get('/api/health'), env, deps);
    const body = await r.json();
    expect(r.status).toBe(200);
    expect(body.version).toBe(VERSION);
    expect(body.keyless).toBe(true);
    expect(body.providers.find((p: { id: string }) => p.id === 'ipqs').keyPresent).toBe(true);
    expect(body.providers.find((p: { id: string }) => p.id === 'veriphone').keyPresent).toBe(false);
    expect(JSON.stringify(body)).not.toContain('super-secret');
  });
});

describe('routes — lookup', () => {
  it('400s an unparseable number with the reason', async () => {
    const r = await handleRequest(get('/api/lookup?number=abc'), {}, deps);
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.code).toBe('invalid-number');
    expect(body.reason).toBe('not-a-number');
  });

  it('400s when the number is missing', async () => {
    const r = await handleRequest(get('/api/lookup'), {}, deps);
    expect(r.status).toBe(400);
  });

  it('with zero configuration it still answers, via the keyless provider', async () => {
    const { impl, calls } = mockFetch();
    const cache = memoryCache(deps);
    const r = await handleRequest(get('/api/lookup?number=03004439955'), {}, { ...deps, fetch: impl, cache });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.ok).toBe(true);
    expect(body.results.map((x: { provider: string }) => x.provider)).toEqual(['whoseno']);
    expect(body.results[0].carrierKind).toBe('prefix');
    expect(body.results[0].confidence).toBe('low');
    expect(body.results[0].fields.carrier).toBe('Jazz');
    expect(body.partial.length).toBeGreaterThan(0); // the keyed ones, honestly reported
    expect(calls).toHaveLength(1);
    expect(r.headers.get('x-pakdossier-cache')).toBe('miss');
  });

  it('serves a cached answer on the second call and calls no provider', async () => {
    const { impl, calls } = mockFetch();
    const cache = memoryCache(deps);
    const opts = { ...deps, fetch: impl, cache };
    await handleRequest(get('/api/lookup?number=03004439955'), {}, opts);
    const second = await handleRequest(get('/api/lookup?number=03004439955'), {}, opts);
    expect(second.status).toBe(200);
    expect(second.headers.get('x-pakdossier-cache')).toBe('hit');
    expect((await second.json()).cached).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('fresh=1 bypasses the cache', async () => {
    const { impl, calls } = mockFetch();
    const cache = memoryCache(deps);
    const opts = { ...deps, fetch: impl, cache };
    await handleRequest(get('/api/lookup?number=03004439955'), {}, opts);
    await handleRequest(get('/api/lookup?number=03004439955&fresh=1'), {}, opts);
    expect(calls).toHaveLength(2);
  });

  it('normalises the input and echoes the canonical forms', async () => {
    const { impl } = mockFetch();
    const cache = memoryCache(deps);
    const r = await handleRequest(get('/api/lookup?number=%2B92%20300%204439955'), {}, { ...deps, fetch: impl, cache });
    const body = await r.json();
    expect(body.input.e164).toBe('+923004439955');
    expect(body.input.national).toBe('03004439955');
  });

  it('adds a configured keyed provider to the run when a key exists', async () => {
    const { impl, calls } = mockFetch({ success: true, valid: true, active: true, carrier: 'Zong', line_type: 'mobile' });
    const cache = memoryCache(deps);
    const env: EnvWithSecrets = { IPQS_KEY: 'k' };
    // IPQS is live-capable, so the pool stops after it + one more
    const r = await handleRequest(get('/api/lookup?number=03004439955'), env, { ...deps, fetch: impl, cache });
    const body = await r.json();
    expect(body.results.some((x: { provider: string }) => x.provider === 'ipqs')).toBe(true);
    expect(calls.some((c) => c.includes('ipqualityscore'))).toBe(true);
  });

  it('reports a provider failure as partial, not as a 500', async () => {
    const impl = (async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes('whoseno.com')) return new Response(fixture, { status: 200 });
      return new Response(JSON.stringify({}), { status: 500 });
    }) as unknown as typeof fetch;
    const cache = memoryCache(deps);
    const r = await handleRequest(get('/api/lookup?number=03004439955'), { IPQS_KEY: 'k' }, { ...deps, fetch: impl, cache });
    const body = await r.json();
    expect(r.status).toBe(200);
    expect(body.partial.some((p: { reason: string }) => p.reason === 'http')).toBe(true);
  });
});

describe('routes — /api/cnic (reverse: which numbers sit on a CNIC)', () => {
  const CNIC = '3520212345671';
  const cnicFixture = readFileSync('tests/fixtures/pakdb-report-cnic.html', 'utf8');

  const sidecarFetch = (payload: unknown, status = 200) => {
    const calls: string[] = [];
    const impl = (async (url: RequestInfo | URL) => {
      calls.push(String(url));
      return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    return { impl, calls };
  };

  it('400s a malformed CNIC', async () => {
    const r = await handleRequest(get('/api/cnic?cnic=12345'), { PAKDB_BROWSER_URL: 'http://x' }, deps);
    expect(r.status).toBe(400);
  });

  it('503s when no sidecar is configured, without pretending', async () => {
    const r = await handleRequest(get(`/api/cnic?cnic=${CNIC}`), {}, deps);
    expect(r.status).toBe(503);
    expect((await r.json()).code).toBe('no-sidecar');
  });

  it('returns the numbers found on the CNIC', async () => {
    const { impl, calls } = sidecarFetch({ ok: true, html: cnicFixture });
    const r = await handleRequest(
      get(`/api/cnic?cnic=${CNIC}`),
      { PAKDB_BROWSER_URL: 'http://sidecar.test/' },
      { ...deps, fetch: impl, cache: memoryCache(deps) },
    );
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.cnic).toBe('35202-1234567-1');
    expect(body.records).toHaveLength(2);
    expect(body.records[0].mobile).toBe('923331234567');
    expect(calls[0]).toBe(`http://sidecar.test/pakdb?query=${CNIC}`);
  });

  it('caches the CNIC answer', async () => {
    const { impl, calls } = sidecarFetch({ ok: true, html: cnicFixture });
    const cache = memoryCache(deps);
    const opts = { ...deps, fetch: impl, cache };
    await handleRequest(get(`/api/cnic?cnic=${CNIC}`), { PAKDB_BROWSER_URL: 'http://sidecar.test' }, opts);
    const second = await handleRequest(get(`/api/cnic?cnic=${CNIC}`), { PAKDB_BROWSER_URL: 'http://sidecar.test' }, opts);
    expect(second.headers.get('x-pakdossier-cache')).toBe('hit');
    expect(calls).toHaveLength(1);
  });

  it('passes the mirror throttle through instead of calling it "not found"', async () => {
    const limited = readFileSync('tests/fixtures/pakdb-report-ratelimited.html', 'utf8');
    const { impl } = sidecarFetch({ ok: true, html: limited });
    const r = await handleRequest(
      get(`/api/cnic?cnic=${CNIC}`),
      { PAKDB_BROWSER_URL: 'http://sidecar.test' },
      { ...deps, fetch: impl, cache: memoryCache(deps) },
    );
    const body = await r.json();
    expect(r.status).toBe(200);
    expect(body.rateLimitedMinutes).toBeGreaterThan(0);
    expect(body.records).toEqual([]);
  });

  it('502s when the sidecar itself fails', async () => {
    const { impl } = sidecarFetch({ ok: false, reason: 'exhausted', detail: 'QUIC' });
    const r = await handleRequest(
      get(`/api/cnic?cnic=${CNIC}`),
      { PAKDB_BROWSER_URL: 'http://sidecar.test' },
      { ...deps, fetch: impl, cache: memoryCache(deps) },
    );
    expect(r.status).toBe(502);
    expect((await r.json()).code).toBe('sidecar-error');
  });
});

describe('routes — status', () => {
  it('exposes usage counters and cooldowns', async () => {
    const r = await handleRequest(get('/api/status'), {}, { ...deps, cache: memoryCache(deps) });
    const body = await r.json();
    expect(body.ok).toBe(true);
    expect(Object.keys(body.used).length).toBeGreaterThan(3);
    expect(body.cooldown).toBeTypeOf('object');
  });
});
