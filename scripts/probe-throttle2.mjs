const base = 'http://127.0.0.1:8788';
try {
  const r = await fetch(base + '/pakdb?number=03331234567&t=' + Date.now(), { signal: AbortSignal.timeout(120000) });
  const j = await r.json();
  console.log('sidecar ok=' + j.ok, 'cached=' + !!j.cached, 'ms=' + j.ms);
  if (j.html) {
    const limited = /TOO MANY SEARCHES/i.test(j.html);
    console.log(limited ? 'LIMITED: ' + /TOO MANY SEARCHES[^.]*/.exec(j.html)[0] : 'REPORT: ' + (/TOTAL HITS \d+/.exec(j.html)||[])[0]);
  }
} catch (e) { console.log('sidecar ERR', e.message); }
