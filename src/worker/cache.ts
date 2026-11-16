/**
 * Cache + counters. Two implementations behind one tiny port:
 *  - memory (Node tests, local dev, no KV binding)
 *  - Cloudflare KV (production)
 */
import type { CachePort, Deps, KVLike } from './types.ts';

export function memoryCache(deps: Deps): CachePort & { size(): number } {
  const store = new Map<string, { value: string; expires: number }>();
  return {
    async get(key) {
      const hit = store.get(key);
      if (!hit) return null;
      if (hit.expires && hit.expires < deps.now()) {
        store.delete(key);
        return null;
      }
      return hit.value;
    },
    async put(key, value, ttlSeconds) {
      store.set(key, { value, expires: deps.now() + ttlSeconds * 1000 });
    },
    size: () => store.size,
  };
}

export function kvCache(kv: KVLike): CachePort {
  return {
    get: (key) => kv.get(key),
    put: (key, value, ttlSeconds) => kv.put(key, value, { expirationTtl: ttlSeconds }),
  };
}

/** yyyymmdd in UTC — the quota window. */
export function dayKey(at: number): string {
  return new Date(at).toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Per-provider daily counter, used to stay inside free tiers instead of
 * discovering the hard limit by failing in production.
 */
export class Counters {
  constructor(
    private cache: CachePort,
    private deps: Deps,
  ) {}

  private key(provider: string) {
    return `q:${provider}:${dayKey(this.deps.now())}`;
  }

  async used(provider: string): Promise<number> {
    const raw = await this.cache.get(this.key(provider));
    return raw ? Number(raw) || 0 : 0;
  }

  async bump(provider: string): Promise<number> {
    const next = (await this.used(provider)) + 1;
    await this.cache.put(this.key(provider), String(next), 60 * 60 * 30);
    return next;
  }

  async all(providers: string[]): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const p of providers) out[p] = await this.used(p);
    return out;
  }

  async cooldown(provider: string, seconds: number): Promise<void> {
    await this.cache.put(`cd:${provider}`, '1', seconds);
  }

  async inCooldown(provider: string): Promise<boolean> {
    return (await this.cache.get(`cd:${provider}`)) !== null;
  }
}
