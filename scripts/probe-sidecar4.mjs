const r = await fetch('http://127.0.0.1:8788/pakdb?number=03211234567', { signal: AbortSignal.timeout(150000) });
const j = await r.json();
console.log('ok=' + j.ok, 'attempts=' + j.attempts, 'site=' + (j.site ?? '-'), 'ms=' + j.ms, 'detail=' + (j.detail ?? '-'));
const t = (j.html ?? '').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
console.log(/TOO MANY SEARCHES/i.test(t) ? '  LIMITED: ' + /TOO MANY SEARCHES[^.]*/.exec(t)[0] : /TOTAL HITS/i.test(t) ? '  REPORT: ' + t.slice(t.indexOf('TOTAL HITS'), t.indexOf('TOTAL HITS')+380) : '  ?');
