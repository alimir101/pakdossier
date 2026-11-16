# INVESTIGATOR OS — Master Plan

**Date:** 16 Nov 2026 · **Owner:** aap (non-technical operator) · **Banane wala:** main (agent)
**Aap ke resources:** ek laptop (Windows, yahan sab kuch abhi chal raha hai), ek **homelab**, ek **VPS** (Docker, us par aap ki ek web app pehle se hai).
**Base jahan se shuru:** `PakDossier` (ye repo) — offline engine, 30 official portals, CNIC unlock, live owner lookup (obscura + sidecar), provider pool, evidence discipline, `doctor`, tests.

> Ye plan "sab cover karne" wala hai — magar tareeqe se: **platform pehle, modules baad mein**.
> Aap ko sirf 2 cheezein karni hongi: (a) kabhi kabhi `docker compose up -d` chalana, (b) naye login/secrets dena.

---

## 0. Ek line ka faisla (aur uski wajah)

**Sab kuch homelab par — Traefik ke peeche. VPS optional (standby + doosra egress IP).**

Aap ke homelab par already **domain + Traefik** chal raha hai, aur ghar ka IP public hai (is session mein verify kiya:
egress `39.53.199.133`, PTCL Karachi, **CGNAT nahi**). Yani public HTTPS ka masla aap pehle hi hal kar chuke hain —
is liye VPS par kuch host karne ki zaroorat nahi. Ek jagah maintain karna aap ke liye behtar bhi hai.

| Kahan | Kya chalega | Kyun |
|---|---|---|
| **Homelab** (primary) | sab: UI, API, browser farm (obscura), collectors, Postgres + vault, scheduler | aap ka Traefik already public karta hai; CPU/RAM/storage yahan hai; ek hi jagah maintain |
| **VPS** (optional) | (a) **standby** UI/API, aur/ya (b) **doosra browser+sidecar** | do egress IP = mirror ka throttle **double** + failover |
| **Laptop** (yahan) | development, agent (main), tests, build | yahan sab already set hai |
| **Git / cloud** | sirf code — **koi secret, koi data nahi** | safe |

**VPS optional kyun rakha ja raha hai (aur uska asli faida):** mirror **per-network** throttle karti hai. Ghar ka IP aur
VPS ka IP alag hain → do sidecar = ~do guna search budget, aur ek mar jaye to doosra chalta rahega.
Ye "host karne" ke liye nahi, **capacity aur failover** ke liye hai.

**Risk jo homelab-primary ke saath aata hai (sach):** ghar par bijli ya internet chala jaye to app band.
Isi liye VPS standby ka option khula rakhenge. Filhaal personal use ke liye ye theek hai.

**Ek machine par sab kuch kabhi nahi** — homelab par services alag containers mein, DB kabhi public nahi.

---

## 0b. Homelab discover ke asli facts (16 Nov) + deployment design

Homelab agent ki report se (sirf facts, aur is laptop se ki gayi 2 independent checks):

| Cheez | Fact |
|---|---|
| Host | Dell OptiPlex 7050 · Ubuntu 26.04.1 · 8 cores · 14 GiB RAM (7.2 available) · swap 3.2 GiB used |
| Disk | `/` 85% bhara (36 GiB free) · **`/srv/cloud` 595 GiB free (alag disk)** |
| Docker | 29.9.0 · 62 containers already running · Dokploy v0.29.12 (compose: `/etc/dokploy/compose/<stack>/code`) |
| Traefik | v3.7.14 (Swarm) · entrypoint `websecure` · certresolver `letsencrypt` (HTTP-01) · provider: swarm+dockerets **+ file** (`/etc/dokploy/traefik/dynamic`) · network `dokploy-network` · `exposedByDefault: false` |
| Auth middleware | **koi nahi** (basicauth/forwardAuth nahi) |
| Cloudflare | haan — `cloudflared` ka ingress `*.liflix.online → https://traefik:443` (yani naya subdomain **khud** Traefik tak pohanchega) |
| Subdomain test (is laptop se) | `os.liflix.online` → **HTTP 404 from Traefik** = route free hai, wildcard kaam kar raha hai ✅ |
| LAN se laptop | `192.168.102.4` laptop se **reachable nahi** (laptop `192.168.100.x`) → deployment channel alag chahiye |
| Tailscale | homelab par `tailscale0` mojood magar **logged out** |
| Backups | custom cron snapshots (config), evidence vault ki coverage abhi nahi |
| Egress IP (homelab) | `137.59.222.216` |

### Deployment design (faisla)

