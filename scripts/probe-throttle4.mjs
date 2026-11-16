const r = await fetch('http://127.0.0.1:8788/pakdb?number=03004512345', { signal: AbortSignal.timeout(150000) });
console.log('status', r.status);
const j = await r.json();
console.log(JSON.stringify({...j, html: j.html ? j.html.length + ' bytes' : undefined}, null, 2));
