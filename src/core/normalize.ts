/**
 * Offline normalizer. Zero network. Deterministic. Never throws.
 *
 * Uses libphonenumber metadata (bundled, offline) for structural validity and
 * canonical formatting. `getType()` is unreliable in the default metadata build
 * (returns undefined for PK), so the *kind* is derived here from the national
 * digits — deterministic and testable.
 */
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import type { NormalizeReason, NormalizedNumber, NumberKind } from './types';

const MIN_DIGITS = 8;
const MAX_DIGITS = 15;

function reject(raw: string, digits: string, reason: NormalizeReason): NormalizedNumber {
  return {
    ok: false,
    reason,
    raw,
    digits,
    kind: 'unknown',
    valid: false,
    possible: false,
    isPakistan: false,
  };
}

/** Derive the number kind from national digits — no metadata needed. */
export function deriveKind(national: string | undefined, significant: string | undefined): NumberKind {
  if (!national) return 'unknown';
  const sig = significant ?? '';
  // UAN is written 111-XXXXXX: the significant digits start with 111, the
  // national form is 0111-XXXXXX (so national.startsWith('111') would miss it).
  if (sig.startsWith('111') && sig.length === 9) return 'uan';
  if (national.startsWith('080')) return 'tollfree';
  if (national.startsWith('03')) return national.length === 11 && sig.length === 10 ? 'mobile' : 'unknown';
  if (national.startsWith('0')) return 'landline';
  return 'unknown';
}

/**
 * Normalize any human way of writing a Pakistani number into a canonical shape.
 */
export function normalize(input: unknown): NormalizedNumber {
  const raw = typeof input === 'string' ? input : String(input ?? '');
  const trimmed = raw.trim();

  if (!trimmed) return reject(raw, '', 'empty');

  const cleaned = trimmed.replace(/[\s\-()._/]/g, '');
  if (!/^\+?\d+$/.test(cleaned)) return reject(raw, cleaned.replace(/\D/g, ''), 'not-a-number');

  const hadPlus = cleaned.startsWith('+');
  let digits = hadPlus ? cleaned.slice(1) : cleaned;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!digits) return reject(raw, digits, 'empty');

  if (digits.length < MIN_DIGITS) return reject(raw, digits, 'too-short');
  if (digits.length > MAX_DIGITS) return reject(raw, digits, 'too-long');

  // An explicit + (or an explicit 00) means international: keep it international.
  // Only a bare leading 92 is treated as the country code.
  const candidate = hadPlus || digits.startsWith('92') ? `+${digits}` : digits;

  let parsed: ReturnType<typeof parsePhoneNumberFromString>;
  try {
    parsed = parsePhoneNumberFromString(candidate, 'PK');
  } catch {
    return reject(raw, digits, 'not-a-number');
  }
  if (!parsed) return reject(raw, digits, 'unrecognized-prefix');

  const isPakistan = parsed.country === 'PK';
  const significant = parsed.nationalNumber;
  const national = `0${significant}`;
  const base: NormalizedNumber = {
    ok: false,
    raw,
    digits,
    kind: deriveKind(national, significant),
    valid: parsed.isValid(),
    possible: parsed.isPossible(),
    isPakistan,
    national,
    significant,
    e164: parsed.number,
    international: parsed.formatInternational(),
    rfc3966: parsed.getURI(),
  };

  if (!isPakistan) return { ...base, ok: false, reason: 'not-pakistan' };
  if (!base.valid && !base.possible) return { ...base, ok: false, reason: 'unrecognized-prefix' };

  return { ...base, ok: true };
}

/** Human display: 0345-1234567 for mobiles, national digits otherwise. */
export function displayNational(n: NormalizedNumber): string {
  if (!n.national) return n.raw;
  if (n.kind === 'mobile' && n.national.length === 11) {
    return `${n.national.slice(0, 4)}-${n.national.slice(4)}`;
  }
  return n.national;
}

/** The 4-digit mobile prefix (03XX) from a normalized mobile, else undefined. */
export function mobilePrefix(n: NormalizedNumber): string | undefined {
  if (n.kind !== 'mobile' || !n.national || n.national.length < 4) return undefined;
  return n.national.slice(0, 4);
}