1. **Sab homelab par** — Traefik + cloudflared already public hain, kuch naya public nahi kholna.
2. **Data `/srv/cloud/os/` par** (`pgdata`, `vault`, `browser`) — root disk 85% bhara hai, wahan kuch bara nahi rakhenge.
3. **Router: naya dynamic file** `/etc/dokploy/traefik/dynamic/os.yml` (file provider) → `os.liflix.online` ko humari web service par bhejta hai.
   Yahan ek pre-existing `anu-salon-web-*.yml` bhi hai, yani naya file add karna normal hai — **Traefik restart bhi nahi chahiye** (file provider hot-reload).
   *Kyun ye tareeqa:* humari services Swarm overlay network (`dokploy-network`) par hon gi — overlay sirf attachable hone par bahar ke container ko leta hai. Is liye **Plan B (file provider + LAN port) primary**, aur Plan A (labels + network join) alternative.
4. **Auth: Cloudflare Access** (`os.liflix.online` par email-OTP) — kyunki Traefik mein koi auth middleware nahi hai. Backup: Traefik `basicauth`.
5. **Transport: Tailscale** — laptop aur homelab dono tailnet par (homelab par already installed, sirf `tailscale up`). Phir main laptop se seedha kaam kar sakta hoon; kuch public expose nahi hota. Git ki zaroorat bhi nahi rahegi.
6. **VPS: abhi chhor diya** — baad mein "doosra egress" ke liye (mirror throttle double).
7. **Dokploy ke stacks ko chhua nahi jayega** — humara apna compose `/srv/docker/compose/os/` par.

### 4 chhoti cheezein jo abhi chahiye (homelab agent se)

1. `docker network inspect dokploy-network proxy --format '{{.Name}} driver={{.Driver}} attachable={{.Attachable}} scope={{.Scope}}'`
2. `/etc/dokploy/traefik/dynamic/tls.yml` aur `middlewares.yml` ka **sanitized** text (secrets redact), taake cert/TLS ka wahi tareeqa copy ho.
3. Ek chalti hui service ke Traefik **labels** (sanitized) — pattern dekhne ke liye.
4. Free LAN port: `ss -tulpn | grep -E ':(808[0-9]|811[0-9])'` — kya 8081/8082 khali hain? (hum sirf LAN par bind karenge)

### Jo risks report mein nikle (aaj nahi, magar baad mein dekhein)

1. Traefik Docker socket mount + `api.insecure: true` (dashboard public router ke bagair).
2. SSH par password auth enabled (public port 22) — key-only behtar.
3. Root disk 85% + koi UPS nahi.
4. Auth middleware na hone ki wajah se naya UI khula hoga — is liye Cloudflare Access lazmi.

---

## 1. Movie vs Reality (aap ne movies ka zikr kiya — sach ye hai)

| Movies mein | Hum banayenge | Sach |
|---|---|---|
| "Enhance, zoom, cross-reference" 2 second mein | ek click par saare sources parallel + streaming results | 3-60 second (source par), aur kuch sources throttle karti hain |
| Live location "wo abhi yahan hai" | **approximate** area/registered address | asli live GPS sirf operator ke HLR mein; public ko nahi milti |
| "Poore mulk ka database" | leaked mirrors + 30 official portals | data **stale** ho sakta hai — is liye har field par date/confidence |
| Map par pins | address → map + clusters | address text ganda hota hai; pin approximate |
| AI assistant jo batata jaye | agent playbook chalaye + report likhe | ye bilkul mumkin hai (humara differentiator) |
| Case file, evidence locker, chain of custody | append-only case store + timestamp + hash + screenshot | ye hum foran bana sakte hain |
| "Uska phone hack kar liya" | passive/active recon, leaked data, unofficial APIs | asli "break-in" bohat kam; 90% automation aur correlation hai |

**Jo movies mein hota hai magar sach mein nahi:** real-time CDR/tower traces, biometrics, bank records — wo sarkar/operator ke paas hain.

---

## 2. Architecture (aasan lafzon mein)

```
     AAP (browser)
          │
   ┌──────▼───────┐   Cloudflare Tunnel + Access (free)
   │     VPS      │   ← public, sirf yahi bahar khula hai
   │  UI + API    │
   └──────┬───────┘
          │  Tailscale (private tunnel, koi port forward nahi)
   ┌──────▼───────────────────────────────────────────┐
   │                 HOMELAB                          │
   │  browser farm (obscura)  → captcha-wale portals  │
   │  collectors (modules)    → http / api / file     │
   │  Postgres + vault        → cases, evidence, hash │
   │  scheduler               → watchlist, monitoring │
   └──────────────────────────────────────────────────┘
```

**Core hisse (yehi "OS" banate hain):**

