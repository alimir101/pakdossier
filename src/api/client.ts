/**
 * Thin client for our own worker. Validates the shape before the UI trusts it —
 * a worker that answers with garbage must not become "facts" on screen.
 */
import type { LookupResponse, ProviderFailure, ProviderSuccess } from '../worker/types';

export const API_BASE = (import.meta.env?.VITE_WORKER_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export type LookupOutcome =
  | { state: 'ok'; data: LookupResponse }
  | { state: 'empty'; partial: ProviderFailure[] }
  | { state: 'invalid'; reason?: string }
  | { state: 'error'; message: string };

function isSuccess(v: unknown): v is ProviderSuccess {
  const o = v as ProviderSuccess;
  return !!o && typeof o.provider === 'string' && typeof o.fields === 'object' && o.fields !== null;
}

function isFailure(v: unknown): v is ProviderFailure {
  const o = v as ProviderFailure;
  return !!o && typeof o.provider === 'string' && typeof o.reason === 'string';
}

/** Parse + validate an unknown worker payload. Never throws. */
export function parseLookupResponse(payload: unknown): LookupOutcome {
  if (!payload || typeof payload !== 'object') return { state: 'error', message: 'khali response' };
  const body = payload as Partial<LookupResponse>;
  if (body.ok !== true) return { state: 'error', message: 'ok != true' };

  const results = Array.isArray(body.results) ? body.results.filter(isSuccess) : [];
  const partial = Array.isArray(body.partial) ? body.partial.filter(isFailure) : [];

  if (results.length === 0) return { state: 'empty', partial };
  return { state: 'ok', data: { ...(body as LookupResponse), results, partial } };
}

export async function lookup(
  number: string,
  opts: { signal?: AbortSignal; fresh?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<LookupOutcome> {
  const f = opts.fetchImpl ?? globalThis.fetch;
  const url = `${API_BASE}/api/lookup?number=${encodeURIComponent(number)}${opts.fresh ? '&fresh=1' : ''}`;
  try {
    const r = await f(url, { signal: opts.signal, headers: { accept: 'application/json' } });
    if (r.status === 400) {
      const body = (await r.json().catch(() => ({}))) as { reason?: string };
      return { state: 'invalid', reason: body.reason };
    }
    if (!r.ok) return { state: 'error', message: `HTTP ${r.status}` };
    return parseLookupResponse(await r.json());
  } catch (e) {
    const err = e as { name?: string; message?: string };
    if (err.name === 'AbortError') return { state: 'error', message: 'timeout' };
    return { state: 'error', message: err.message ?? 'network' };
  }
}

// ---------------------------------------------------------------- CNIC reverse

export interface CnicRecord {
  mobile: string;
  name: string;
  cnic: string;
  address: string;
}

export interface CnicLookup {
  ok: true;
  cnic: string;
  totalHits: number;
  records: CnicRecord[];
  notFound: boolean;
  rateLimitedMinutes?: number;
  ref?: string;
  cached: boolean;
  servedAt: string;
  note?: string;
}

export type CnicOutcome =
  | { state: 'ok'; data: CnicLookup }
  | { state: 'empty'; rateLimitedMinutes?: number; message?: string }
  | { state: 'invalid' }
  | { state: 'error'; message: string };

/** Reverse lookup: which numbers sit on this CNIC. */
export async function lookupCnic(
  cnic: string,
  opts: { signal?: AbortSignal; fresh?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<CnicOutcome> {
  const f = opts.fetchImpl ?? globalThis.fetch;
  const digits = String(cnic ?? '').replace(/\D/g, '');
  const url = `${API_BASE}/api/cnic?cnic=${digits}${opts.fresh ? '&fresh=1' : ''}`;
  try {
    const r = await f(url, { signal: opts.signal, headers: { accept: 'application/json' } });
    if (r.status === 400) return { state: 'invalid' };
    const body = (await r.json().catch(() => ({}))) as Partial<CnicLookup> & { code?: string; message?: string };
    if (r.status === 503 || body.code === 'no-sidecar') {
      return { state: 'empty', message: 'no-sidecar' };
    }
    if (!r.ok || body.ok !== true) return { state: 'error', message: body.message ?? `HTTP ${r.status}` };
    const records = Array.isArray(body.records) ? body.records : [];
    if (records.length === 0) {
      return { state: 'empty', ...(body.rateLimitedMinutes ? { rateLimitedMinutes: body.rateLimitedMinutes } : {}) };
    }
    return { state: 'ok', data: { ...(body as CnicLookup), records } };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    if (err.name === 'AbortError') return { state: 'error', message: 'timeout' };
    return { state: 'error', message: err.message ?? 'network' };
  }
}
