import { describe, expect, it } from 'vitest';
import { addHistory, clearHistory, HISTORY_CAP, HISTORY_KEY, loadHistory, relativeAge, type StorageLike } from '../../src/core/history';

function fakeStorage(seed?: string): StorageLike & { dump: () => string | null; broken?: boolean } {
  let value: string | null = seed ?? null;
  return {
    getItem: () => value,
    setItem: (_k, v) => {
      value = v;
    },
    removeItem: () => {
      value = null;
    },
    dump: () => value,
  };
}

const entry = (n: string, extra: Partial<ReturnType<typeof base>> = {}) => ({ ...base(n), ...extra });
const base = (n: string) => ({ national: n, e164: `+92${n.slice(1)}`, at: 1_700_000_000_000 });

describe('history', () => {
  it('starts empty and tolerates no storage at all', () => {
    expect(loadHistory(undefined)).toEqual([]);
    expect(addHistory(undefined, base('03001234567'))).toHaveLength(1);
  });

  it('stores newest first and dedupes by number', () => {
    const s = fakeStorage();
    addHistory(s, entry('03001234567'));
    addHistory(s, entry('03211234567'));
    addHistory(s, entry('03001234567', { at: 2 }));

    const list = loadHistory(s);
    expect(list.map((e) => e.e164)).toEqual(['+923001234567', '+923211234567']);
    expect(list).toHaveLength(2);
  });

  it('caps the list', () => {
    const s = fakeStorage();
    for (let i = 0; i < HISTORY_CAP + 10; i++) addHistory(s, { national: `0300000${i}`, e164: `+92${i}`, at: i });
    expect(loadHistory(s)).toHaveLength(HISTORY_CAP);
  });

  it('survives corrupt json instead of throwing', () => {
    expect(loadHistory(fakeStorage('{not json'))).toEqual([]);
    expect(loadHistory(fakeStorage('"a string"'))).toEqual([]);
    expect(loadHistory(fakeStorage('[{"e164":"+92"},{"nope":1}]'))).toEqual([]);
  });

  it('clears', () => {
    const s = fakeStorage();
    addHistory(s, base('03001234567'));
    expect(clearHistory(s)).toEqual([]);
    expect(loadHistory(s)).toEqual([]);
  });

  it('uses a versioned key so a schema change never breaks old data', () => {
    expect(HISTORY_KEY).toContain('pakdossier');
    expect(HISTORY_KEY).toMatch(/v\d/);
  });

  it('formats relative ages', () => {
    const now = 1_700_000_000_000;
    expect(relativeAge({ ...base('0300'), at: now - 5_000 }, now)).toBe('5s');
    expect(relativeAge({ ...base('0300'), at: now - 120_000 }, now)).toBe('2m');
    expect(relativeAge({ ...base('0300'), at: now - 7_200_000 }, now)).toBe('2h');
    expect(relativeAge({ ...base('0300'), at: now - 172_800_000 }, now)).toBe('2d');
  });
});
