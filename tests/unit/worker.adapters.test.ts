import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AdapterError, type AdapterCtx } from '../../src/worker/adapters/contract';
import { parseWhoseno, whoseno } from '../../src/worker/adapters/whoseno';
import { ipqs, numlookupapi, numverify } from '../../src/worker/adapters/json-apis';

const fixture = readFileSync('tests/fixtures/whoseno-pk-page.html', 'utf8');

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function ctx(fetchImpl: typeof fetch, key?: string): AdapterCtx {
  return { fetch: fetchImpl, now: () => 1_700_000_000_000, timeoutMs: 5000, key };
}

const input = { e164: '+923004439955', national: '03004439955', significant: '3004439955' };

describe('whoseno (keyless) parser', () => {
  it('extracts the machine-readable fields from JSON-LD, not CSS classes', () => {
    const f = parseWhoseno(fixture);
    expect(f.numberingArea).toBe('3004');
    expect(f.carrier).toBe('Jazz');
    expect(f.lineType).toBe('mobile phone');
    expect(f.reports).toBe(19);
    expect(f.safeReports).toBe(147);
    expect(f.spamReports).toBe(39);
    expect(f.extra?.spamRatio).toBe(21);
  });

  it('carries the honesty note about prefix-carrier and masked name', () => {
    const f = parseWhoseno(fixture);
    expect(f.note).toMatch(/prefix/i);
    expect(f.note).toMatch(/masked/i);
  });

  it('throws a precise parse error when the page shape changes', () => {
    expect(() => parseWhoseno('<html><body>nothing here</body></html>')).toThrow(AdapterError);
    try {
      parseWhoseno('<html><body>nothing here</body></html>');
    } catch (e) {
      expect((e as AdapterError).reason).toBe('parse');
    }
  });

  it('adapter hits the pk path and is honest about carrier kind', async () => {
    let seen = '';
    const f = (async (url: string) => {
      seen = String(url);
      return new Response(fixture, { status: 200 });
    }) as unknown as typeof fetch;
    const fields = await whoseno.run(input, ctx(f));
    expect(seen).toBe('https://www.whoseno.com/pk/03004439955');
    expect(fields.carrier).toBe('Jazz');
    expect(whoseno.needsKey).toBe(false);
    expect(whoseno.carrierKind).toBe('prefix');
    expect(whoseno.confidence).toBe('low');
  });
});

describe('keyed adapters', () => {
  it('numlookupapi maps its payload and declares a prefix carrier', async () => {
    const f = (async () =>
      json({ valid: true, carrier: 'Jazz', line_type: 'mobile', location: 'Lahore' })) as unknown as typeof fetch;
    const fields = await numlookupapi.run(input, ctx(f, 'KEY'));
    expect(fields.carrier).toBe('Jazz');
    expect(fields.location).toBe('Lahore');
    expect(fields.valid).toBe(true);
    expect(numlookupapi.carrierKind).toBe('prefix');
    expect(numlookupapi.quotaPerMonth).toBe(250);
  });

  it('ipqs is the live-capable provider', async () => {
    const f = (async () =>
      json({ success: true, valid: true, active: true, carrier: 'Zong', line_type: 'mobile', city: 'Karachi', fraud_score: 12 })) as unknown as typeof fetch;
    const fields = await ipqs.run(input, ctx(f, 'KEY'));
    expect(fields.carrier).toBe('Zong');
    expect(fields.active).toBe(true);
    expect(fields.extra?.fraudScore).toBe(12);
    expect(ipqs.carrierKind).toBe('live');
  });

  it('throws no-key when the provider rejects the key', async () => {
    const f = (async () => json({}, 401)) as unknown as typeof fetch;
    await expect(numverify.run(input, ctx(f, 'BAD'))).rejects.toMatchObject({ reason: 'no-key' });
  });

  it('throws no-key when we have no key at all', async () => {
    const f = (async () => json({})) as unknown as typeof fetch;
    await expect(numlookupapi.run(input, ctx(f))).rejects.toMatchObject({ reason: 'no-key' });
  });

  it('maps a rate limit to a rate-limited reason', async () => {
    const f = (async () => json({}, 429)) as unknown as typeof fetch;
    await expect(ipqs.run(input, ctx(f, 'KEY'))).rejects.toMatchObject({ reason: 'rate-limited' });
  });

  it('maps an upstream error body to http', async () => {
    const f = (async () => json({ success: false, error: { info: 'quota exceeded' } })) as unknown as typeof fetch;
    await expect(numverify.run(input, ctx(f, 'KEY'))).rejects.toMatchObject({ reason: 'http' });
  });

  it('does not invent fields that upstream left empty or "null"', async () => {
    const f = (async () => json({ valid: true, carrier: 'null', line_type: '', location: ' N/A ' })) as unknown as typeof fetch;
    const fields = await numlookupapi.run(input, ctx(f, 'KEY'));
    expect(fields.carrier).toBeUndefined();
    expect(fields.lineType).toBeUndefined();
    expect(fields.location).toBeUndefined();
  });
});
