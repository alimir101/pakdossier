/**
 * What does whoseno.com actually expose for a PK number, keylessly?
 * If it carries carrier / line type, it can be our zero-signup provider.
 */
import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const strip = (h) =>
  h
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '-')
    .replace(/\s+/g, ' ');

for (const n of ['03004439955', '03001234567']) {
  try {
    const r = await fetch(`https://www.whoseno.com/pk/${n}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25000) });
    const h = await r.text();
    const t = strip(h);
    console.log(`\n=== /pk/${n} status=${r.status} len=${h.length}`);
    for (const kw of ['Line Type', 'Location', 'Prefix', 'Carrier', 'Network', 'Numbering', 'Jazz', 'Zong', 'Ufone', 'Telenor', 'mobile']) {
      const i = t.indexOf(kw);
      if (i >= 0) console.log(`  [${kw}] … ${t.slice(Math.max(0, i - 90), i + 130)}`);
    }
    const ld = [...h.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].slice(0, 200));
    if (ld.length) console.log('  ld+json:', ld.join(' | '));
  } catch (e) {
    console.log(`\n=== /pk/${n} ERR ${e.cause?.code || e.message}`);
  }
}
