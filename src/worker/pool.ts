/**
 * The pool: run providers in priority order, stop early, and be precise about
 * why anything was skipped or failed.
 *
 * Design rules:
 *  - a provider that is not configured is reported, never silently dropped;
 *  - a free tier is respected via counters *before* the call, not after;
 *  - one provider failing never fails the request.
 */
import { AdapterError, type AdapterInput } from './adapters/contract.ts';
import type { Counters } from './cache.ts';
import { allCandidates, type Candidate } from './registry.ts';
import type { Deps, EnvWithSecrets, FailureReason, LookupResponse, ProviderFailure, ProviderSuccess } from './types.ts';

export interface PoolDeps extends Deps {
  counters: Counters;
  timeoutMs: number;
  /** stop after this many provider attempts (quota friendly) */
  maxAttempts?: number;
  /** stop as soon as one 'live' carrier plus this many results exist */
  enoughResults?: number;
  /** override the registry (tests, experiments) */
  adapters?: Candidate[];
  /** propagate a user-requested cache bypass down to the adapters */
  fresh?: boolean;
}

const COOLDOWN_SECONDS: Partial<Record<FailureReason, number>> = {
  'rate-limited': 60 * 30,
  timeout: 60 * 10,
  network: 60 * 5,
};

export async function runPool(
  input: AdapterInput,
  env: EnvWithSecrets,
  deps: PoolDeps,
): Promise<Omit<LookupResponse, 'input' | 'cached' | 'servedAt' | 'ok'>> {
  const results: ProviderSuccess[] = [];
  const partial: ProviderFailure[] = [];

  const list = deps.adapters ?? allCandidates(env);
  if (list.length === 0) {
    partial.push({ provider: '(none)', reason: 'no-key', detail: 'Koi provider configured nahi.' });
  }

  const maxAttempts = deps.maxAttempts ?? 3;
  const enough = deps.enoughResults ?? 2;
  let attempts = 0;
  const startedAll = deps.now();

  for (const { adapter, key, configured = true } of list) {
    if (!configured) {
      partial.push({ provider: adapter.id, reason: 'no-key', detail: 'key/config set nahi hai (skip)' });
      continue;
    }

    if (attempts >= maxAttempts) {
      partial.push({ provider: adapter.id, reason: 'quota', detail: 'attempts budget khatam (skip)' });
      continue;
    }

    // a user-requested refresh must actually try, even if we are cooling down
    if (!deps.fresh && (await deps.counters.inCooldown(adapter.id))) {
      partial.push({ provider: adapter.id, reason: 'cooldown' });
      continue;
    }

    if (adapter.quotaPerMonth) {
      const used = await deps.counters.used(adapter.id);
      if (used >= Math.floor(adapter.quotaPerMonth * 0.9)) {
        partial.push({
          provider: adapter.id,
          reason: 'quota',
          detail: `${used}/${adapter.quotaPerMonth} is mahine ka 90%+ use ho chuka`,
        });
        continue;
      }
    }

    attempts++;
    const t0 = deps.now();
    try {
      const fields = await adapter.run(input, {
        ...deps,
        key,
        timeoutMs: Math.max(deps.timeoutMs, adapter.timeoutMsMin ?? 0),
        env,
        ...(deps.fresh ? { fresh: true } : {}),
      });
      const success: ProviderSuccess = {
        provider: adapter.id,
        carrierKind: adapter.carrierKind,
        confidence: adapter.confidence,
        fields,
        fetchedAt: new Date(deps.now()).toISOString(),
        cached: false,
        latencyMs: deps.now() - t0,
      };
      results.push(success);
      await deps.counters.bump(adapter.id);

      const haveLive = results.some((r) => r.carrierKind === 'live');
      if (results.length >= enough && haveLive) break;
    } catch (e) {
      const reason: FailureReason = e instanceof AdapterError ? e.reason : 'network';
      partial.push({
        provider: adapter.id,
        reason,
        detail: e instanceof Error ? e.message : String(e),
        ...(e instanceof AdapterError && e.retryAfterMinutes ? { retryAfterMinutes: e.retryAfterMinutes } : {}),
      });
      const cooldown = COOLDOWN_SECONDS[reason];
      // a provider that told us how long to wait knows better than our default
      const wait = e instanceof AdapterError && e.retryAfterMinutes ? e.retryAfterMinutes * 60 : cooldown;
      if (wait) await deps.counters.cooldown(adapter.id, wait);
    }
  }

  void startedAll;
  return { results, partial };
}
