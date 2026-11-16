import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_PORTAL,
  OFFICIAL_SHORTCODE,
  cnicSimCountSmsLink,
  cnicVerifySmsLink,
  formatCnic,
  imeiSmsLink,
  isCnic,
  liveNetworkSmsLink,
  smsLink,
  telLink,
  voterSmsLink,
  waLink,
} from '../../src/core/formats';

describe('smsLink', () => {
  it('builds an sms URI with an encoded body', () => {
    expect(smsLink('76367', 'N 03001234567')).toBe('sms:76367?body=N%2003001234567');
  });

  it('builds a bare sms URI without body', () => {
    expect(smsLink('668')).toBe('sms:668');
  });
});

describe('official short codes', () => {
  it('uses the documented codes', () => {
    expect(OFFICIAL_SHORTCODE.liveNetwork).toBe('76367');
    expect(OFFICIAL_SHORTCODE.simOnCnic).toBe('668');
    expect(OFFICIAL_SHORTCODE.cnicVerify).toBe('7000');
    expect(OFFICIAL_SHORTCODE.voter).toBe('8300');
    expect(OFFICIAL_SHORTCODE.imei).toBe('8484');
  });

  it('builds the live-network SMS for every national shape', () => {
    const want = 'sms:76367?body=N%2003001234567';
    expect(liveNetworkSmsLink('03001234567')).toBe(want);
    expect(liveNetworkSmsLink('+923001234567')).toBe(want);
    expect(liveNetworkSmsLink('923001234567')).toBe(want);
    expect(liveNetworkSmsLink('3001234567')).toBe(want);
  });

  it('returns undefined for a landline', () => {
    expect(liveNetworkSmsLink('0421234567')).toBeUndefined();
    expect(liveNetworkSmsLink('')).toBeUndefined();
  });

  it('builds CNIC short-code links only for a 13-digit CNIC', () => {
    const cnic = '3520212345671';
    expect(cnicSimCountSmsLink(cnic)).toBe('sms:668?body=3520212345671');
    expect(cnicVerifySmsLink(cnic)).toBe('sms:7000?body=3520212345671');
    expect(voterSmsLink(cnic)).toBe('sms:8300?body=3520212345671');
    expect(cnicSimCountSmsLink('352021234567')).toBeUndefined();
  });

  it('builds an IMEI link only for 15 digits', () => {
    expect(imeiSmsLink('123456789012345')).toBe('sms:8484?body=123456789012345');
    expect(imeiSmsLink('12345')).toBeUndefined();
  });
});

describe('CNIC helpers', () => {
  it('formats and validates', () => {
    expect(formatCnic('3520212345671')).toBe('35202-1234567-1');
    expect(formatCnic('35202-1234567-1')).toBe('35202-1234567-1');
    expect(isCnic('3520212345671')).toBe(true);
    expect(isCnic('35202-1234567-1')).toBe(true);
    expect(isCnic('1111111111111')).toBe(false);
    expect(isCnic('0520212345671')).toBe(false); // CNIC never starts with 0
    expect(isCnic('352021234567')).toBe(false);
  });
});

describe('tel / whatsapp', () => {
  it('builds tel and wa links', () => {
    expect(telLink('+923001234567')).toBe('tel:+923001234567');
    expect(waLink('+923001234567')).toBe('https://wa.me/923001234567');
    expect(waLink('+923001234567', 'salam')).toBe('https://wa.me/923001234567?text=salam');
  });
});

describe('official portals', () => {
  it('are all https and non empty', () => {
    for (const [key, url] of Object.entries(OFFICIAL_PORTAL)) {
      expect(url, key).toMatch(/^https:\/\//);
      expect(url.length, key).toBeGreaterThan(12);
    }
  });
});
