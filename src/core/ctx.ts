/**
 * What we actually know, assembled from three sources with different trust:
 *  - the number the user typed (offline analysis)
 *  - a CTNIC the user typed themselves (highest trust)
 *  - a CNIC a mirror gave us (lowest trust, and dismissible)
 *
 * Kept pure so the "mirror CNIC unlocks the official portals" behaviour is
 * testable without a DOM.
 */
import { isCnic } from './formats';
import type { PortalCtx } from './portals';

export interface CtxInput {
  national?: string;
  cnicTyped?: string;
  /** CNIC discovered from a mirror, only when the user has not typed one */
  discoveredCnic?: string;
  ignoreDiscovered?: boolean;
}

export interface CtxResult {
  ctx: PortalCtx;
  /** where the CNIC in ctx came from, for honest labelling */
  cnicSource: 'typed' | 'mirror' | 'none';
}

export function buildPortalCtx(input: CtxInput): CtxResult {
  const typed = isCnic(input.cnicTyped) ? input.cnicTyped : undefined;
  const discovered = !input.ignoreDiscovered && isCnic(input.discoveredCnic) ? input.discoveredCnic : undefined;

  const cnic = typed ?? discovered;
  return {
    ctx: { national: input.national, cnic },
    cnicSource: typed ? 'typed' : discovered ? 'mirror' : 'none',
  };
}
