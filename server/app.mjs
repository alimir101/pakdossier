/**
 * Production server: serves the built PWA and mounts the real worker on /api.
 *
 * No framework, no extra deps. The worker is used exactly as the tests use it
 * (Web-standard Request/Response), so preview, tests and production share one
 * code path — only the transport differs.
 *
 * Build the worker first:  npm run build:server
 */
import { createServer } from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';
const DIST = resolve(process.env.DIST_DIR ?? 'dist');
// resolve against this file, not cwd — the container may start from anywhere
const WORKER_ENTRY = process.env.WORKER_ENTRY
  ? resolve(process.env.WORKER_ENTRY)
  : new URL('../dist-server/index.js', import.meta.url).href;

const { handleRequest } = await import(WORKER_ENTRY);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'geolocation=(), microphone=(), camera=()',
  'content-security-policy': [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
};

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
};

/** Static file resolution with path-traversal guard + SPA fallback. */
async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  // normalize() gives backslashes on Windows; the cache rules below compare on '/'
  const safe = `/${normalize(pathname).replace(/^[\\/]+/, '').replace(/\\/g, '/')}`;
  const file = join(DIST, safe);
  if (!file.startsWith(DIST)) return send(res, 403, 'Forbidden');

  let size;
  try {
    const st = await stat(file);
    if (st.isDirectory()) throw new Error('dir');
    size = st.size;
  } catch {
    // hashed assets 404 normally; everything else gets the SPA shell
    if (extname(safe)) return send(res, 404, 'Not found');
    try {
      const html = await readFile(join(DIST, 'index.html'));
      return send(res, 200, html, {
        'content-type': TYPES['.html'],
        'cache-control': 'no-cache',
        ...SECURITY_HEADERS,
      });
    } catch {
      return send(res, 404, 'Not built — run `npm run build`');
    }
  }

  const ext = extname(file);
  // hashed asset names are immutable; the shell and sw.js must never be stale
  const immutable = /\.[A-Za-z0-9_-]{8,}\.(js|css)$/.test(safe);
  const cache = safe === '/sw.js' || safe === '/index.html' || safe === '/manifest.webmanifest'
    ? 'no-cache'
    : immutable
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=3600';

  res.writeHead(200, {
    'content-type': TYPES[ext] ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': cache,
    ...SECURITY_HEADERS,
  });
  createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    // container healthcheck — must not touch providers
    if (url.pathname === '/healthz') {
      return send(res, 200, JSON.stringify({ ok: true, service: 'pakdossier-app' }), { 'content-type': 'application/json' });
    }

    if (url.pathname.startsWith('/api')) {
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
      const request = new Request(url, { method: req.method ?? 'GET', headers });
      try {
        const response = await handleRequest(request, process.env);
        res.writeHead(response.status, {
          ...Object.fromEntries(response.headers),
          'x-content-type-options': 'nosniff',
        });
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (e) {
        send(res, 500, JSON.stringify({ ok: false, code: 'internal', message: String(e?.message ?? e) }), {
          'content-type': 'application/json',
        });
      }
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

    // offline API fallback must not be cached by the SW as a real answer — the
    // SW already handles that; here we only do static.
    return serveStatic(req, res, url);
  })().catch((e) => send(res, 500, `server error: ${String(e?.message ?? e)}`));
});

server.listen(PORT, HOST, () => {
  console.log(`[app] listening on http://${HOST}:${PORT}  dist=${DIST}`);
  console.log(`[app] owner lookup: ${process.env.PAKDB_BROWSER_URL ? process.env.PAKDB_BROWSER_URL : 'sidecar NOT configured'}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`[app] ${sig} — closing`);
    server.close(() => process.exit(0));
  });
}
