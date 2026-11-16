const base = 'http://127.0.0.1:8090';
const h = await (await fetch(base + '/api/health')).json();
console.log('pakdb configured:', h.providers.find(p => p.id === 'pakdb')?.keyPresent, '| keyless:', h.keyless);
const b = await (await fetch(base + '/api/lookup?number=03331234567')).json();
for (const p of b.partial ?? []) console.log(`  partial ${p.provider}: ${p.reason}${p.detail ? ' — ' + p.detail.slice(0, 60) : ''}`);
