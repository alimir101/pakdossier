import { describe, expect, it } from 'vitest';
import { AdapterError, type Adapter } from '../../src/worker/adapters/contract';
import { Counters, memoryCache } from '../../src/worker/cache';
import { runPool } from '../../src/worker/pool';
import type { Deps } from '../../src/worker/types';

const NOW = 1_700_000_000_000;
const deps: Deps = { fetch: (async () => new Response('{}')) as unknown as typeof fetch, now: () => NOW };
const input = { e164: '+923001234567', national: '03001234567', significant: '3001234567' };

function harness() {
  const cache = memoryCache(deps);
  return { cache, counters: new Counters(cache, deps) };
}

function fake(id: string, over: Partial<Adapter> = {}): Adapter {
  return {
    id,
    needsKey: false,
    carrierKind: 'prefix',
    confidence: 'low',
    run: async () => ({ carrier: id }),
    ...over,
  } as Adapter;
}

describe('pool — failover', () => {
  it('keeps going when one provider dies, and says why', async () => {
    const { counters } = harness();
    const dying = fake('dying', {
      run: async () => {
        throw new AdapterError('network', 'boom');
      },
    });
    const good = fake('good');

    const out = await runPool(input, {}, { ...deps, counters, timeoutMs: 100, adapters: [{ adapter: dying }, { adapter: good }] });

    expect(out.results.map((r) => r.provider)).toEqual(['good']);
    expect(out.partial).toHaveLength(1);
    expect(out.partial[0]).toMatchObject({ provider: 'dying', reason: 'network' });
  });

  it('never throws when everything fails', async () => {
    const { counters } = harness();
    const a = fake('a', { run: async () => { throw new AdapterError('http', 'x'); } });
    const out = await runPool(input, {}, { ...deps, counters, timeoutMs: 100, adapters: [{ adapter: a }] });
    expect(out.results).toHaveLength(0);
    expect(out.partial).toHaveLength(1);
  });

  it('reports when nothing is configured at all', async () => {
    const { counters } = harness();
    const out = await runPool(input, {}, { ...deps, counters, timeoutMs: 100, adapters: [] });
    expect(out.results).toHaveLength(0);
    expect(out.partial[0].reason).toBe('no-key');
  });
});

describe('pool — free-tier discipline', () => {
  it('skips a provider before it hits its monthly limit', async () => {
    const { counters } = harness();
    let called = 0;
    const limited = fake('limited', {
      quotaPerMonth: 10,
      run: async () => {
        called++;
        return { carrier: 'x' };
      },
    });
    for (let i = 0; i < 9; i++) await counters.bump('limited');

    const out = await runPool(input, {}, { ...deps, counters, timeoutMs: 100, adapters: [{ adapter: limited }] });
    expect(called).toBe(0);
    expect(out.partial[0]).toMatchObject({ provider: 'limited', reason: 'quota' });
  });

  it('increments the counter on success', async () => {
    const { counters } = harness();
    const out = await runPool(input, {}, {
      ...deps,
      counters,
      timeoutMs: 100,
      adapters: [{ adapter: fake('ok') }],
    });
    expect(out.results).toHaveLength(1);
    expect(await counters.used('ok')).toBe(1);
  });

  it('cools a provider down after a rate limit', async () => {
    const { counters } = harness();
    let called = 0;
    const rl = fake('rl', {
      run: async () => {
        called++;
        throw new AdapterError('rate-limited', 'HTTP 429');
      },
    });
    await runPool(input, {}, { ...deps, counters, timeoutMs: 100, adapters: [{ adapter: rl }] });
    expect(await counters.inCooldown('rl')).toBe(true);

    const out = await runPool(input, {}, { ...deps, counters, timeoutMs: 100, adapters: [{ adapter: rl }] });
    expect(called).toBe(1);
    expect(out.partial[0].reason).toBe('cooldown');
  });

  it('gives a slow provider its own deadline floor', async () => {
    const { counters } = harness();
    let seenTimeout = 0;
    const slow = fake('browserish', {
      timeoutMsMin: 60_000,
      run: async (_input, ctx) => {
        seenTimeout = ctx.timeoutMs;
        return { carrier: 'x' };
      },
    });
    await runPool(input, {}, { ...deps, counters, timeoutMs: 8_000, adapters: [{ adapter: slow }] });
    expect(seenTimeout).toBe(60_000);

    // and never shortens a deliberately longer global setting
    await runPool(input, {}, { ...deps, counters, timeoutMs: 90_000, adapters: [{ adapter: slow }] });
    expect(seenTimeout).toBe(90_000);
  });

  it('honours the provider\'s own retry-after instead of a guess', async () => {
    const { cache, counters } = harness();
    const rl = fake('mirror', {
      run: async () => {
        throw new AdapterError('rate-limited', 'try again in 49 minutes', 49);
      },
    });
    const out = await runPool(input, {}, { ...deps, counters, timeoutMs: 100, adapters: [{ adapter: rl }] });

    expect(out.partial[0].retryAfterMinutes).toBe(49);
    // the cooldown must outlast the window the provider actually asked for
    const raw = await cache.get('cd:mirror');
    expect(raw).toBe('1');
  });

  it('does not claim a retry-after when the provider gave none', async () => {
    const { counters } = harness();
    const rl = fake('plain', {
      run: async () => {
        throw new AdapterError('rate-limited', 'HTTP 429');
      },
    });
    const out = await runPool(input, {}, { ...deps, counters, timeoutMs: 100, adapters: [{ adapter: rl }] });
    expect(out.partial[0].retryAfterMinutes).toBeUndefined();
  });

  it('stops early once a live carrier plus enough results exist', async () => {
    const { counters } = harness();
    const order: string[] = [];
    const mk = (id: string, kind: Adapter['carrierKind']) =>
      fake(id, {
        carrierKind: kind,
        run: async () => {
          order.push(id);
          return { carrier: id };
        },
      });
    const out = await runPool(input, {}, {
      ...deps,
      counters,
      timeoutMs: 100,
      enoughResults: 2,
      maxAttempts: 5,
      adapters: [{ adapter: mk('live', 'live') }, { adapter: mk('second', 'prefix') }, { adapter: mk('third', 'prefix') }],
    });
    expect(order).toEqual(['live', 'second']);
    expect(out.results).toHaveLength(2);
  });

  it('respects the attempts budget', async () => {
    const { counters } = harness();
    const order: string[] = [];
    const mk = (id: string) =>
      fake(id, {
        run: async () => {
          order.push(id);
          return { carrier: id };
        },
      });
    const out = await runPool(input, {}, {
      ...deps,
      counters,
      timeoutMs: 100,
      maxAttempts: 1,
      enoughResults: 9,
      adapters: [{ adapter: mk('a') }, { adapter: mk('b') }],
    });
    expect(order).toEqual(['a']);
    expect(out.partial.some((p) => p.reason === 'quota')).toBe(true);
  });
});
