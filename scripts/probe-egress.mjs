const services = [
  ['ipwho.is', 'https://ipwho.is/'],
  ['ipinfo.io', 'https://ipinfo.io/json'],
  ['ipify', 'https://api.ipify.org?format=json'],
];
for (const [name, url] of services) {
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    const txt = await r.text();
    let j;
    try { j = JSON.parse(txt); } catch { console.log(name, '-> non-JSON (challenge)'); continue; }
    const ip = j.ip ?? j.query ?? '';
    console.log(`${name}: ip=${ip} isp=${j.connection?.isp ?? j.org ?? '-'} city=${j.city ?? '-'} country=${j.country ?? j.country_name ?? '-'}`);
    if (ip) {
      const p = ip.split('.').map(Number);
      const priv = p[0] === 10 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127);
      console.log(`  => ${priv ? 'CGNAT/private (Tunnel chahiye)' : 'PUBLIC IP — port-forward + Let\'s Encrypt chalta hai'}`);
      break;
    }
  } catch (e) { console.log(name, '-> ERR', e.cause?.code ?? e.message); }
}
