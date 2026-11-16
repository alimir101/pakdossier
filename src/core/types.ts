/**
 * Core domain types for PakDossier.
 *
 * Honesty contract: every datum carries a `source`, a `confidence` and (when it
 * came off the network) a `fetchedAt`. Nothing here is "official" unless the
 * source says so.
 */

/** How sure we are. Deliberately three levels, never a fake precision. */
export type Confidence = 'high' | 'medium' | 'low';

/** Where a field came from. */
export type Provenance = 'official' | 'public-db' | 'crowd' | 'offline-table' | 'provider';

export interface Sourced<T> {
  value: T;
  source: string;
  provenance: Provenance;
  confidence: Confidence;
  fetchedAt?: string;
  note?: string;
}

/** What kind of number did the user type. */
export type NumberKind = 'mobile' | 'landline' | 'uan' | 'tollfree' | 'premium' | 'unknown';

export type NormalizeReason =
  | 'empty'
  | 'too-short'
  | 'too-long'
  | 'not-a-number'
  | 'unrecognized-prefix'
  | 'not-pakistan';

export interface NormalizedNumber {
  ok: boolean;
  reason?: NormalizeReason;
  /** Exactly what the user typed. */
  raw: string;
  /** Digits only, after stripping +/00/trunk noise. */
  digits: string;
  kind: NumberKind;
  /** true when the number is structurally valid for its kind. */
  valid: boolean;
  /** true when structurally possible but suspicious (length/prefix odd). */
  possible: boolean;
  isPakistan: boolean;
  /** 03XXXXXXXXX — national, trunk prefix included. */
  national?: string;
  /** 3XXXXXXXXX — national significant number. */
  significant?: string;
  /** +923XXXXXXXXX */
  e164?: string;
  /** +92 300 1234567 */
  international?: string;
  /** tel:+923001234567 */
  rfc3966?: string;
}

/** Operator status — "current" only means "as allocated", never "live". */
export type Allocation = 'current' | 'merged' | 'mvno' | 'regional' | 'legacy';

export interface PrefixRange {
  /** inclusive, 4-digit national prefix, e.g. "0300" */
  start: string;
  /** inclusive, e.g. "0309" */
  end: string;
  operator: string;
  brand?: string;
  mnc: string;
  allocation: Allocation;
  confidence: Confidence;
  regionNote?: string;
  note?: string;
  sources: string[];
}

export interface PrefixLookup {
  /** did we find an allocated range for this prefix */
  allocated: boolean;
  prefix: string;
  operator?: string;
  brand?: string;
  mnc?: string;
  allocation?: Allocation;
  confidence?: Confidence;
  regionNote?: string;
  note?: string;
  /** Always true for PK mobiles: the prefix is the *original* network, not the live one. */
  mnpWarning: boolean;
  /** How to get the live network officially. */
  liveNetworkCheck: string;
  sources: string[];
}
