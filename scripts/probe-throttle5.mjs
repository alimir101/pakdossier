const nums = ['03004512345', '03331234567'];
for (const n of nums) {
  const r = await fetch('http://127.0.0.1:8788/pakdb?number=' + n, { signal: AbortSignal.timeout(150000) });
  const j = await r.json();
  const t = (j.html ?? '').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ');
  const state = /TOO MANY SEARCHES/i.test(t) ? 'LIMITED: ' + /TOO MANY SEARCHES[^.]*/.exec(t)[0]
    : /TOTAL HITS/i.test(t) ? 'REPORT' : /CAPTCHA REQUIRED/i.test(t) ? 'CAPTCHA' : /VERIFICATION FAILED/i.test(t) ? 'VERIFY-FAILED' : 'UNKNOWN';
  console.log(`\n${n}: ok=${j.ok} attempts=${j.attempts} ms=${j.ms} -> ${state}`);
  if (state === 'REPORT') { const i = t.indexOf('TOTAL HITS'); console.log('   ' + t.slice(i, i + 420)); }
}
