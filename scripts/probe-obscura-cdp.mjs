const r = await fetch('http://127.0.0.1:9222/json/version', { signal: AbortSignal.timeout(8000) });
console.log('version endpoint:', r.status);
console.log(await r.text());
const l = await fetch('http://127.0.0.1:9222/json/list', { signal: AbortSignal.timeout(8000) });
console.log('list:', l.status, (await l.text()).slice(0, 300));
