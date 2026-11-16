import { describe, expect, it } from 'vitest';
import {
  buildAction,
  groupPortals,
  portalFile,
  portalStats,
  validatePortals,
  type PortalCtx,
} from '../../src/core/portals';

const FULL: PortalCtx = {
  national: '03001234567',
  cnic: '3520212345671',
  imei: '123456789012345',
  trackingId: 'ABC123456',
};
const EMPTY: PortalCtx = {};

const byId = (id: string) => {
  const e = portalFile.entries.find((x) => x.id === id);
  if (!e) throw new Error(`missing portal ${id}`);
  return e;
};

describe('portal catalogue integrity', () => {
  it('has no structural problems', () => {
    expect(validatePortals()).toEqual([]);
  });

  it('is a real catalogue, not a stub', () => {
    expect(portalFile.entries.length).toBeGreaterThanOrEqual(20);
    expect(portalFile.categories.length).toBeGreaterThanOrEqual(5);
  });

  it('every entry sits in a declared category', () => {
    const ids = new Set(portalFile.categories.map((c) => c.id));
    for (const e of portalFile.entries) expect(ids.has(e.category), e.id).toBe(true);
  });

  it('all url entries are https (no http downgrade)', () => {
    for (const e of portalFile.entries.filter((x) => x.kind === 'url')) {
      expect(e.url, e.id).toMatch(/^https:\/\//);
    }
  });

  it('every entry is bilingual in label / gives / friction', () => {
    for (const e of portalFile.entries) {
      for (const f of ['label', 'gives', 'friction'] as const) {
        expect(e[f].ur.length, `${e.id}.${f}.ur`).toBeGreaterThan(3);
        expect(e[f].en.length, `${e.id}.${f}.en`).toBeGreaterThan(3);
      }
    }
  });
});

describe('buildAction — SMS entries', () => {
  it('builds the official live-network SMS', () => {
    const a = buildAction(byId('sms-76367'), { national: '03001234567' });
    expect(a.ready).toBe(true);
    expect(a.href).toBe('sms:76367?body=N%2003001234567');
  });

  it('accepts an international number and normalises it', () => {
    const a = buildAction(byId('sms-76367'), { national: '+923001234567' });
    expect(a.href).toBe('sms:76367?body=N%2003001234567');
  });

  it('builds the CNIC short codes', () => {
    const cnicCtx = { cnic: '3520212345671' };
    expect(buildAction(byId('sms-668'), cnicCtx).href).toBe('sms:668?body=3520212345671');
    expect(buildAction(byId('sms-7000'), cnicCtx).href).toBe('sms:7000?body=3520212345671');
    expect(buildAction(byId('sms-8300'), cnicCtx).href).toBe('sms:8300?body=3520212345671');
  });

  it('works with no input when the entry needs none (667)', () => {
    const a = buildAction(byId('sms-667'), EMPTY);
    expect(a.ready).toBe(true);
    expect(a.href).toBe('sms:667?body=MNP');
  });
});

describe('buildAction — readiness is honest about missing input', () => {
  it('is not ready without a CNIC, and says which key is missing', () => {
    const a = buildAction(byId('sms-668'), EMPTY);
    expect(a.ready).toBe(false);
    expect(a.missing).toEqual(['cnic']);
    expect(a.href).toBeUndefined();
  });

  it('rejects a malformed CNIC rather than sending garbage', () => {
    expect(buildAction(byId('sms-7000'), { cnic: '12345' }).ready).toBe(false);
    expect(buildAction(byId('sms-7000'), { cnic: '0520212345671' }).ready).toBe(false);
  });

  it('rejects a landline for a mobile-only SMS entry', () => {
    expect(buildAction(byId('sms-76367'), { national: '0421234567' }).ready).toBe(false);
  });

  it('url entries with no requirements are always ready', () => {
    const a = buildAction(byId('url-mtmis-punjab'), EMPTY);
    expect(a.ready).toBe(true);
    expect(a.href).toBe('https://mtmis.excise.punjab.gov.pk/');
  });
});

describe('grouping', () => {
  it('with no context, still offers the no-input portals', () => {
    const groups = groupPortals(EMPTY);
    const ready = groups.flatMap((g) => g.entries).filter((r) => r.action.ready);
    expect(ready.length).toBeGreaterThan(10);
  });

  it('with full context, everything becomes ready', () => {
    const stats = portalStats(FULL);
    expect(stats.ready).toBe(stats.total);
  });

  it('readyOnly filters away the disabled rows', () => {
    const rows = groupPortals(EMPTY, { readyOnly: true }).flatMap((g) => g.entries);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.action.ready)).toBe(true);
  });

  it('drops empty categories', () => {
    for (const g of groupPortals(FULL)) expect(g.entries.length).toBeGreaterThan(0);
  });
});