1. **Append-only store** — Case → Subject → Entity → Observation → Evidence. Kuch delete/overwrite nahi; har observation par `source`, `fetched_at`, `confidence`, response ka `SHA-256`.
2. **Entity resolution** — normalize + alias clustering. Humare live test mein ek CNIC par do naam aaye (*muhammad kashif*, *GOUHAR BILAL*) — ye layer unhe "alias family" banati hai. **Product ka dil.**
3. **Module registry** — har technique ka ek module + uski **capability card**:
   `input, output, needs(browser/key/file), rateLimit, cost, confidenceCap, legal`.
   Isi se coverage dashboard, auto-failover, budget guard aur audit trail khud banta hai.
4. **Collectors** — ek jagah: HTTP, browser, API, file (EXIF/PDF/OCR), pcap, APK/binary (REA), DB.
5. **Interface** — console UI, graph, map, timeline, evidence wall, report/PDF.
6. **Agent layer** — playbook chalata hai, sources cross-correlate karta hai, report likhta hai (yahan ka agent + REA MCP).

---

## 3. Docker layout (sab homelab par)

**Homelab — `compose/os.yml`** (alag project, aap ki baaki services se chhue baghair):

`web` (UI) · `api` (worker) · `obscura` · `browser-pool` (1-2 workers) · `postgres` · `vault` · `scheduler`

Sirf `web` aur `api` par Traefik labels lagenge — baqi containers sirf internal network par rahenge.

**VPS — `compose/os-standby.yml`** (optional): sirf `obscura` + `sidecar` (doosra egress), aur chahein to ek halka `web/api`.

---

## 3b. Traefik par kaise baithega (aap ke setup ke hisaab se)

Aap ka Traefik already chal raha hai, is liye hum usko badlenge nahi — sirf apni services ke **labels** denge:

1. Dedicated docker network (`osint_net`) — Traefik us network se in containers ko dekh sake, aur koi doosri service na ghuse.
2. Router: `Host(\`os.<aapka-domain>\`)` → entrypoint `websecure`, **certresolver wahi jo aap already use karte hain**.
3. **Sirf ye expose honge:** `web` (aur `api`, `/api` path ke through). DB, vault, obscura, scheduler — **public nahi**.
4. **Auth lazmi:** Traefik ka `basicauth` ya `forwardAuth` middleware — warna poora data URL kholne wala koi bhi dekh lega.
   (Aap ke paas Cloudflare ho to **Cloudflare Access** behtar hai: aap ke email par OTP.)
5. **Rate limit middleware** `/api` par — taake koi bot aap ka mirror budget na jala de.
6. `websecure` already hai matlab **HTTPS** milega → PWA install, service worker aur offline **kaam karenge** (secure context zaroori tha).
7. Traefik dashboard par naya router/alias check kar lena; naam clear rakhenge (`os-intel-web`, `os-intel-api`).

**Ek cheez khayal rakhein:** Traefik logs/access logs on rahen — home exposure par ye aap ki nazar hain.

---

## 4. Aap ki mojooda setup na tootay (safety rules)

1. Compose project ka naam alag: `os` — images, network, volumes sab isi ke andar.
2. Aap ke Traefik ki config **chhui nahi jayegi** — sirf humari containers par labels aur ek naya network.
3. Public sirf `os.<domain>` (UI) + usi host par `/api` — koi naya port khulne ki zaroorat nahi.
4. Auth middleware lazmi (basicauth / forwardAuth / Cloudflare Access) — warna data public.
5. Har change se pehle: DB ka `pg_dump`, aur compose file ka backup.
6. Aap ki baqi services aur ye platform: alag compose, alag volumes, alag `.env` — tasadum ka sawal hi nahi.

---

## 5. Security & privacy (kyunki personal data store hoga)

1. **Auth sirf VPS par** (Cloudflare Access). Homelab kabhi seedha internet par nahi.
2. **Secrets** sirf `.env` mein (git mein nahi). Har service ko sirf wahi secrets milenge jo zaroori hain.
3. **Encryption at rest** (optional switch) — vault volume par.
4. **Retention** — har case ka data kab tak rahe, policy page par likha ho.
5. **Legal page** — PECA 2016 s.16, aur saaf: *leaked ≠ official*, 7000 se tasdeeq.
6. Backup: roz raat homelab → encrypted dump (aap chahein to VPS par bhi ek copy, ya Backblaze).

---

## 6. "Movie-like" UI (yehi premium investigative feel hai)

Ye ek **console** hoga, form nahi. Dark, calm, dense:

