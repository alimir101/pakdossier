/**
 * The one decision the whole UI hangs on: what did the user actually type?
 *
 * Kept out of the component so it is unit-testable without a DOM, and so the
 * "empty / bad / ok" branching can never drift from what the tests assert.
 */
import { normalize } from './normalize';
import { lookupPrefix } from './prefix';
import type { NormalizedNumber, PrefixLookup } from './types';

export type Analysis =
  | { stage: 'empty' }
  | { stage: 'bad'; n: NormalizedNumber }
  | { stage: 'ok'; n: NormalizedNumber; info?: PrefixLookup };

export function analyseNumber(raw: string): Analysis {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return { stage: 'empty' };

  const n = normalize(raw);
  if (!n.ok) return { stage: 'bad', n };

  // Prefix table only describes 03xx ranges.
  const info = n.kind === 'mobile' && n.national ? lookupPrefix(n.national) : undefined;
  return { stage: 'ok', n, info };
}
