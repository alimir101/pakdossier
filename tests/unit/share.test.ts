import { describe, expect, it } from 'vitest';
import { buildShareSvg, buildShareText, escapeXml } from '../../src/core/share';

const data = {
  national: '0333-1234567',
  e164: '+923331234567',
  kind: 'mobile',
  operator: 'Ufone',
  ownerName: 'muhammad kashif',
  cnic: '35202-9686893-9',
  address: 'nain sukh shahdrah City LAHORE - KARACHI',
  cnicFromMirror: true,
  portalCount: 14,
};

describe('share text', () => {
  it('carries the facts in Roman Urdu', () => {
    const text = buildShareText(data, 'ur');
    expect(text).toContain('0333-1234567');
    expect(text).toContain('muhammad kashif');
    expect(text).toContain('35202-9686893-9');
    expect(text).toContain('Ufone');
    expect(text).toContain('7000');
  });

  it('labels a mirror CNIC as public data, not official', () => {
    expect(buildShareText(data, 'en')).toMatch(/public data — verify via 7000/);
    expect(buildShareText({ ...data, cnicFromMirror: false }, 'en')).not.toContain('public data');
  });

  it('switches language', () => {
    expect(buildShareText(data, 'en')).toContain('Name:');
    expect(buildShareText(data, 'ur')).toContain('Naam:');
  });

  it('omits missing fields instead of printing blanks', () => {
    const t = buildShareText({ national: '0300-1234567' }, 'en');
    expect(t).not.toContain('undefined');
    expect(t.split('\n')).toHaveLength(2); // headline + official line
  });
});

describe('share SVG card', () => {
  const svg = buildShareSvg(data);

  it('is a self-contained svg with no external refs', () => {
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    // the only http:// is the svg namespace itself
    expect(svg).not.toContain('href="http');
    expect(svg.match(/http:\/\//g)).toHaveLength(1);
    expect(svg).not.toContain('<image');
  });

  it('draws every fact', () => {
    for (const needle of ['0333-1234567', '+923331234567', 'Ufone', 'muhammad kashif', '35202-9686893-9', 'mobile']) {
      expect(svg, needle).toContain(needle);
    }
  });

  it('marks the CNIC as public data', () => {
    expect(svg).toContain('CNIC (public data)');
    expect(svg).toContain('official record nahi');
  });

  it('escapes XML so a name with & or <> cannot break the card', () => {
    const hostile = buildShareSvg({ ...data, ownerName: 'Ali & Sons <Ltd>', address: 'A "quoted" st' });
    expect(hostile).toContain('Ali &amp; Sons &lt;Ltd&gt;');
    expect(hostile).toContain('&quot;quoted&quot;');
    expect(hostile).not.toContain('<Ltd>');
  });

  it('truncates long values instead of overflowing the card', () => {
    const long = buildShareSvg({ ...data, ownerName: 'X'.repeat(80), address: 'Y'.repeat(120) });
    expect(long).not.toContain('X'.repeat(80));
    expect(long).not.toContain('Y'.repeat(120));
  });

  it('works with the minimum data', () => {
    const svgMin = buildShareSvg({ national: '0300-1234567' });
    expect(svgMin).toContain('0300-1234567');
    expect(svgMin).not.toContain('undefined');
  });

  it('escapeXml handles all five entities', () => {
    expect(escapeXml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &apos;');
  });
});