1. **Command bar (⌘K)** — "run full check 0300…", "open case Gulberg", "graph this CNIC".
2. **Live feed panel** — jab playbook chale to har source apni line likhta jaye: `whoseno ✓ 120ms`, `pakdb ⏳ throttled 24m`, `mtmis ✓ owner found`. **Yehi movies wala feel deta hai** — aur ye sach hai, dikhawa nahi.
3. **Dossier center** — subject ki entities: numbers, CNIC(s), naam (alias chips), addresses, gaari, zameen, company, cases. Har cheez par source chip + confidence + date.
4. **Graph** — number ↔ naam ↔ CNIC ↔ pata; same-building clusters; alias families.
5. **Map** — addresses ke pins + clusters (approximate, saaf likha hua).
6. **Timeline / diff** — "pichhle hafte se kya badla".
7. **Evidence wall** — screenshots, archived pages, files, notes, tags; har item par hash + waqt.
8. **Agent panel** — "kya dhoonda, kya mila, kya nahi mila, agla qadam" — aur report generate.
9. **Ek bara `RUN FULL CHECK` button** — number/naam/CNIC/plate daalein, baqi system khud chalata hai.
10. **Keyboard-first** (`j/k`, `c` copy, `o` open portal), skeleton loaders, print stylesheet, asli Urdu + RTL toggle.

---

## 7. Roadmap — har milestone par "aap ko kya nazar aayega"

| # | Milestone | Aap ko kya dikhega | Data naya? |
|---|---|---|---|
| **M0** | Platform skeleton: store + module registry + capability cards + console shell | ab jo app hai, wo console ban jaye; results live feed mein aane lagein | nahi |
| **M1** | Investigator core: alias/entity resolution, graph, timeline, evidence wall, PDF report | ek CNIC par "do naam" khud jud kar dikhein; graph bane | nahi (mojooda data) |
| **M2** | Modules wave-1: MTMIS (gaari), FBR ATL, DIRBS, courts | ek plate ya CNIC daalein → gaari ka malik, ATL status, cases — **app ke andar** | haan |
| **M3** | Batch + monitoring + alerts | 50 numbers paste karein; subject par watch lagayein, badlav par alert | nahi |
| **M4** | Technique layers: domain/IP/port/`.git` (L4), APK/pcap (L5), reverse image | "hacking" wale panels — target ki services aur mobile app ke endpoints | haan |
| **M5** | Agentic + premium: playbooks by agent, accounts, API, team | "RUN" dabayein, agent khud poora case kare aur report de | nahi |

**Guardrail:** coverage **entity types** par naapein (kitni entities covered), tools ki ginti par nahi. 12 achhe modules = 80% value.

---

## 8. Cost & maintenance (sach)

1. VPS: aap ke paas already hai. Homelab: bijli + jo hardware hai.
2. **Optional paid** (baad mein, agar aap chahein): rotating proxies (~$5/mo) throttle todne ke liye, ek HLR API live carrier ke liye. Pehla kharcha yahi hoga — server par nahi.
3. Maintenance jo aap ko karni hogi: mahine mein 1 baar `docker compose pull && up -d`, aur `npm run doctor` dekh lena. Baqi main handle karunga jab tak session chal raha hai.
4. **Sources marenge** — har module ke saath fallback aur "verified on" date. Ye normal hai, isi liye platform banate hain.

---

## 9. Mujhe aap se ye chahiye (non-technical sawal)

1. **Domain kaun sa hai** aur Traefik kis subdomain pattern par chalate hain (masalan `*.home.domain`)? Ek `os.<...>` humein chahiye.
2. Traefik ka **cert resolver** aur entrypoint ka naam kya hai? (aap ke compose/labels se 2 line copy kar leni hain) — aur Traefik dashboard kahan hai?
3. **Auth** kaise karna hai: Traefik basicauth (user+password), ya Cloudflare Access (email OTP)? Cloudflare account hai?
4. Ghar ka IP badalta hai kya? (Traefik publicly chal raha hai, to DDNS ya static IP already hoga — confirm kar dein)
5. Homelab: OS kya hai, kitne CPU/RAM/disk? Docker kahan se chalta hai (Portainer/compose/GUI)?
6. VPS ko **standby / doosra egress** banana chahte hain ya filhaal bilkul chhorne dena?
7. Data retention: logs/screenshots kitne din rakhein?

---

## 10. Main ab kya karunga (M0 ka pehla qadam, aap ki ijazat par)

1. Is repo ko platform shape dena: `core/` (store, registry, capability cards), `modules/` (mojooda cheezein wahan shift), `console/` (naya UI shell).
2. Pehla module: humari mojooda app (offline engine + portals + owner lookup) — **kuch phenka nahi jayega.**
3. Docker compose files: `compose/vps.yml` aur `compose/homelab.yml` (abhi template, aap ke jawab ke baad final).
4. `docs/` mein: capability-card template, coverage dashboard ka spec, retention/legal page.
