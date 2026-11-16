/**
 * Provider registry: which adapters exist, which are usable with the current
 * env, and in what order they should be tried.
 *
 * Order = "most trustworthy first, cheapest first, and always end with the
 * keyless one" so the app still returns something with zero configuration.
 */
import type { Adapter } from './adapters/contract.ts';
import { abstractapi, ipqs, numlookupapi, numverify, veriphone } from './adapters/json-apis.ts';
import { pakdb } from './adapters/pakdb.ts';
import { whoseno } from './adapters/whoseno.ts';
import type { EnvWithSecrets, ProviderInfo } from './types.ts';

export const KEY_ENV = {
  numlookupapi: 'NUMLOOKUPAPI_KEY',
  veriphone: 'VERIPHONE_KEY',
  ipqs: 'IPQS_KEY',
  abstractapi: 'ABSTRACTAPI_KEY',
  numverify: 'NUMVERIFY_KEY',
} as const;

/**
 * Most valuable first: owner data, then live carrier, then prefix providers by
 * free quota, then the keyless page. Anything unconfigured is skipped but
 * still reported.
 */
export const ADAPTERS: Adapter[] = [pakdb, ipqs, veriphone, numlookupapi, abstractapi, numverify, whoseno];

export function keyFor(env: EnvWithSecrets, adapterId: string): string | undefined {
  const name = (KEY_ENV as Record<string, string>)[adapterId];
  if (!name) return undefined;
  const v = (env as Record<string, unknown>)[name];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function keylessDisabled(env: EnvWithSecrets): boolean {
  return env.DISABLE_KEYLESS === '1' || env.DISABLE_KEYLESS === 'true';
}

/** non-secret env an adapter needs before it can run (e.g. a sidecar URL) */
function hasRequiredEnv(env: EnvWithSecrets, adapter: Adapter): boolean {
  if (!adapter.requiresEnv) return true;
  const v = (env as Record<string, unknown>)[adapter.requiresEnv];
  return typeof v === 'string' && v.trim().length > 0;
}

export interface Candidate {
  adapter: Adapter;
  key?: string;
  /** false = provider exists but is not configured (e.g. missing key) */
  configured?: boolean;
}

/** Adapters worth trying right now (skips keyed ones without a key). */
export function candidates(env: EnvWithSecrets): Candidate[] {
  const out: Candidate[] = [];
  for (const adapter of ADAPTERS) {
    if (adapter.needsKey) {
      const key = keyFor(env, adapter.id);
      if (!key) continue;
      out.push({ adapter, key });
      continue;
    }
    if (adapter.id === 'whoseno' && keylessDisabled(env)) continue;
    out.push({ adapter });
  }
  return out;
}

/**
 * Every adapter, with `configured:false` for keyed ones missing a key, so the
 * pool can *report* them instead of silently dropping them.
 */
export function allCandidates(env: EnvWithSecrets): Candidate[] {
  const out: Candidate[] = [];
  for (const adapter of ADAPTERS) {
    if (adapter.id === 'whoseno' && keylessDisabled(env)) continue;
    if (!hasRequiredEnv(env, adapter)) {
      out.push({ adapter, configured: false });
      continue;
    }
    if (!adapter.needsKey) {
      out.push({ adapter, configured: true });
      continue;
    }
    const key = keyFor(env, adapter.id);
    out.push({ adapter, key, configured: key !== undefined });
  }
  return out;
}

/** Everything, including what is not configured — for /api/health. */
export function providerInfo(env: EnvWithSecrets): ProviderInfo[] {
  return ADAPTERS.map((a) => {
    const envOk = hasRequiredEnv(env, a);
    return {
      id: a.id,
      needsKey: a.needsKey,
      keyPresent: envOk && (a.needsKey ? keyFor(env, a.id) !== undefined : true),
      carrierKind: a.carrierKind,
      quotaPerMonth: a.quotaPerMonth,
      ...(a.requiresEnv ? { requiresEnv: a.requiresEnv } : {}),
    };
  });
}
