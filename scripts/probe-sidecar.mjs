const base = 'http://127.0.0.1:8788';
const h = await fetch(base + '/healthz', { signal: AbortSignal.timeout(8000) });
console.log('healthz:', h.status, (await h.text()).slice(0, 200));
const t0 = Date.now();
const r = await fetch(base + '/pakdb?number=03331234567', { signal: AbortSignal.timeout(90000) });
const j = await r.json();
console.log('pakdb:', r.status, 'ok=' + j.ok, 'ms=' + (Date.now() - t0), 'attempts=' + j.attempts);
if (j.html) {
  const text = j.html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
  const i = text.indexOf('TOTAL HITS');
  console.log('  ' + text.slice(i, i + 320));
}
