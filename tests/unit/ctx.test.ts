import { describe, expect, it } from 'vitest';
import { buildPortalCtx } from '../../src/core/ctx';
import { portalStats, groupPortals } from '../../src/core/portals';

const NUMBER = '03001234567';
const MIRROR_CNIC = '35202-9686893-9';
const TYPED_CNIC = '35202-1234567-1';

const readyIds = (input: Parameters<typeof buildPortalCtx>[0]) => {
  const { ctx } = buildPortalCtx(input);
  return groupPortals(ctx, { readyOnly: true })
    .flatMap((g) => g.entries)
    .map((r) => r.entry.id);
};

describe('buildPortalCtx', () => {
  it('with only a number, unlocks the number-keyed portals', () => {
    const { ctx, cnicSource } = buildPortalCtx({ national: NUMBER });
    expect(ctx.national).toBe(NUMBER);
    expect(ctx.cnic).toBeUndefined();
    expect(cnicSource).toBe('none');
    expect(readyIds({ national: NUMBER })).toContain('sms-76367');
  });

  it('THE POINT: a mirror-discovered CNIC unlocks every CNIC portal', () => {
    const before = readyIds({ national: NUMBER });
    const after = readyIds({ national: NUMBER, discoveredCnic: MIRROR_CNIC });

    expect(after.length).toBeGreaterThan(before.length);
    for (const id of ['sms-668', 'sms-7000', 'sms-8300', 'url-cnic-sims']) {
      expect(before, `pehle ${id} locked hona chahiye`).not.toContain(id);
      expect(after, `CNIC ke baad ${id} unlock hona chahiye`).toContain(id);
    }
    const { cnicSource } = buildPortalCtx({ national: NUMBER, discoveredCnic: MIRROR_CNIC });
    expect(cnicSource).toBe('mirror');
  });

  it('a typed CNIC outranks the mirror one', () => {
    const { ctx, cnicSource } = buildPortalCtx({ national: NUMBER, cnicTyped: TYPED_CNIC, discoveredCnic: MIRROR_CNIC });
    expect(ctx.cnic).toBe(TYPED_CNIC);
    expect(cnicSource).toBe('typed');
  });

  it('dismissing the mirror CNIC re-locks the CNIC portals', () => {
    const on = portalStats(buildPortalCtx({ national: NUMBER, discoveredCnic: MIRROR_CNIC }).ctx);
    const off = portalStats(buildPortalCtx({ national: NUMBER, discoveredCnic: MIRROR_CNIC, ignoreDiscovered: true }).ctx);
    expect(on.ready).toBeGreaterThan(off.ready);
  });

  it('ignores a malformed CNIC instead of passing it on', () => {
    const { ctx } = buildPortalCtx({ national: NUMBER, discoveredCnic: '12345' });
    expect(ctx.cnic).toBeUndefined();
  });
});
