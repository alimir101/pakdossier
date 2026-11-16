import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AdapterError, type AdapterCtx } from '../../src/worker/adapters/contract';
import { pakdb } from '../../src/worker/adapters/pakdb';

const three = readFileSync('tests/fixtures/pakdb-report-3-records.html', 'utf8');
const none = readFileSync('tests/fixtures/pakdb-report-empty.html', 'utf8');

const input = { e164: '+923331234567', national: '03331234567', significant: '3331234567' };
const ctx = (fetchImpl: typeof fetch, env: Record<string, string> = { PAKDB_BROWSER_URL: 'http://127.0.0.1:8788' }): AdapterCtx => ({
  fetch: fetchImpl,
  now: () => 1_700_000_000_000,
  timeoutMs: 20_000,
  env,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('pakdb adapter', () => {
  it('is honest about how it runs: no key, but a sidecar is required', () => {
    expect(pakdb.needsKey).toBe(false);
    expect(pakdb.requiresEnv).toBe('PAKDB_BROWSER_URL');
    expect(pakdb.confidence).toBe('medium');
  });

  it('maps sidecar HTML into owner fields', async () => {
    let seen = '';
    const f = (async (url: string) => {
      seen = String(url);
      return json({ ok: true, html: three, attempts: 1, ms: 1200 });
    }) as unknown as typeof fetch;

    const fields = await pakdb.run(input, ctx(f));

    expect(seen).toBe('http://127.0.0.1:8788/pakdb?number=03331234567');
    expect(fields.records).toHaveLength(3);
    expect(fields.extra?.ownerName).toBe('muhammad kashif');
    expect(fields.extra?.cnic).toBe('3520296868939');
    expect(fields.location).toContain('LAHORE');
    expect(fields.note).toMatch(/official NADRA record nahi/i);
  });

  it('forwards a user-requested cache bypass to the sidecar', async () => {
    let seen = '';
    const f = (async (url: string) => {
      seen = String(url);
      return json({ ok: true, html: three });
    }) as unknown as typeof fetch;
    await pakdb.run(input, { ...ctx(f), fresh: true });
    expect(seen).toContain('&fresh=1');
  });

  it('does not send fresh when the user did not ask', async () => {
    let seen = '';
    const f = (async (url: string) => {
      seen = String(url);
      return json({ ok: true, html: three });
    }) as unknown as typeof fetch;
    await pakdb.run(input, ctx(f));
    expect(seen).not.toContain('fresh');
  });

  it('throws not-found when the mirror has nothing', async () => {
    const f = (async () => json({ ok: true, html: none })) as unknown as typeof fetch;
    await expect(pakdb.run(input, ctx(f))).rejects.toMatchObject({ reason: 'not-found' });
  });

  it('throws no-key when the sidecar is not configured', async () => {
    const f = (async () => json({})) as unknown as typeof fetch;
    await expect(pakdb.run(input, ctx(f, {}))).rejects.toMatchObject({ reason: 'no-key' });
  });

  it('surfaces a sidecar failure as http, keeping its detail', async () => {
    const f = (async () => json({ ok: false, reason: 'exhausted', detail: 'net::ERR_QUIC_PROTOCOL_ERROR' })) as unknown as typeof fetch;
    try {
      await pakdb.run(input, ctx(f));
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as AdapterError).reason).toBe('http');
      expect((e as Error).message).toContain('QUIC');
    }
  });

  it('treats a bad number from the sidecar as not-found', async () => {
    const f = (async () => json({ ok: false, reason: 'bad-number' })) as unknown as typeof fetch;
    await expect(pakdb.run(input, ctx(f))).rejects.toMatchObject({ reason: 'not-found' });
  });

  it('reports the mirror throttle as rate-limited, with the minutes', async () => {
    const limited = readFileSync('tests/fixtures/pakdb-report-ratelimited.html', 'utf8');
    const f = (async () => json({ ok: true, html: limited })) as unknown as typeof fetch;
    try {
      await pakdb.run(input, ctx(f));
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as AdapterError).reason).toBe('rate-limited');
      expect((e as Error).message).toContain('49');
      // the minutes must survive so the pool/UI can count down
      expect((e as AdapterError).retryAfterMinutes).toBe(49);
    }
  });
});