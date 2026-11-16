const r = await fetch('http://127.0.0.1:8788/pakdb?query=3520296868939', { signal: AbortSignal.timeout(150000) });
const j = await r.json();
console.log('status', r.status, 'ok=' + j.ok, 'kind=' + (j.kind ?? '-'), 'attempts=' + j.attempts, 'site=' + (j.site ?? '-'));
const t = (j.html ?? '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
console.log(/TOO MANY SEARCHES/i.test(t) ? 'LIMITED: ' + /TOO MANY SEARCHES[^.]*/.exec(t)[0] : /TOTAL HITS/i.test(t) ? 'REPORT' : (j.reason ?? 'other') + ' ' + (j.detail ?? ''));
