# Phase 4 spike — owner name ke liye PakistanDatabase (16 Nov 2026)

Ye file us asli spike ka record hai jisne faisla kiya ke "kis ke naam hai" feature **mumkin hai**,
aur kis shakal mein.

## Nateeja (TL;DR)

**Haan, mumkin hai — bina kisi paid service ke.** Chain ye hai:

```
Obscura (asli browser, CDP)  →  Turnstile token mint (unke apne page par)
        ↓
plain fetch POST  →  pakistandataba.se/databases/sim.php  →  report HTML
        ↓
parse (CNIC anchor se rows)  →  naam + CNIC + pata
```

Aur teen ahem architectural findings:

1. **Sitekey domain-restricted hai.** Hamari origin par wahi sitekey embed karne se Turnstile
   error `110200` (invalid domain) deta hai. Is liye client-side widget se kaam nahi chala —
   **sidecar (asli browser) lazmi hai**.
2. **Token mint karne ke baad plain fetch se POST chalta hai.** Yani browser sirf token ke liye
   chahiye, poora scraping uske through nahi.
3. **Site per-network throttle karti hai** — ~15 searches ke baad:
   `TOO MANY SEARCHES from your network — try again in 49 minutes.`

## Asli evidence (verbatim)

### Token mint hua (obscura CDP se)
```
STEP 1 OK — real token len=730
STEP 2 status=200 len=10784
```

### Record mila — `923451234567` (0300 4512345)
```
TOTAL HITS 1 SOURCES 1
1 RECORD FOUND
Mobile          Name            CNIC           Address
923451234567    SYED NAJAF ALI  4220106671817  PLOT 7 ZIA ALHAQ COLONY AQAB IMAM BAARGAH GULSHAN
REF // OSINT-736d1567
```

### Multi-record — `923331234567` (0333 3123456) → 3 hits
```
3 RECORDS FOUND
923331234567  muhammad kashif  3520296868939  nain sukh shahdrah City LAHORE - KARACHI
923331234567  GOUHAR BILAL     3530298301247  B-12R/121 2 OKARA OKARA OKARA
923331234567  GOUHAR BILAL     3530298301247  B-12R/121 2 OKARA OKARA OKARA
```

### No record — `92304439955` (0300 4439955)
```
TOTAL HITS 0
NO RECORDS — No matching records in this source for this query.
REF // OSINT-c932ce77
```

### Throttle — ~15 searches ke baad
```
TOO MANY SEARCHES from your network — try again in 49 minutes.
```

## Jo cheezein bekaar nikli (taake dobara koshish na ho)

| Koshish | Nateeja |
|---|---|
| Token ke baghair POST | `CAPTCHA REQUIRED` |
| Dummy/random token | `VERIFICATION FAILED` |
| Cookie jar (GET phir POST) | koi cookie set nahi hoti, phir bhi fail |
| GET mein token query param | wahi `CAPTCHA REQUIRED` |
| `fuckingapisystem.pakistandatabase.com/api/search` (unka documented API) | `ECONNRESET` — key bhi maangi jati hai ($20/mo) |
| Hamari origin par unki sitekey ka widget | Turnstile error `110200` (invalid domain) |

## Isse app mein kya badla

1. **Sidecar architecture** (`tools/pakdb-sidecar.mjs`): sirf yahi ek hissa browser use karta hai,
   `/pakdb?number=...` par report HTML deta hai. Worker Web-standard hi rehta hai (Cloudflare par bhi).
2. **Parser alag aur testable** (`src/worker/adapters/pakdb-html.ts`) — CNIC (13 digit) ko row anchor
   banata hai, kyunki report whitespace-separated text hai, asli table nahi.
3. **Throttle ek alag reason hai**, "no records" nahi: adapter `rate-limited` throw karta hai,
   pool cooldown laga deta hai, aur minutes message mein aate hain.
4. **Sidecar per-number cache** (30 min, sirf kamyab reports) — throttle se bachne ke liye.
5. **Cold start warm-up** — obscura ka pehla attach/navigation sabse flaky tha, is liye sidecar boot par
   khud warm karta hai; phir har request retry (3 attempts) ke saath chalti hai.

## Reproduce

```bash
npm run setup:obscura     # obscura Windows build .tools/ mein download
npm run dev:obscura       # terminal 1 — CDP server :9222
npm run dev:sidecar       # terminal 2 — sidecar :8788 (boot par warm karta hai)
curl "http://127.0.0.1:8788/pakdb?number=03331234567"
```

Agar throttle lag jaye to 45-60 min intezaar, warna sidecar ka cache us number ko dobara nahi poochta.
