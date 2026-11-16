const r = await fetch('http://127.0.0.1:8788/pakdb?number=03331234567', { signal: AbortSignal.timeout(120000) });
const j = await r.json();
console.log('status', r.status, 'ok', j.ok, 'cached', !!j.cached, 'ms', j.ms);
if (j.html) {
  const t = j.html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
  const i = t.indexOf('TOTAL HITS');
  console.log(i >= 0 ? 'HITS: ' + t.slice(i, i+60) : 'LIMITED: ' + (/TOO MANY SEARCHES[^.]*/.exec(t)?.[0] ?? 'unknown'));
}
