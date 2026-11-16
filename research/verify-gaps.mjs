// Fill the gaps with shields.io badges (no GitHub API rate limit).
const repos = [
  'projectdiscovery/subfinder', 'projectdiscovery/httpx', 'projectdiscovery/nuclei', 'projectdiscovery/dnsx',
  'sinwindie/OSINT', 'hslatman/awesome-threat-intelligence',
  'joeyism/linkedin_scraper', 'antoniaci/blackbird', 'p1ngul1n0/blackbird',
  'tomquirk/linkedin-api',
];
const get = u => fetch(u, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(25000) });
const txt = svg => (svg.match(/<title>([^<]*)<\/title>/) || [])[1] || (svg.match(/>([^<>]{2,40})</g) || []).join(' ').replace(/[<>]/g, ' ').trim();

for (const r of repos) {
  const line = [`${r}`];
  for (const kind of ['last-commit', 'stars', 'license']) {
    try {
      const res = await get(`https://img.shields.io/github/${kind}/${r}.svg?label=`);
      const body = await res.text();
      const t = txt(body).replace(/\s+/g, ' ').trim();
      line.push(`${kind}="${res.status === 200 ? t : 'HTTP' + res.status}"`);
    } catch (e) { line.push(`${kind}=ERR`); }
  }
  console.log(line.join(' | '));
}
