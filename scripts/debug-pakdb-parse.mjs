/** Why did the pakdb adapter fail on the live response? */
const r = await fetch('http://127.0.0.1:8788/pakdb?number=03331234567', { signal: AbortSignal.timeout(120000) });
const j = await r.json();
if (!j.ok) {
  console.log('sidecar failed:', JSON.stringify(j).slice(0, 300));
  process.exit(0);
}
const text = j.html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const i = text.indexOf('TOTAL HITS');
console.log('---- around TOTAL HITS ----');
console.log(text.slice(Math.max(0, i - 60), i + 700));

console.log('\n---- regex checks ----');
console.log('has RECORD FOUND:', /(?:RECORD|RECORDS) FOUND/i.test(text));
const header = /(?:RECORD|RECORDS) FOUND\s*Mobile\s+Name\s+CNIC\s+Address/i.exec(text);
console.log('header match:', header ? 'YES' : 'NO');
if (!header) {
  const k = text.indexOf('FOUND');
  console.log('context after FOUND:', JSON.stringify(text.slice(k, k + 160)));
}

const body = header ? text.slice(header.index + header[0].length).replace(/\s*REF\s*\/\/[\s\S]*$/, '').trim() : '';
const rows = [...body.matchAll(/(92\d{10})\s+(.*?)\s+(\d{13})\s+(.*?)(?=\s+92\d{10}\s|$)/gs)];
console.log('rows matched:', rows.length);
for (const m of rows.slice(0, 3)) console.log('  ', JSON.stringify({ mobile: m[1], name: m[2], cnic: m[3], address: m[4]?.slice(0, 60) }));
