import { describe, expect, it } from 'vitest';
import {
  isUnallocated,
  lookupPrefix,
  prefixOf,
  validatePrefixData,
  MNP_WARNING,
  OFFICIAL_LIVE_NETWORK_CHECK,
} from '../../src/core/prefix';

/** build a full mobile number from a 4-digit prefix */
const num = (p: string) => `${p}1234567`;

describe('prefix data integrity', () => {
  it('has no structural problems', () => {
    expect(validatePrefixData()).toEqual([]);
  });
});

describe('prefixOf', () => {
  it('reads the prefix from every accepted national shape', () => {
    expect(prefixOf('03001234567')).toBe('0300');
    expect(prefixOf('+923001234567')).toBe('0300');
    expect(prefixOf('923001234567')).toBe('0300');
    expect(prefixOf('3001234567')).toBe('0300');
    expect(prefixOf('0300-1234567')).toBe('0300');
  });

  it('returns undefined for non-mobile', () => {
    expect(prefixOf('0421234567')).toBeUndefined();
    expect(prefixOf('111123456')).toBeUndefined();
    expect(prefixOf('')).toBeUndefined();
    expect(prefixOf('abc')).toBeUndefined();
  });
});

describe('lookupPrefix — allocated ranges', () => {
  const cases: Array<[string, string]> = [
    ['0300', 'Jazz'],
    ['0309', 'Jazz'],
    ['0311', 'Zong'],
    ['0318', 'Zong'],
    ['0320', 'Jazz'],
    ['0329', 'Jazz'],
    ['0330', 'Ufone'],
    ['0338', 'Ufone'],
    ['0339', 'Onic'],
    ['0340', 'Ufone'],
    ['0349', 'Ufone'],
    ['0350', 'SCOM'],
    ['0355', 'SCOM'],
    ['0370', 'Zong'],
    ['0371', 'Zong'],
  ];

  for (const [prefix, operator] of cases) {
    it(`${prefix} -> ${operator}`, () => {
      const r = lookupPrefix(num(prefix));
      expect(r.allocated).toBe(true);
      expect(r.operator).toBe(operator);
      expect(r.prefix).toBe(prefix);
    });
  }

  it('always warns about MNP and always offers the official live check', () => {
    const r = lookupPrefix(num('0300'));
    expect(r.mnpWarning).toBe(true);
    expect(r.liveNetworkCheck).toContain('76367');
    expect(MNP_WARNING).toContain('MNP');
    expect(OFFICIAL_LIVE_NETWORK_CHECK).toContain('76367');
  });

  it('carries sources for every allocated hit', () => {
    const r = lookupPrefix(num('0345'));
    expect(r.sources.length).toBeGreaterThan(0);
    expect(r.sources.every((s) => s.startsWith('http'))).toBe(true);
  });

  it('marks merged / mvno / regional allocations as such', () => {
    expect(lookupPrefix(num('0320')).allocation).toBe('merged');
    expect(lookupPrefix(num('0339')).allocation).toBe('mvno');
    expect(lookupPrefix(num('0350')).allocation).toBe('regional');
  });
});

describe('lookupPrefix — gaps are a normal answer', () => {
  it('0310 is a documented gap', () => {
    const r = lookupPrefix(num('0310'));
    expect(r.allocated).toBe(false);
    expect(r.prefix).toBe('0310');
    expect(r.note).toContain('Allocated range nahi mili');
    expect(isUnallocated('0310')).toBe(true);
  });

  it('0356 and 0372 and 0399 are gaps', () => {
    for (const p of ['0356', '0372', '0399']) {
      expect(isUnallocated(p)).toBe(true);
      expect(lookupPrefix(num(p)).allocated).toBe(false);
    }
  });

  it('0355 is NOT a gap', () => {
    expect(isUnallocated('0355')).toBe(false);
    expect(lookupPrefix(num('0355')).allocated).toBe(true);
  });

  it('unparseable input still returns a full object', () => {
    const r = lookupPrefix('hello');
    expect(r.allocated).toBe(false);
    expect(r.prefix).toBe('');
    expect(r.mnpWarning).toBe(true);
  });
});
