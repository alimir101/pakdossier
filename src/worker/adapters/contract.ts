/**
 * Adapter contract. Every provider — keyless HTML or keyed JSON — implements
 * exactly this, so the pool can treat them uniformly and report honest failures.
 */
import type { CarrierKind, Confidence, Deps, Env, FailureReason, ProviderFields } from '../types.ts';

export type { ProviderFields };

export interface AdapterInput {
  e164: string;
  national: string;
  significant: string;
}

export interface AdapterCtx extends Deps {
  key?: string;
  timeoutMs: number;
  /** worker env, so an adapter can read non-secret config (e.g. a sidecar URL) */
  env?: Partial<Env>;
  /** user asked to bypass caches — must reach the sidecar, not just the worker */
  fresh?: boolean;
}

export interface Adapter {
  id: string;
  /** does this provider require an API key */
  needsKey: boolean;
  /** env var that must be present beyond a key (e.g. PAKDB_BROWSER_URL) */
  requiresEnv?: string;
  /** what this provider's `carrier` field means (never overstated) */
  carrierKind: CarrierKind;
  /** default confidence for this provider's output */
  confidence: Confidence;
  /** known free monthly quota, if the provider publishes one */
  quotaPerMonth?: number;
  /**
   * minimum deadline this provider needs, regardless of the global setting.
   * A real browser (cold navigation + captcha token) is far slower than an API.
   */
  timeoutMsMin?: number;
  run(input: AdapterInput, ctx: AdapterCtx): Promise<ProviderFields>;
}

/** Adapter-shaped failure so the pool can report a precise reason. */
export class AdapterError extends Error {
  constructor(
    readonly reason: FailureReason,
    message: string,
    /** for 'rate-limited': how long the provider said to wait */
    readonly retryAfterMinutes?: number,
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

/** Small helpers shared by every adapter. */
export async function getJson(ctx: AdapterCtx, url: string): Promise<unknown> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ctx.timeoutMs);
  try {
    const r = await ctx.fetch(url, { headers: { accept: 'application/json' }, signal: ac.signal });
    if (r.status === 429) throw new AdapterError('rate-limited', `HTTP 429 from ${new URL(url).host}`);
    if (r.status === 401 || r.status === 403) throw new AdapterError('no-key', `HTTP ${r.status} from ${new URL(url).host}`);
    if (!r.ok) throw new AdapterError('http', `HTTP ${r.status} from ${new URL(url).host}`);
    return await r.json();
  } catch (e) {
    if (e instanceof AdapterError) throw e;
    const err = e as { name?: string; cause?: { code?: string } };
    if (err.name === 'AbortError' || err.name === 'TimeoutError') throw new AdapterError('timeout', `timeout on ${new URL(url).host}`);
    throw new AdapterError('network', `${new URL(url).host}: ${err.cause?.code ?? (e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function getText(ctx: AdapterCtx, url: string): Promise<string> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ctx.timeoutMs);
  try {
    const r = await ctx.fetch(url, {
      headers: {
        accept: 'text/html',
        'user-agent': 'PakDossier/0.1 (offline-first PK number dossier)',
      },
      signal: ac.signal,
    });
    if (r.status === 429) throw new AdapterError('rate-limited', `HTTP 429 from ${new URL(url).host}`);
    if (!r.ok) throw new AdapterError('http', `HTTP ${r.status} from ${new URL(url).host}`);
    return await r.text();
  } catch (e) {
    if (e instanceof AdapterError) throw e;
    const err = e as { name?: string };
    if (err.name === 'AbortError' || err.name === 'TimeoutError') throw new AdapterError('timeout', `timeout on ${new URL(url).host}`);
    throw new AdapterError('network', `${new URL(url).host}: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Strip a provider string field safely ("null", "N/A" -> undefined). */
export function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s && s !== 'null' && s !== 'N/A' ? s : undefined;
}

export function num(v: unknown): number | undefined {
  const s = typeof v === 'number' ? v : Number(str(v));
  return Number.isFinite(s) ? s : undefined;
}
