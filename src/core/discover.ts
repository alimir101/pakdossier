/**
 * Turning provider output into the thing the whole app is about: a CNIC.
 *
 * NADRA's data is CNIC-keyed, so once a mirror gives us a CNIC the entire
 * official portal launcher unlocks. This module is the bridge, and it is honest
 * about the fact that the CNIC came from a mirror, not from NADRA.
 */
import type { LookupOutcome } from '../api/client';
import { formatCnic, isCnic } from './formats';
import type { Confidence } from './types';

export interface OwnerFinding {
  name?: string;
  /** formatted #####-#######-# */
  cnic: string;
  address?: string;
  provider: string;
  confidence: Confidence;
  totalHits?: number;
  /** always false in v1 — mirrors are not the registry */
  official: false;
}

/**
 * First record with a structurally valid CNIC wins. Records are only ever
 * produced by the owner-name provider, so this never invents a CNIC from a
 * carrier field.
 */
export function discoverOwner(outcome: LookupOutcome | { state: 'idle' } | { state: 'loading' }): OwnerFinding | undefined {
  if (outcome.state !== 'ok') return undefined;

  // highest confidence first, then the provider's own order
  const ranked = [...outcome.data.results].sort((a, b) => rank(b.confidence) - rank(a.confidence));

  for (const r of ranked) {
    for (const rec of r.fields.records ?? []) {
      if (!isCnic(rec.cnic)) continue;
      const finding: OwnerFinding = {
        cnic: formatCnic(rec.cnic),
        provider: r.provider,
        confidence: r.confidence,
        official: false,
      };
      if (rec.name) finding.name = rec.name;
      if (rec.address) finding.address = rec.address;
      if (typeof r.fields.totalHits === 'number') finding.totalHits = r.fields.totalHits;
      return finding;
    }
  }
  return undefined;
}

function rank(c: Confidence): number {
  return c === 'high' ? 3 : c === 'medium' ? 2 : 1;
}
