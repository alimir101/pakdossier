const r = await fetch('https://api.github.com/repos/h4ckf0r0day/obscura/releases/latest', { headers: { 'user-agent': 'pakdossier' } });
console.log('status', r.status);
const j = await r.json();
console.log('tag:', j.tag_name, '| published:', j.published_at);
for (const a of j.assets ?? []) console.log(`  ${a.name}  ${(a.size/1048576).toFixed(1)}MB  ${a.browser_download_url}`);
