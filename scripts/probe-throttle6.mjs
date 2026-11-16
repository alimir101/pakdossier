const r = await fetch('http://127.0.0.1:8788/pakdb?number=03551234567', { signal: AbortSignal.timeout(150000) });
const j = await r.json();
const t = (j.html ?? '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
console.log('ok=' + j.ok, 'attempts=' + j.attempts, 'ms=' + j.ms);
console.log(/TOO MANY SEARCHES/i.test(t) ? 'LIMITED: ' + /TOO MANY SEARCHES[^.]*/.exec(t)[0] : /TOTAL HITS/i.test(t) ? 'REPORT' : 'other');
