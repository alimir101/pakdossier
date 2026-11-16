const H = { 'user-agent': 'osint-scout', accept: 'application/vnd.github+json' };
const extra = [
  'd60/twikit', 'subzeroid/instagrapi', 'Leaflet/Leaflet', 'openlayers/openlayers',
  'jsvine/pdfplumber', 'graphviz/graphviz', 'Ekultek/WhatBreach', 'beeper/linkedin',
  'joeyism/linkedin_scraper',
];
const rows = [];
for (const full of extra) {
  try {
    const r = await fetch('https://api.github.com/repos/' + full, { headers: H, signal: AbortSignal.timeout(30000) });
    if (r.status === 403) { console.log('RATELIMIT'); break; }
    if (!r.ok) { console.log(`ERR ${full} HTTP ${r.status}`); rows.push({ repo: full, err: 'HTTP_' + r.status }); continue; }
    const j = await r.json();
    rows.push({
      repo: j.full_name, desc: (j.description || '').slice(0, 150), lang: j.language, stars: j.stargazers_count,
      pushed: j.pushed_at, license: j.license?.spdx_id || 'none', archived: j.archived, homepage: j.homepage || '',
    });
    console.log(`OK ${j.full_name} | pushed=${j.pushed_at?.slice(0, 10)} stars=${j.stargazers_count} lic=${j.license?.spdx_id || 'none'} arch=${j.archived} lang=${j.language} | ${(j.description || '').slice(0, 90)}`);
  } catch (e) { console.log('ERR', full, e.message); }
  await new Promise(r => setTimeout(r, 150));
}
const fs = await import('node:fs');
const prev = JSON.parse(fs.readFileSync('research/github-verified.json', 'utf8'));
fs.writeFileSync('research/github-verified.json', JSON.stringify([...prev, ...rows], null, 1));
console.log('total rows now', prev.length + rows.length);
