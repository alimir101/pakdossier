/**
 * The token presence check passes. So does a REAL search happen, and what does
 * a hit look like? Use numbers we know exist (03004439955 has crowd reports).
 */
import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const SITE = 'https://pakistandataba.se/databases/sim.php';

const numbers = ['923004439955', '923001234567', '923211234567', '923451234567', '923001111111', '923331234567'];

/** everything between the query form and the data-sources grid */
function resultRegion(html) {
  const after = html.indexOf('console-hint');
  const before = html.indexOf('// DATA SOURCES');
  const start = after >= 0 ? after : 0;
  const end = before > start ? before : html.length;
  return html
    .slice(start, end)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

for (const n of numbers) {
  try {
    const r = await fetch(SITE, {
      method: 'POST',
      headers: {
        'user-agent': UA,
        'content-type': 'application/x-www-form-urlencoded',
        referer: SITE,
        origin: 'https://pakistandataba.se',
      },
      body: `search_query=${n}&cf-turnstile-response=x`,
      signal: AbortSignal.timeout(30000),
    });
    const html = await r.text();
    const region = resultRegion(html);
    console.log(`\n=== ${n} status=${r.status} len=${html.length}`);
    console.log(`  region(${region.length}): ${region.slice(0, 420) || '(khali)'}`);
    const tables = [...html.matchAll(/<table[\s\S]{0,900}?<\/table>/gi)].map((m) => m[0].replace(/\s+/g, ' ').slice(0, 500));
    if (tables.length) console.log(`  TABLES(${tables.length}): ${tables.join(' || ')}`);
  } catch (e) {
    console.log(`\n=== ${n} ERR ${e.cause?.code || e.message}`);
  }
}
