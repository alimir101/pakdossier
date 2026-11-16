import { describe, expect, it } from 'vitest';
import { analyseNumber } from '../../src/core/analyse';

describe('analyseNumber', () => {
  it('empty for blank input', () => {
    expect(analyseNumber('').stage).toBe('empty');
    expect(analyseNumber('   ').stage).toBe('empty');
  });

  it('bad with a reason for junk', () => {
    const a = analyseNumber('abc');
    expect(a.stage).toBe('bad');
    if (a.stage === 'bad') expect(a.n.reason).toBe('not-a-number');
  });

  it('ok for a valid mobile and resolves the original network offline', () => {
    const a = analyseNumber('0300-1234567');
    expect(a.stage).toBe('ok');
    if (a.stage === 'ok') {
      expect(a.n.e164).toBe('+923001234567');
      expect(a.info?.allocated).toBe(true);
      expect(a.info?.operator).toBe('Jazz');
      expect(a.info?.mnpWarning).toBe(true);
      expect(a.info?.liveNetworkCheck).toContain('76367');
    }
  });

  it('reports an unallocated prefix honestly instead of guessing', () => {
    const a = analyseNumber('03101234567');
    expect(a.stage).toBe('ok');
    if (a.stage === 'ok') expect(a.info?.allocated).toBe(false);
  });

  it('gives no prefix info for a landline', () => {
    const a = analyseNumber('0421234567');
    expect(a.stage).toBe('ok');
    if (a.stage === 'ok') {
      expect(a.n.kind).toBe('landline');
      expect(a.info).toBeUndefined();
    }
  });
});
