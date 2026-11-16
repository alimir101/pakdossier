import { describe, expect, it } from 'vitest';
import { discoverOwner } from '../../src/core/discover';
import type { LookupOutcome } from '../../src/api/client';
import type { LookupResponse, ProviderSuccess } from '../../src/worker/types';

function result(over: Partial<ProviderSuccess> & { fields: ProviderSuccess['fields'] }): ProviderSuccess {
  return {
    provider: 'pakdb',
    carrierKind: 'prefix',
    confidence: 'medium',
    fetchedAt: '2026-11-16T00:00:00Z',
    cached: false,
    latencyMs: 10,
    ...over,
  };
}

const ok = (results: ProviderSuccess[]): LookupOutcome => ({
  state: 'ok',
  data: { ok: true, results, partial: [], cached: false, servedAt: 'x', input: { e164: '+923331234567', national: '03331234567', significant: '3331234567' } } as LookupResponse,
});

describe('discoverOwner', () => {
  it('returns undefined unless there is a successful lookup', () => {
    expect(discoverOwner({ state: 'idle' })).toBeUndefined();
    expect(discoverOwner({ state: 'loading' })).toBeUndefined();
    expect(discoverOwner({ state: 'empty', partial: [] })).toBeUndefined();
    expect(discoverOwner({ state: 'error', message: 'x' })).toBeUndefined();
    expect(discoverOwner({ state: 'invalid' })).toBeUndefined();
  });

  it('pulls the CNIC out and formats it', () => {
    const out = ok([
      result({ fields: { records: [{ mobile: '923331234567', name: 'muhammad kashif', cnic: '3520296868939', address: 'LAHORE' }] } }),
    ]);
    const f = discoverOwner(out);
    expect(f?.cnic).toBe('35202-9686893-9');
    expect(f?.name).toBe('muhammad kashif');
    expect(f?.address).toBe('LAHORE');
    expect(f?.official).toBe(false);
  });

  it('never invents a CNIC from a carrier-only result', () => {
    const out = ok([result({ provider: 'ipqs', carrierKind: 'live', fields: { carrier: 'Jazz' } })]);
    expect(discoverOwner(out)).toBeUndefined();
  });

  it('skips a structurally invalid CNIC and keeps looking', () => {
    const out = ok([
      result({ fields: { records: [{ mobile: '923331234567', name: 'bad', cnic: '1111111111111', address: 'x' }] } }),
      result({ provider: 'other', fields: { records: [{ mobile: '923331234567', name: 'good', cnic: '3520296868939', address: 'y' }] } }),
    ]);
    expect(discoverOwner(out)?.name).toBe('good');
  });

  it('prefers the higher-confidence provider regardless of order', () => {
    const out = ok([
      result({ provider: 'lowp', confidence: 'low', fields: { records: [{ mobile: '9', name: 'low', cnic: '3520296868939', address: 'a' }] } }),
      result({ provider: 'highp', confidence: 'high', fields: { records: [{ mobile: '9', name: 'high', cnic: '3530298301247', address: 'b' }] } }),
    ]);
    expect(discoverOwner(out)?.name).toBe('high');
  });

  it('carries totalHits through for the UI', () => {
    const out = ok([
      result({ fields: { records: [{ mobile: '9', name: 'n', cnic: '3520296868939', address: 'a' }], totalHits: 3 } }),
    ]);
    expect(discoverOwner(out)?.totalHits).toBe(3);
  });

  it('handles an empty records array without crashing', () => {
    expect(discoverOwner(ok([result({ fields: { records: [] } })]))).toBeUndefined();
  });
});
