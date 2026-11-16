import { describe, expect, it } from 'vitest';
import { deriveKind, displayNational, mobilePrefix, normalize } from '../../src/core/normalize';

describe('normalize — accepted shapes (same number, many ways)', () => {
  const sameNumber = [
    '03001234567',
    '0300-1234567',
    '0300 123 4567',
    '0300.123.4567',
    '(0300) 1234567',
    '+92 300 1234567',
    '+923001234567',
    '00923001234567',
    '923001234567',
    '3001234567',
  ];

  for (const input of sameNumber) {
    it(`canonicalises ${JSON.stringify(input)}`, () => {
      const n = normalize(input);
      expect(n.ok).toBe(true);
      expect(n.isPakistan).toBe(true);
      expect(n.kind).toBe('mobile');
      expect(n.e164).toBe('+923001234567');
      expect(n.national).toBe('03001234567');
      expect(n.significant).toBe('3001234567');
      expect(n.rfc3966).toBe('tel:+923001234567');
      expect(displayNational(n)).toBe('0300-1234567');
    });
  }
});

describe('normalize — other PK kinds', () => {
  it('recognises a landline', () => {
    const n = normalize('0421234567');
    expect(n.ok).toBe(true);
    expect(n.kind).toBe('landline');
    expect(n.e164).toBe('+92421234567');
  });

  it('recognises UAN', () => {
    const n = normalize('111123456');
    expect(n.kind).toBe('uan');
    expect(n.ok).toBe(true);
  });

  it('recognises toll free', () => {
    const n = normalize('080012345');
    expect(n.kind).toBe('tollfree');
    expect(n.ok).toBe(true);
  });
});

describe('normalize — rejections carry an honest reason', () => {
  it('empty', () => {
    expect(normalize('').reason).toBe('empty');
    expect(normalize('   ').reason).toBe('empty');
    expect(normalize(null).ok).toBe(false);
    expect(normalize(undefined).reason).toBe('empty');
  });

  it('non numeric', () => {
    expect(normalize('abc').reason).toBe('not-a-number');
    expect(normalize('03oo1234567').reason).toBe('not-a-number');
  });

  it('too short / too long', () => {
    expect(normalize('12345').reason).toBe('too-short');
    expect(normalize('1234567890123456789').reason).toBe('too-long');
  });

  it('foreign number is flagged, not silently PK-ified', () => {
    const n = normalize('+14155552671');
    expect(n.ok).toBe(false);
    expect(n.reason).toBe('not-pakistan');
    expect(n.isPakistan).toBe(false);
    expect(n.e164).toBe('+14155552671');
  });

  it('never throws on junk', () => {
    for (const junk of ['', ' ', '--', '+', '++92', '0', '03', {}, [], 3001234567]) {
      expect(() => normalize(junk)).not.toThrow();
    }
  });

  it('is deterministic', () => {
    const a = normalize('0300-1234567');
    const b = normalize('0300-1234567');
    expect(a).toEqual(b);
  });
});

describe('normalize — odd but possible', () => {
  it('10-digit 03 number is possible but not valid', () => {
    const n = normalize('0300123456');
    expect(n.valid).toBe(false);
    expect(n.possible).toBe(true);
    expect(n.ok).toBe(true);
  });

  it('12-digit 03 number is possible but not valid', () => {
    const n = normalize('030012345678');
    expect(n.valid).toBe(false);
    expect(n.possible).toBe(true);
  });

  it('unallocated prefix still normalises', () => {
    const n = normalize('03101234567');
    expect(n.ok).toBe(true);
    expect(n.kind).toBe('mobile');
    expect(mobilePrefix(n)).toBe('0310');
  });
});

describe('deriveKind', () => {
  it('maps national shapes', () => {
    expect(deriveKind('03001234567', '3001234567')).toBe('mobile');
    expect(deriveKind('0300123456', '300123456')).toBe('unknown');
    expect(deriveKind('0421234567', '421234567')).toBe('landline');
    expect(deriveKind('111123456', '111123456')).toBe('uan');
    expect(deriveKind('080012345', '80012345')).toBe('tollfree');
    expect(deriveKind(undefined, undefined)).toBe('unknown');
  });
});
