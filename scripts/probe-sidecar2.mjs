const r = await fetch('http://127.0.0.1:8788/pakdb?number=03331234567', { signal: AbortSignal.timeout(120000) });
console.log('status', r.status);
console.log(JSON.stringify(await r.json(), null, 2).slice(0, 1200));
