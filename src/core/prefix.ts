/**
 * Offline prefix → original network lookup.
 *
 * HARD RULE: this tells you the network the range was ALLOCATED to, not the
 * network the SIM is on today. MNP has existed in Pakistan since 2007. So the
 * result always carries `mnpWarning` and the official way to get the live network.
 */
import raw from './prefixes.pk.json';
import type { Confidence, PrefixLookup, PrefixRange } from './types';

interface PrefixFile {
  country: string;
  callingCode: string;
  verifiedOn: string;
  mobileNationalLength: number;
  mobileSignificantLength: number;
  mobileTrunkPrefix: string;
  note: string;
  sourceIndex: Record<string, string>;
  ranges: PrefixRange[];
  unallocated: { ranges: Array<{ start: string; end: string }>; confidence: Confidence; note: string };
}

export const prefixFile = raw as unknown as PrefixFile;

export const OFFICIAL_LIVE_NETWORK_CHECK = 'SMS "N 03XXXXXXXXX" to 76367 (Rs ~2, official, PTA)';
export const MNP_WARNING =
  'Ye prefix ka ORIGINAL network hai. Number port (MNP) ho chuka ho to live network alag ho sakta hai.';

/** 4-digit mobile prefix (03XX) from anything resembling a PK mobile. */
export function prefixOf(input: string): string | undefined {
  const d = String(input ?? '').replace(/\D/g, '');
  let national: string | undefined;
  if (d.length >= 11 && d.startsWith('0')) national = d.slice(0, 11);
  else if (d.length === 12 && d.startsWith('92')) national = `0${d.slice(2)}`;
  else if (d.length === 10 && d.startsWith('3')) national = `0${d}`;
  if (!national || !national.startsWith('03')) return undefined;
  return national.slice(0, 4);
}

function inRange(prefix: string, start: string, end: string): boolean {
  return prefix >= start && prefix <= end;
}

/** Does this prefix fall in a documented allocation gap? */
export function isUnallocated(prefix: string): boolean {
  return prefixFile.unallocated.ranges.some((r) => inRange(prefix, r.start, r.end));
}

/**
 * Look up a prefix. Always returns a full object; `allocated:false` is a normal,
 * honest answer, not an error.
 */
export function lookupPrefix(input: string): PrefixLookup {
  const prefix = prefixOf(input) ?? '';
  const base: PrefixLookup = {
    allocated: false,
    prefix,
    mnpWarning: true,
    liveNetworkCheck: OFFICIAL_LIVE_NETWORK_CHECK,
    sources: [],
  };

  if (!prefix) {
    return { ...base, note: 'Prefix samajh nahi aaya — mobile number 03XX-XXXXXXX format mein dein.' };
  }

  const hit = prefixFile.ranges.find((r) => inRange(prefix, r.start, r.end)) as PrefixRange | undefined;

  if (hit) {
    return {
      ...base,
      allocated: true,
      operator: hit.operator,
      brand: hit.brand,
      mnc: hit.mnc,
      allocation: hit.allocation,
      confidence: hit.confidence,
      regionNote: hit.regionNote,
      note: hit.note,
      sources: hit.sources.map((k) => prefixFile.sourceIndex[k] ?? k),
    };
  }

  if (isUnallocated(prefix)) {
    return {
      ...base,
      confidence: prefixFile.unallocated.confidence,
      note: prefixFile.unallocated.note,
      sources: prefixFile.unallocated.ranges.map((r) => `${r.start}–${r.end} (documented gap)`),
    };
  }

  return {
    ...base,
    confidence: 'low',
    note: 'Ye prefix table mein nahi mila — allocated range ke bahar hai.',
    sources: [],
  };
}

/**
 * Data-integrity guard. Runs in tests so a bad edit can never ship silently:
 * malformed codes, overlaps, unknown source keys, unsorted ranges.
 */
export function validatePrefixData(): string[] {
  const issues: string[] = [];
  const seen: Array<{ start: string; end: string; who: string }> = [];
  const isCode = (s: string) => /^\d{4}$/.test(s);

  const all = [
    ...prefixFile.ranges.map((r) => ({ start: r.start, end: r.end, who: `${r.operator} ${r.start}-${r.end}` })),
    ...prefixFile.unallocated.ranges.map((r) => ({ start: r.start, end: r.end, who: `unallocated ${r.start}-${r.end}` })),
  ];

  for (const r of all) {
    if (!isCode(r.start) || !isCode(r.end)) issues.push(`range code 4-digit nahi: ${r.who}`);
    if (r.start > r.end) issues.push(`start > end: ${r.who}`);
  }
  for (const r of prefixFile.ranges) {
    if (!(r.allocation in { current: 1, merged: 1, mvno: 1, regional: 1, legacy: 1 })) {
      issues.push(`unknown allocation "${r.allocation}" in ${r.operator} ${r.start}`);
    }
    if (!['high', 'medium', 'low'].includes(r.confidence)) {
      issues.push(`unknown confidence "${r.confidence}" in ${r.operator} ${r.start}`);
    }
    if (!r.sources.length) issues.push(`no sources for ${r.operator} ${r.start}`);
    for (const s of r.sources) {
      if (!(s in prefixFile.sourceIndex)) issues.push(`source key "${s}" sourceIndex mein nahi (${r.operator} ${r.start})`);
    }
  }

  const sorted = [...all].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!;
    for (const prev of seen) {
      if (cur.start <= prev.end) issues.push(`overlap: ${cur.who} vs ${prev.who}`);
    }
    seen.push(cur);
  }
  return issues;
}
