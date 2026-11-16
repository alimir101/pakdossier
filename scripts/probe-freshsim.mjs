/** Does freshsimownerdetails.org.pk return owner data server-side, with no Turnstile? */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const URL_ = process.env.SITE ?? 'https://freshsimownerdetails.org.pk/';
const NUMBERS = ['03331234567', '923331234567', '03451234567'];

const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

for (const n of NUMBERS) {
  for (const field of ['number', 'search']) {
    try {
      const r = await fetch(URL_, {
        method: 'POST',
        headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded', referer: URL_ },
        body: new URLSearchParams({ [field]: n }).toString(),
        redirect: 'follow',
        signal: AbortSignal.timeout(30000),
      });
      const html = await r.text();
      const flat = strip(html);
      const cnic = flat.match(/\d{5}-\d{7}-\d/)?.[0] ?? flat.match(/\b\d{13}\b/)?.[0] ?? null;
      const hasNum = flat.includes(n) || flat.includes(n.slice(1));
      const idx = flat.search(/CNIC|Name|Owner|Mobile/i);
      console.log(`\n${field}=${n} -> ${r.status} len=${html.length} cnic=${cnic ?? '-'} mentionsNumber=${hasNum}`);
      if (cnic || /Name\s*:/.test(flat)) {
        console.log('   >>> ' + flat.slice(Math.max(0, idx - 80), idx + 300));
      }
      if (r.status === 200 && html.length > 300000) {
        // look for a result table
        const rows = [...html.matchAll(/<t[rd][^>]*>([\s\S]{0,120}?)<\/t[rd]>/gi)].map((m) => strip(m[1]).trim()).filter(Boolean).slice(0, 14);
        if (rows.length) console.log('   cells:', rows.join(' | ').slice(0, 240));
      }
    } catch (e) {
      console.log(`${field}=${n} ERR ${e.cause?.code ?? e.message}`);
    }
  }
}
