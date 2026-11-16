# DEPLOY — PakDossier

Teen hisse hain, aur **sirf ek** ko browser chahiye:

| Hissa | Kahan | Kyun |
|---|---|---|
| **App (PWA)** | Cloudflare Pages ya GitHub Pages — static | Rs 0, HTTPS free |
| **Worker (API)** | Cloudflare Workers | `/api/*`, keys chhupane ke liye, CORS, cache |
| **Sidecar** | koi bhi chhoti machine jo browser chala sake (VPS / ghar ka PC / Docker) | sirf owner-naam ke liye: Turnstile token mint karna |

Agar sidecar na ho to app **phir bhi chalti hai** — network, CNIC mode aur saare official links offline engine se aate hain;
sirf "kis ke naam hai" wala hissa `no-key` ban kar report hota hai. Kuch toota nahi lagta.

---

## 1. App (Pages)

```bash
npm ci
npm run build            # dist/ banata hai (tsc + vite)
npx wrangler pages deploy dist --project-name pakdossier
```

`VITE_WORKER_URL` set karein agar API alag origin par hai (warna same-origin `/api` use hota hai):

```bash
VITE_WORKER_URL="https://pakdossier-api.<account>.workers.dev" npm run build
```

## 2. Worker (API)

```bash
npx wrangler deploy                                     # wrangler.toml already hai
npx wrangler secret put PAKDB_BROWSER_URL               # e.g. https://sidecar.example.com
# optional — sirf jo free keys li hain:
npx wrangler secret put IPQS_KEY
npx wrangler secret put VERIPHONE_KEY
npx wrangler secret put NUMLOOKUPAPI_KEY
npx wrangler secret put ABSTRACTAPI_KEY
npx wrangler secret put NUMVERIFY_KEY
```

**Cache lazmi hai** (free quotas + mirror throttle ke liye):

```bash
npx wrangler kv namespace create CACHE
# wrangler.toml mein id paste karein, phir deploy
```

`ALLOWED_ORIGIN` ko apne Pages domain par set karein (default `*`). Keys kabhi client mein nahi jatin —
`/api/health` sirf booleans deta hai.

## 3. Sidecar

Sidecar ek HTTP service hai jo `/pakdb?number=...` par report HTML deta hai. Iske liye:

1. **Obscura** (open source headless browser) — ek binary, CDP deta hai
2. `tools/pakdb-sidecar.mjs` — usse Turnstile token mint karwata hai, POST karta hai

```bash
npm run setup:obscura    # .tools/ mein binary download (Windows build)
npm run dev:obscura      # terminal 1 — CDP :9222
npm run dev:sidecar      # terminal 2 — sidecar :8788
```

**Deploy ka asaan tareeqa:** ek chhota VPS (ya ghar ka PC), `--host 0.0.0.0`, aur us par HTTPS reverse proxy
(Caddy/Cloudflare Tunnel). `OBSCURA_MCP_TOKEN` jaisa koi guard obscura ke paas hai, magar sidecar khud
unauthenticated hai — production mein uske aage proxy auth ya Cloudflare Access laga dein.

Linux par obscura ka `-stealth` (rendering ke saath) build use karein:
`obscura-x86_64-linux-stealth.tar.gz` — aur `tools/pakdb-sidecar.mjs` mein `OBSCURA_HTTP` ko `http://127.0.0.1:9222` rakhein.

## 4. `.env` reference

```bash
# --- worker (wrangler secrets ya dev env) ---
PAKDB_BROWSER_URL=http://127.0.0.1:8788     # sidecar; iske bagair owner-naam feature off
LOOKUP_TIMEOUT_MS=8000                      # provider deadline (pakdb slow hai to barha dein)
CACHE_TTL_SECONDS=604800                    # 7 din
ALLOWED_ORIGIN=https://pakdossier.pages.dev
DISABLE_KEYLESS=0                           # 1 = keyless page provider band
# IPQS_KEY / VERIPHONE_KEY / NUMLOOKUPAPI_KEY / ABSTRACTAPI_KEY / NUMVERIFY_KEY

# --- sidecar ---
PAKDB_SIDECAR_PORT=8788
OBSCURA_HTTP=http://127.0.0.1:9222
PAKDB_ATTEMPTS=3                            # per search retries
PAKDB_CACHE_MS=1800000                      # 30 min per-number cache
# PAKDB_SITES="https://pakistandataba.se/databases/sim.php,https://pakistandatabase.com/databases/sim.php"

# --- app build ---
VITE_WORKER_URL=
```

## 5. Honest limits (jo user ko batane chahiye)

1. **Mirror** hai, registry nahi — naam/CNIC stale ho sakte hain. Tasdeeq SMS **7000** (Rs ~10) se.
2. Mirror **per-network throttle** karta hai (~15 searches ke baad "try again in NN minutes").
   Is liye: worker cache + sidecar cache + cooldown, aur `rate-limited` ko alag reason banaya gaya hai.
3. **Live GPS location** public ko kabhi nahi milti — operator ke HLR ki baat hai.
4. Free API keys par monthly quota hai (~2,350/mah total), magar cache ke bagair wo jaldi khatam hoti hai.
5. Sidecar ke bagair app chalti hai, bas owner-naam nahi milta.
