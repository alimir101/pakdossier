import { describe, expect, it } from 'vitest';
import { lookup, lookupCnic, parseLookupResponse } from '../../src/api/client';

const goodPayload = {
  ok: true,
  input: { e164: '+923001234567', national: '03001234567', significant: '3001234567' },
  results: [{ provider: 'whoseno', carrierKind: 'prefix', confidence: 'low', fields: { carrier: 'Jazz' }, fetchedAt: 'x', cached: false, latencyMs: 5 }],
  partial: [{ provider: 'ipqs', reason: 'no-key' }],
  cached: false,
  servedAt: 'x',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('parseLookupResponse — the UI must not trust a bad payload', () => {
  it('accepts a well-formed payload', () => {
    const out = parseLookupResponse(goodPayload);
    expect(out.state).toBe('ok');
    if (out.state === 'ok') {
      expect(out.data.results).toHaveLength(1);
      expect(out.data.partial).toHaveLength(1);
    }
  });

  it('treats zero results as empty, not as success with nothing', () => {
    const out = parseLookupResponse({ ...goodPayload, results: [], partial: [{ provider: 'x', reason: 'timeout' }] });
    expect(out.state).toBe('empty');
    if (out.state === 'empty') expect(out.partial[0].reason).toBe('timeout');
  });

  it('drops malformed provider entries instead of rendering them', () => {
    const out = parseLookupResponse({ ...goodPayload, results: [goodPayload.results[0], null, { provider: 1 }, 'x'] });
    expect(out.state).toBe('ok');
    if (out.state === 'ok') expect(out.data.results).toHaveLength(1);
  });

  it('errors on non-object, ok!==true and garbage', () => {
    expect(parseLookupResponse(null).state).toBe('error');
    expect(parseLookupResponse('nope').state).toBe('error');
    expect(parseLookupResponse({ ok: false }).state).toBe('error');
  });
});

describe('lookupCnic()', () => {
  const payload = {
    ok: true,
    cnic: '35202-1234567-1',
    totalHits: 1,
    records: [{ mobile: '923331234567', name: 'n', cnic: '3520296868939', address: 'a' }],
    notFound: false,
    cached: false,
    servedAt: 'x',
  };

  it('returns records and strips dashes from the query', async () => {
    let seen = '';
    const fetchImpl = (async (url: string) => {
      seen = String(url);
      return json(payload);
    }) as unknown as typeof fetch;
    const out = await lookupCnic('35202-1234567-1', { fetchImpl });
    expect(out.state).toBe('ok');
    expect(seen).toContain('cnic=3520212345671');
  });

  it('maps 400 to invalid', async () => {
    const fetchImpl = (async () => json({}, 400)) as unknown as typeof fetch;
    expect((await lookupCnic('123', { fetchImpl })).state).toBe('invalid');
  });

  it('maps a missing sidecar (503) to an empty state with a message', async () => {
    const fetchImpl = (async () => json({ ok: false, code: 'no-sidecar' }, 503)) as unknown as typeof fetch;
    const out = await lookupCnic('3520212345671', { fetchImpl });
    expect(out).toMatchObject({ state: 'empty', message: 'no-sidecar' });
  });

  it('maps the mirror throttle to empty, carrying the minutes', async () => {
    const fetchImpl = (async () => json({ ok: true, records: [], rateLimitedMinutes: 42 }, 200)) as unknown as typeof fetch;
    expect(await lookupCnic('3520212345671', { fetchImpl })).toMatchObject({ state: 'empty', rateLimitedMinutes: 42 });
  });

  it('maps zero records with no throttle to a plain empty', async () => {
    const fetchImpl = (async () => json({ ok: true, records: [] }, 200)) as unknown as typeof fetch;
    expect((await lookupCnic('3520212345671', { fetchImpl })).state).toBe('empty');
  });

  it('maps a transport failure to error', async () => {
    const fetchImpl = (async () => {
      throw new Error('ENOTFOUND');
    }) as unknown as typeof fetch;
    expect((await lookupCnic('3520212345671', { fetchImpl })).state).toBe('error');
  });
});

describe('lookup()', () => {
  it('returns ok on a good response', async () => {
    const fetchImpl = (async () => json(goodPayload)) as unknown as typeof fetch;
    const out = await lookup('03001234567', { fetchImpl });
    expect(out.state).toBe('ok');
  });

  it('maps 400 to invalid with the upstream reason', async () => {
    const fetchImpl = (async () => json({ ok: false, code: 'invalid-number', reason: 'too-short' }, 400)) as unknown as typeof fetch;
    const out = await lookup('123', { fetchImpl });
    expect(out).toMatchObject({ state: 'invalid', reason: 'too-short' });
  });

  it('maps a server error to error', async () => {
    const fetchImpl = (async () => json({}, 500)) as unknown as typeof fetch;
    expect((await lookup('03001234567', { fetchImpl })).state).toBe('error');
  });

  it('maps a network throw to error, not a crash', async () => {
    const fetchImpl = (async () => {
      throw new Error('ENOTFOUND');
    }) as unknown as typeof fetch;
    const out = await lookup('03001234567', { fetchImpl });
    expect(out).toMatchObject({ state: 'error', message: 'ENOTFOUND' });
  });

  it('maps an abort to a timeout message', async () => {
    const fetchImpl = (async () => {
      const e = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    }) as unknown as typeof fetch;
    expect(await lookup('03001234567', { fetchImpl })).toMatchObject({ state: 'error', message: 'timeout' });
  });

  it('encodes the number and can bypass the cache', async () => {
    let seen = '';
    const fetchImpl = (async (url: string) => {
      seen = String(url);
      return json(goodPayload);
    }) as unknown as typeof fetch;
    await lookup('+92 300 1234567', { fetchImpl, fresh: true });
    expect(seen).toContain('number=%2B92%20300%201234567');
    expect(seen).toContain('fresh=1');
  });
});
