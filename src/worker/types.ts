/**
 * Worker types. Shared by the worker and (via the client) the app.
 *
 * Everything that comes off the network is tagged with provider, provenance and
 * confidence — the worker never invents an "official" claim.
 */

export type Confidence = 'high' | 'medium' | 'low';

/** What a provider's `carrier` field actually proves. */
export type CarrierKind = 'live' | 'prefix' | 'none';

export interface ProviderFields {
  carrier?: string;
  lineType?: string;
  location?: string;
  numberingArea?: string;
  valid?: boolean;
  active?: boolean;
  reports?: number;
  safeReports?: number;
  spamReports?: number;
  note?: string;
  extra?: Record<string, string | number | boolean>;
  /** owner rows (leaked-mirror providers only) */
  records?: Array<{ mobile: string; name: string; cnic: string; address: string }>;
  totalHits?: number;
}

export interface ProviderSuccess {
  provider: string;
  carrierKind: CarrierKind;
  confidence: Confidence;
  fields: ProviderFields;
  fetchedAt: string;
  cached: boolean;
  latencyMs: number;
}

export type FailureReason =
  | 'no-key'
  | 'quota'
  | 'cooldown'
  | 'rate-limited'
  | 'http'
  | 'timeout'
  | 'parse'
  | 'network'
  | 'not-found';

export interface ProviderFailure {
  provider: string;
  reason: FailureReason;
  detail?: string;
  /** for 'rate-limited': minutes the provider asked us to wait */
  retryAfterMinutes?: number;
}

export interface LookupResponse {
  ok: true;
  input: { e164: string; national: string; significant: string };
  results: ProviderSuccess[];
  partial: ProviderFailure[];
  cached: boolean;
  servedAt: string;
}

export interface ErrorResponse {
  ok: false;
  code: 'invalid-number' | 'bad-request' | 'not-found' | 'internal';
  message: string;
  reason?: string;
}

export interface ProviderInfo {
  id: string;
  needsKey: boolean;
  keyPresent: boolean;
  carrierKind: CarrierKind;
  quotaPerMonth?: number;
  /** env var required in addition to (or instead of) a key */
  requiresEnv?: string;
}

export interface HealthResponse {
  ok: true;
  service: 'pakdossier-worker';
  version: string;
  providers: ProviderInfo[];
  keyless: boolean;
  cache: 'kv' | 'memory';
}

/** Cache port — works with Cloudflare KV or an in-memory map. */
export interface CachePort {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

/** Bindings + injectables. All optional so the worker boots with zero config. */
export interface Env {
  CACHE?: KVLike;
  ALLOWED_ORIGIN?: string;
  DISABLE_KEYLESS?: string;
  LOOKUP_TIMEOUT_MS?: string;
  CACHE_TTL_SECONDS?: string;
  /** where the browser sidecar lives, e.g. http://127.0.0.1:8788 */
  PAKDB_BROWSER_URL?: string;
}

export interface Secrets {
  NUMLOOKUPAPI_KEY?: string;
  VERIPHONE_KEY?: string;
  IPQS_KEY?: string;
  ABSTRACTAPI_KEY?: string;
  NUMVERIFY_KEY?: string;
}

export interface Deps {
  fetch: typeof fetch;
  now: () => number;
}

export type EnvWithSecrets = Env & Secrets;
