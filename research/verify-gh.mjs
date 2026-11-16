// Verify GitHub OSINT repos: existence + latest push + stars + license + archived
// Uses api.github.com (authoritative), unauth = 60 req/hr.
const H = { 'user-agent': 'osint-scout', accept: 'application/vnd.github+json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const targets = [
  // username / handle
  'sherlock-project/sherlock', 'soxoj/maigret', 'p1ngul1n0/blackbird', 'WebBreacher/WhatsMyName', 'thewhiteh4t/nexfil',
  // email
  'megadose/holehe', 'khast3x/h8mail',
  // phone
  'sundowndev/phoneinfoga', 'megadose/ignorant',
  // image / exif / metadata
  'exiftool/exiftool', 'drewnoakes/metadata-extractor', 'mattiasw/ExifReader', 'jvoisin/mat2',
  // geo / chrono
  'mourner/suncalc', 'gpsbabel/gpsbabel', 'openstreetmap/iD', 'photoprism/photoprism',
  // social
  'instaloader/instaloader', 'JustAnotherArchivist/snscrape', 'vladkens/twscrape', 'yt-dlp/yt-dlp',
  'mikf/gallery-dl', 'davidteather/TikTok-Api', 'kevinzg/facebook-scraper', 'tomquirk/linkedin-api',
  'Datalux/Osintgram', 'qeeqbox/social-analyzer',
  // domain / ip / host
  'owasp-amass/amass', 'laramies/theHarvester', 'lanmaster53/recon-ng', 'darkoperator/dnsrecon',
  'Findomain/Findomain', 'urbanadventurer/WhatWeb', 'EnableSecurity/wafw00f', 'trufflesecurity/trufflehog',
  'gitleaks/gitleaks', 'initstring/cloud_enum', 'lc/gau', 'michenriksen/aquatone',
  // person / automation framework
  'smicallef/spiderfoot', 'kpcyrd/sn0int',
  // breach
  'hmaverickadams/breach-parse',
  // graph / notes
  'gephi/gephi', 'jacomyal/sigma.js', 'visjs/vis-network', 'laurent22/joplin', 'logseq/logseq',
  'TriliumNext/Trilium', 'jgraph/drawio-desktop',
  // automation frameworks
  'n8n-io/n8n', 'microsoft/playwright',
  // documents / metadata
  'apache/tika', 'tesseract-ocr/tesseract', 'ocrmypdf/OCRmyPDF',
  // awesome lists
  'jivoi/awesome-osint', 'sinwindie/OSINT', 'hslatman/awesome-threat-intelligence',
];

async function api(path) {
  const r = await fetch('https://api.github.com' + path, { headers: H, signal: AbortSignal.timeout(30000) });
  const rem = r.headers.get('x-ratelimit-remaining');
  if (r.status === 403 || r.status === 429) return { err: 'RATELIMIT', status: r.status, rem, reset: r.headers.get('x-ratelimit-reset') };
  if (r.status === 404) return { err: 'NOT_FOUND', status: 404, rem };
  if (!r.ok) return { err: 'HTTP_' + r.status, rem };
  return { json: await r.json(), rem };
}

const out = [];
for (const full of targets) {
  const res = await api('/repos/' + full);
  if (res.err) {
    out.push({ repo: full, err: res.err, status: res.status });
    console.log(`ERR  ${full}  ${res.err}`);
    if (res.err === 'RATELIMIT') break;
  } else {
    const j = res.json;
    out.push({
      repo: j.full_name, desc: (j.description || '').slice(0, 150), lang: j.language,
      stars: j.stargazers_count, pushed: j.pushed_at, created: j.created_at,
      license: j.license?.spdx_id || 'none', archived: j.archived, open_issues: j.open_issues_count,
      homepage: j.homepage || '', topics: (j.topics || []).slice(0, 12),
    });
    console.log(`OK   ${j.full_name} | pushed=${j.pushed_at?.slice(0, 10)} stars=${j.stargazers_count} lic=${j.license?.spdx_id || 'none'} arch=${j.archived} lang=${j.language} | rem=${res.rem}`);
  }
  await sleep(120);
}

// projectdiscovery (batch, 1 call)
const pd = await api('/users/projectdiscovery/repos?per_page=100&sort=pushed');
if (pd.json) {
  for (const name of ['subfinder', 'httpx', 'nuclei', 'dnsx', 'katana']) {
    const j = pd.json.find(x => x.name === name);
    if (!j) { console.log(`MISS projectdiscovery/${name}`); continue; }
    out.push({
      repo: j.full_name, desc: (j.description || '').slice(0, 150), lang: j.language, stars: j.stargazers_count,
      pushed: j.pushed_at, license: j.license?.spdx_id || 'none', archived: j.archived,
      open_issues: j.open_issues_count, topics: (j.topics || []).slice(0, 12),
    });
    console.log(`OK   ${j.full_name} | pushed=${j.pushed_at?.slice(0, 10)} stars=${j.stargazers_count} lic=${j.license?.spdx_id || 'none'} arch=${j.archived}`);
  }
} else console.log('PD batch err', pd.err, pd.status);

const fs = await import('node:fs');
fs.writeFileSync('research/github-verified.json', JSON.stringify(out, null, 1));
console.log('\nwrote research/github-verified.json with', out.length, 'rows');
