/** What does the widget's frame URL actually return? (headers + body) */
const URLS = [
  'https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/f/av0',
  'https://challenges.cloudflare.com/turnstile/v0/api.js',
];
const REFERER = 'https://pakistandataba.se/databases/sim.php';

for (const url of URLS) {
  for (const withRef of [false, true]) {
    try {
      const r = await fetch(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml,application/javascript,*/*',
          ...(withRef ? { referer: REFERER, origin: 'https://pakistandataba.se' } : {}),
        },
        signal: AbortSignal.timeout(20000),
      });
      const body = await r.text();
      console.log(`\n=== ${url.slice(0, 70)}${withRef ? '  (+referer)' : ''}`);
      console.log('  status:', r.status, '| ct:', r.headers.get('content-type'), '| len:', body.length);
      console.log('  cache:', r.headers.get('cache-control'), '| vary:', r.headers.get('vary'));
      console.log('  head:', body.slice(0, 200).replace(/\s+/g, ' '));
      const scriptSrc = [...body.matchAll(/<script[^>]*src=["']([^"']+)["']/gi)].map((m) => m[1]).slice(0, 4);
      if (scriptSrc.length) console.log('  script srcs:', scriptSrc);
    } catch (e) {
      console.log(`\n=== ${url.slice(0, 70)} ERR ${e.cause?.code ?? e.message}`);
    }
  }
}
