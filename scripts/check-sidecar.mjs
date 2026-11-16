const r = await fetch('http://127.0.0.1:8788/pakdb?number=03331234567', { signal: AbortSignal.timeout(60000) });
console.log('sidecar HTTP', r.status);
console.log((await r.text()).slice(0, 400));
const h = await fetch('http://127.0.0.1:8788/healthz');
console.log('healthz', h.status, (await h.text()).slice(0, 200));
