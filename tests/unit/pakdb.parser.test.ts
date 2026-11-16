import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parsePakdbReport } from '../../src/worker/adapters/pakdb-html';

const three = readFileSync('tests/fixtures/pakdb-report-3-records.html', 'utf8');
const none = readFileSync('tests/fixtures/pakdb-report-empty.html', 'utf8');
const limited = readFileSync('tests/fixtures/pakdb-report-ratelimited.html', 'utf8');
const cnic = readFileSync('tests/fixtures/pakdb-report-cnic.html', 'utf8');

describe('parsePakdbReport — per-network throttle', () => {
  it('reads the rate-limit page instead of calling it "no records"', () => {
    const r = parsePakdbReport(limited);
    expect(r.rateLimitedMinutes).toBe(49);
    expect(r.records).toEqual([]);
  });

  it('does not confuse it with a real empty report', () => {
    expect(parsePakdbReport(none).rateLimitedMinutes).toBeUndefined();
    expect(parsePakdbReport(limited).rateLimitedMinutes).toBeDefined();
  });
});

describe('parsePakdbReport — real captured report', () => {
  it('pulls every record out with CNIC as the row anchor', () => {
    const r = parsePakdbReport(three);
    expect(r.notFound).toBe(false);
    expect(r.totalHits).toBe(3);
    expect(r.records).toHaveLength(3);
    expect(r.records[0]).toEqual({
      mobile: '923331234567',
      name: 'muhammad kashif',
      cnic: '3520296868939',
      address: 'nain sukh shahdrah City LAHORE - KARACHI',
    });
    expect(r.records[1]!.name).toBe('GOUHAR BILAL');
  });

  it('captures the report reference', () => {
    expect(parsePakdbReport(three).ref).toBe('OSINT-736d1567');
  });

  it('keeps an address with no delimiters intact', () => {
    const r = parsePakdbReport(three);
    for (const rec of r.records) {
      expect(rec.cnic).toMatch(/^\d{13}$/);
      expect(rec.mobile).toMatch(/^92\d{10}$/);
      expect(rec.address.length).toBeGreaterThan(3);
    }
  });
});

describe('parsePakdbReport — no records', () => {
  it('reports notFound and zero hits without inventing rows', () => {
    const r = parsePakdbReport(none);
    expect(r.notFound).toBe(true);
    expect(r.totalHits).toBe(0);
    expect(r.records).toEqual([]);
    expect(r.ref).toBe('OSINT-c932ce77');
  });
});

describe('parsePakdbReport — CNIC search (different column order)', () => {
  it('parses rows even when CNIC comes before Mobile', () => {
    const r = parsePakdbReport(cnic);
    expect(r.totalHits).toBe(2);
    expect(r.records).toHaveLength(2);
    expect(r.records[0]).toEqual({
      mobile: '923331234567',
      name: 'muhammad kashif',
      cnic: '3520296868939',
      address: 'nain sukh shahdrah City LAHORE - KARACHI',
    });
    expect(r.records[1]!.mobile).toBe('923001111111');
  });

  it('does not swallow the next record into the previous address', () => {
    for (const rec of parsePakdbReport(cnic).records) {
      expect(rec.address).not.toContain('GOUHAR');
      expect(rec.address.length).toBeLessThan(80);
    }
  });

  it('tolerates a Mobile-first header too (same code path)', () => {
    const r = parsePakdbReport(three);
    expect(r.records).toHaveLength(3);
  });
});

describe('parsePakdbReport — degenerate input', () => {
  it('handles page chrome with no report at all', () => {
    const r = parsePakdbReport('<html><body><p>CAPTCHA REQUIRED</p></body></html>');
    expect(r.notFound).toBe(true);
    expect(r.records).toEqual([]);
  });

  it('handles a failed verification page', () => {
    const r = parsePakdbReport('<p>VERIFICATION FAILED — the captcha check did not pass.</p>');
    expect(r.notFound).toBe(true);
    expect(r.records).toEqual([]);
  });

  it('never throws on empty or junk', () => {
    for (const input of ['', ' ', '<html>', 'x'.repeat(5000)]) {
      expect(() => parsePakdbReport(input)).not.toThrow();
    }
  });
});
