/**
 * LIVE test: the real worker handler against the real internet, no mocks.
 * Proves the keyless path works end to end, and that unconfigured providers are
 * reported rather than silently dropped.
 *
 * Run: npm run test:live
 */
import { describe, expect, it } from 'vitest';
import { handleRequest } from '../../src/worker/index';
import { memoryCache } from '../../src/worker/cache';
import type { Deps, LookupResponse } from '../../src/worker/types';

const TIMEOUT = 45_000;
const deps: Deps = { fetch: globalThis.fetch, now: () => Date.now() };
const opts = () => ({ ...deps, cache: memoryCache(deps) });
const req = (p: string) => new Request(`https://worker.live${p}`);

describe('live worker', () => {
  it(
    'looks up a real PK number through the keyless provider (zero config)',
    async () => {
      const r = await handleRequest(req('/api/lookup?number=03004439955'), {}, opts());
      expect(r.status).toBe(200);
      const body = (await r.json()) as LookupResponse;

      console.log('live results:', JSON.stringify(body.results, null, 2));
      console.log('live partial:', JSON.stringify(body.partial, null, 2));

      expect(body.ok).toBe(true);
      expect(body.input.e164).toBe('+923004439955');

      const keyless = body.results.find((x) => x.provider === 'whoseno');
      expect(keyless, 'keyless provider real response de').toBeTruthy();
      expect(keyless!.carrierKind).toBe('prefix');
      expect(keyless!.confidence).toBe('low');
      expect(keyless!.latencyMs).toBeGreaterThan(0);

      const notConfigured = body.partial.filter((p) => p.reason === 'no-key');
      expect(notConfigured.some((p) => p.provider === 'ipqs')).toBe(true);
      expect(notConfigured.some((p) => p.provider === 'numverify')).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'gets an owner name through the browser sidecar when one is configured',
    async () => {
      const sidecar = process.env.PAKDB_BROWSER_URL;
      if (!sidecar) {
        console.log('PAKDB_BROWSER_URL set nahi — sidecar test skip');
        return;
      }
      // 03331234567 is a number the mirror actually has records for
      const r = await handleRequest(
        req('/api/lookup?number=03331234567'),
        { PAKDB_BROWSER_URL: sidecar, LOOKUP_TIMEOUT_MS: '60000' },
        opts(),
      );
      expect(r.status).toBe(200);
      const body = (await r.json()) as LookupResponse;
      const owner = body.results.find((x) => x.provider === 'pakdb');

      if (!owner) {
        // The mirror throttles per network ("TOO MANY SEARCHES ... try again in
        // NN minutes") — a precise reason is the correct outcome, not a failure.
        const why = body.partial.find((p) => p.provider === 'pakdb');
        console.log('pakdb ne record nahi diya:', JSON.stringify(why));
        expect(why?.reason).toBe('rate-limited');
        return;
      }

      console.log('owner records:', JSON.stringify(owner.fields.records, null, 2));
      expect(owner.fields.records?.length).toBeGreaterThan(0);
      expect(owner.fields.records![0]!.cnic).toMatch(/^\d{13}$/);
      expect(owner.fields.records![0]!.name.length).toBeGreaterThan(2);
      expect(owner.fields.totalHits).toBeGreaterThan(0);
    },
    120_000,
  );

  it(
    'serves the live answer from cache on the second call',
    async () => {
      const shared = opts();
      const first = await handleRequest(req('/api/lookup?number=03004439955'), {}, shared);
      const second = await handleRequest(req('/api/lookup?number=03004439955'), {}, shared);
      expect(first.headers.get('x-pakdossier-cache')).toBe('miss');
      expect(second.headers.get('x-pakdossier-cache')).toBe('hit');
      expect((await second.json()).cached).toBe(true);
    },
    TIMEOUT,
  );

  it('reports health with no secrets', async () => {
    const r = await handleRequest(req('/api/health'), {}, opts());
    const body = await r.json();
    expect(body.service).toBe('pakdossier-worker');
    expect(body.providers.length).toBeGreaterThan(4);
    expect(body.keyless).toBe(true);
  });
});
