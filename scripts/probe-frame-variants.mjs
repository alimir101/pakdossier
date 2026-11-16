/** The widget frame URL 404s. Find which variant actually resolves. */
const SITEKEY = '0x4AAAAAADMujqAjT0iboJUw';
const BASE = 'https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile';

const variants = [
  `${BASE}/f/av0`,
  `${BASE}/f/av0/`,
  `${BASE}/f/av0/rch/aa/0x4AAAAAADMujqAjT0iboJUw/light/normal/new/normal?lang=auto`,
  `${BASE}/f/av0/rch/aa/0x4AAAAAADMujqAjT0iboJUw/light/fbE/new/normal?lang=auto`,
  `https://challenges.cloudflare.com/turnstile/v0/a/${SITEKEY}/light/normal`,
  `https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/g/turnstile/f/av0`,
  `https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/f/av0/rch/aa/${SITEKEY}/light`,
];

for (const url of variants) {
  try {
    const r = await fetch(url, {
      headers: { accept: 'text/html,*/*', referer: 'https://pakistandataba.se/databases/sim.php' },
      signal: AbortSignal.timeout(15000),
    });
    const body = await r.text();
    console.log(`${r.status}  len=${String(body.length).padStart(7)}  ct=${(r.headers.get('content-type') ?? '-').slice(0, 24).padEnd(24)}  ${url.replace('https://challenges.cloudflare.com', '')}`);
  } catch (e) {
    console.log(`ERR ${e.cause?.code ?? e.message}  ${url}`);
  }
}
