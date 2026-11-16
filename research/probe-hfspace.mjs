import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36';
const N = '03001234567';
const get = (u, opt = {}) => fetch(u, { headers: { 'user-agent': UA, ...(opt.headers || {}) }, signal: AbortSignal.timeout(45000), ...opt });

const targets = [
  `https://wasif-cloud-sim-tracker.hf.space/api?search=${N}`,
  `https://wasif-cloud-sim-tracker.hf.space/`,
  `https://wasif-cloud-sim-tracker.hf.space/test`,
];
for (const t of targets) {
  try {
    const r = await get(t);
    console.log(`\n=== ${t} status=${r.status}\n${(await r.text()).slice(0, 900)}`);
  } catch (e) { console.log(`\n=== ${t} ERR ${e.cause?.code || e.message}`); }
}

// simlivetracker direct through several IPs
console.log('\n=== simlivetracker direct');
try {
  const r = await get('https://simlivetracker.com.pk/api.php?search=03001234567&type=mobile', { redirect: 'follow' });
  const h = await r.text();
  console.log('status', r.status, 'len', h.length);
  console.log(h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 600));
} catch (e) { console.log('ERR', e.cause?.code || e.message); }
