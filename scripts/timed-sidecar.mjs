const t0 = Date.now();
try {
  const r = await fetch('http://127.0.0.1:8788/pakdb?number=03331234567', { signal: AbortSignal.timeout(240000) });
  const j = await r.json();
  const t = (j.html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const state = /TOO MANY SEARCHES/i.test(t) ? 'LIMITED' : /TOTAL HITS/i.test(t) ? 'REPORT' : (j.reason ?? 'other');
  console.log(`sidecar: HTTP ${r.status} ok=${j.ok} attempts=${j.attempts} ms=${Date.now() - t0} -> ${state}`);
  if (state === 'REPORT') console.log('  ', t.slice(t.indexOf('TOTAL HITS'), t.indexOf('TOTAL HITS') + 300));
  if (!j.ok) console.log('  detail:', j.detail);
} catch (e) { console.log('ERR after', Date.now() - t0, 'ms:', e.message); }
