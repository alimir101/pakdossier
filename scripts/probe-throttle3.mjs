const r = await fetch('http://127.0.0.1:8788/pakdb?number=03004512345', { signal: AbortSignal.timeout(120000) });
const j = await r.json();
console.log('ok=' + j.ok, 'attempts=' + j.attempts, 'ms=' + j.ms);
if (j.html) {
  if (/TOO MANY SEARCHES/i.test(j.html)) console.log('LIMITED: ' + /TOO MANY SEARCHES[^.]*/.exec(j.html)[0]);
  else {
    const t = j.html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ');
    const i = t.indexOf('TOTAL HITS');
    console.log('REPORT: ' + t.slice(i, i + 400));
  }
}
