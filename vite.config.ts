import { defineConfig } from 'vitest/config';
import type { Connect, Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { handleRequest } from './src/worker/index.ts';

/**
 * Mounts the real worker on /api in dev AND preview, so `npm run dev` gives a
 * working full stack with no wrangler and no Cloudflare account.
 */
function workerApi(): Plugin {
  const mount = (middlewares: Connect.Server) => {
    middlewares.use((req, res, next) => {
      const url = req.url ?? '';
      if (!url.startsWith('/api')) return next();
      void (async () => {
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) {
          if (typeof v === 'string') headers.set(k, v);
        }
        const request = new Request(`http://localhost${url}`, { method: req.method ?? 'GET', headers });
        const response = await handleRequest(request, {
          LOOKUP_TIMEOUT_MS: '9000',
          CACHE_TTL_SECONDS: '600',
          ...(process.env.ALLOWED_ORIGIN ? { ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN } : {}),
          ...(process.env.DISABLE_KEYLESS ? { DISABLE_KEYLESS: process.env.DISABLE_KEYLESS } : {}),
          ...(process.env.IPQS_KEY ? { IPQS_KEY: process.env.IPQS_KEY } : {}),
          ...(process.env.VERIPHONE_KEY ? { VERIPHONE_KEY: process.env.VERIPHONE_KEY } : {}),
          ...(process.env.NUMLOOKUPAPI_KEY ? { NUMLOOKUPAPI_KEY: process.env.NUMLOOKUPAPI_KEY } : {}),
          ...(process.env.ABSTRACTAPI_KEY ? { ABSTRACTAPI_KEY: process.env.ABSTRACTAPI_KEY } : {}),
          ...(process.env.NUMVERIFY_KEY ? { NUMVERIFY_KEY: process.env.NUMVERIFY_KEY } : {}),
          ...(process.env.PAKDB_BROWSER_URL ? { PAKDB_BROWSER_URL: process.env.PAKDB_BROWSER_URL } : {}),
        });
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(await response.text());
      })().catch(next);
    });
  };

  return {
    name: 'pakdossier-worker-api',
    configureServer: (server) => mount(server.middlewares),
    configurePreviewServer: (server) => mount(server.middlewares),
  };
}

export default defineConfig({
  plugins: [preact(), workerApi()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    reporters: ['default'],
    // This sandbox denies child_process spawn with piped stdio, so the default
    // `forks` pool dies with EPERM. worker_threads have no such problem.
    pool: 'threads',
    isolate: false,
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
