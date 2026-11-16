# Pakistan Mobile Number Lookup App — Research Notes
**Date:** 16 November 2026 · **Only research, no code written**
**Goal:** Input: mobile number → Output: location + SIM kis ke naam hai. Budget: **Rs 0**

---

## 1. Sabse pehle: sach kya hai (ground truth)

Pakistan mein **koi official public API nahi hai** jo mobile number daalne par owner ka naam de de. Ye baat 2026 ki
bohat si trusted sources ne confirm ki hai — SIM subscriber record operator ke apne system mein hai, identity layer
NADRA ke paas, aur PTA ke paas subscriber data hi nahi hai. Na PTA ka koi public endpoint hai, na NADRA ka, na
operators ka. ([The AI Journal](https://aijourn.com/sim-owner-details-online-check-by-number-in-pakistan-what-ai-can-and-cannot-do/),
[Minute Mirror](https://minutemirror.com.pk/sim-owner-details-online-check-by-number-what-a-used-phone-buyer-can-really-check-627820/),
[checksimownerdetails.pk](https://checksimownerdetails.pk/sim-database-online-pakistan/))

Is liye app ki output 3 alag cheezon ka mixture hogi — inko milana hi asli design hai:

| Layer | Cheez | Kitna reliable | Cost |
|---|---|---|---|
| L1 | Network / operator (prefix se) | 100% offline, likin MNP ki wajah se "original operator" — live network nahi | Rs 0, hamesha |
| L2 | Approximate location (city / region) | Best-effort, DB par depend | Rs 0 (free tier) |
| L3 | **Owner ka naam / CNIC / address** | Best-effort, third-party copied data — **official nahi** | Rs 0 par flaky |

### Official free channels (jo har haal mein app mein dikhane chahiye)
- **668** — apna 13-digit CNIC (bina dash) SMS karein → per-network SIM count. ~Rs 2/SMS.
- **667** — apni hi SIM se `MNP` bhejein → us line ka registration record (naam + masked CNIC).
- **76367** — `N <03XXXXXXXXX>` bhejein → **kisi bhi number ka current network** (MNP ke baad bhi sahi). Official, Rs 2.
- **cnic.sims.pk** — PTA ka free web portal, sirf apna CNIC (reCAPTCHA hai).
- **PTA RAABTA WhatsApp assistant `0315-0055055`** — Feb 2026 mein launch, official, free, menu-driven
  ([source](https://www.paksimlookup.com/pta-services), [source](https://simsowner.org.pk/sim-information/)).
- **PTA DIRBS** — IMEI/device status (bonus feature).

> Ye sab "mere bare mein" batate hain, "us bande ke bare mein" nahi — yahi asli limitation hai.

---

## 2. Live status (aaj 16-Nov-2026 ko is machine se actually probe kiya)

Ye classic "pak sim data" sites 2026 mein tabah ho chuki hain. Probe scripts `research/probe-*.mjs` mein hain.

| Host | Result | Matlab |
|---|---|---|
| `simdatabase.pk` | **DNS NXDOMAIN** | Domain hi mar gaya |
| `siminfo.pk` | **DNS NXDOMAIN** | Mar gaya |
| `simdatabase.com.pk` | DNS SERVFAIL (lame delegation) | Toota hua |
| `simlivetracker.com.pk` | Lame DNS delegation — **Hugging Face ke server se bhi resolve nahi hua** | Down |
| `sims.pk` | TLS `CERT_HAS_EXPIRED` | Certificate expire |
| `paksim.info` | HTTP ECONNRESET | Blocked/behaviour |
| `cnic.sims.pk` | HTTP 200 ✅ | **Official PTA portal zinda hai** |
| `pakistandataba.se` (PakistanDatabase) | HTTP 200 ✅ par search POST par **Cloudflare Turnstile** licka hai (`CAPTCHA REQUIRED`) | Sabse acha data, magar token chahiye |
| `checksimownerdetails.pk`, `simsownersdetail.com`, `simchecker.pk`, `freshsimownerdetails.org.pk` | HTTP 200 ✅ | Live hain magar zyadatar **guide sites** — inka apna number→naam lookup kaam nahi karta |
| `www.whoseno.com` | HTTP 200 ✅ | Crowd-sourced caller names, magar naam app ke andar chhupa hota hai |
| `wasif-cloud-sim-tracker.hf.space` | API live ✅ par upstream (simlivetracker) dead | Free wrapper, upstream marne se bekaar |

**PakistanDatabase = sabse qeemti free source.** Ye mobile number ya CNIC par seedha
`mobile · name · cnic · address` deta hai (uska paid API $20/mo hai, magar public POST form free hai).
Aaj ka probe: form field `search_query`, action `/databases/sim.php`, aur
`data-sitekey="0x4AAAAAADMujqAjT0iboJUw"` ka Turnstile widget.

---

## 3. "Location" ka asli matlab (yahan sab log gumraah karte hain)

1. **Prefix city nahi batata.** Pakistani mobile prefix sirf operator batata hai; Karachi aur Peshawar wala dono ek
   hi 0345 range mein ho sakte hain. ([mycountrymobile](https://www.mycountrymobile.com/fr/blog/pakistan-phone-number-format/))
2. **Live GPS location public nahi.** Operator ke HLR mein hoti hai, public ko milti hi nahi — jo sites
   "live SIM tracker" bechte hain wo jhoot bolte hain ([checksimownerdetails.pk](https://checksimownerdetails.pk/live-sim-tracker-pakistan/)).
3. Jo 3 cheezein waqai mil sakti hain:
   - prefix → **operator + admin circle** (Sindh/Punjab/KPK/AJK ka andaza)
   - HLR/validation API → **current carrier** (port ke baad bhi), kabhi region
   - leaked DB ka **registered address/city** → owner ki "location" ka sabse qareeb andaza

**App mein label aise rakhna chahiye:** "Network (prefix se)", "Approximate area", "Registered address (public data)" — aur
ek chhota disclaimer har result par.

---

## 4. Free options jo waqai mansoos (planning) ke qabil hain

### 4a. Rs 0, hamesha — offline layer
- Khud ka `030x / 031x / 032x / 033x / 034x / 035x / 0370x / 0371x` prefix table
  (Wikipedia data, Nov 2026): Jazz `030x,032x` · Zong `031x,0370x,0371x` · Ufone `033x,034x` (Telenor merge ke baad) ·
  Onic (Ufone MVNO) `0339` · SCOM `0350–0355` (AJK/GB only)
  ([Wikipedia](https://en.wikipedia.org/wiki/List_of_telecommunication_companies_in_Pakistan),
  [whichnetworkcode](https://whichnetworkcode.com/),
  [pakbiz](https://pakbiz.com/blog/0327-which-network-code-in-pakistan/))
- `libphonenumber` metadata → validation, E.164 formatting, line type, timezone. 100% offline, unlimited.

> Note: sources prefix ranges par aapas mein mukhtalif hain (SCOM/Telenor/Onic) — aur Telenor ka Ufone mein merge
> naming badal raha hai. Is liye prefix ko "original network" bolna, "current" nahi. Current network = 76367 SMS.

### 4b. Free tier APIs — carrier + city + line type (naam **nahi**)
| API | Free quota | Notes |
|---|---|---|
| [numlookupapi](https://numlookupapi.com/pricing) | 250 lookups/mo, no card, 10 req/min | carrier + location + line_type JSON |
| [Veriphone](https://veriphone.io/pricing) | 1,000 validations/mo, no card | Current Carrier Lookup 10 credits |
| [Numverify](https://apilayer.com/products/numverify/) | 100 req/mo free | carrier/location/line type |
| [IPQualityScore](https://www.ipqualityscore.com/plans) | 1,000 lookups/mo free | phone validation + HLR |
| [AbstractAPI](https://www.abstractapi.com/api/phone-validation-api) | 250/mo free | carrier + line type |
| [HLR Lookups](https://www.hlrlookup.com/docs/hlrlookup-docs.html) | 100 free one-time | asli HLR |

4 providers ke free keys pool kiye jayein to ~2,000/mo lookups Rs 0 mein nikal jaate hain.

### 4c. Naam ke liye free options (best-effort, koi bhi official nahi)
1. **PakistanDatabase** (`pakistandataba.se`) — naam + CNIC + address. Problem: Turnstile. Solution: PWA mein
   uske sitekey se Turnstile widget render karo, token le kar apne Cloudflare Worker se POST bhejo (agar uski
   sitekey hostname-restricted na ho). **Yeh build ke waqt test karna hoga — sabse bara technical risk yahi hai.**
2. **Truecaller unofficial** (`truecallerjs` npm) — crowd-sourced caller name. Free, magar ek dafa Truecaller app ka
   `installationId` chahiye ([npm](https://www.jsdelivr.com/package/npm/truecallerjs)).
3. **CallApp API (RapidAPI)** — naam + social, magar free BASIC sirf **5 requests/month** ([review](https://apimemo.com/api/callapp)).
4. Official verify buttons (668/667/76367/RAABTA/cnic.sims.pk) — 100% free, user ko deep-link kar do.

### 4d. Infrastructure — sab Rs 0
- **Hosting:** Cloudflare Pages / GitHub Pages / Netlify — free, HTTPS, custom domain free.
- **CORS problem:** free sites browser se direct call nahi hone dete. Hal: **Cloudflare Worker free (100,000 req/day)**
  as proxy + caching. API keys Worker ki env vars mein rahein (browser mein leak na hon).
- **Distribution:** PWA (installable, offline shell) — Play Store ka $25 one-time bach jaata hai.

---

## 5. Recommended architecture (jab banane jayein)

```
User input (0300-1234567)
        │
   [1] Normalize + validate  ← libphonenumber, offline
        │
   [2] Prefix table lookup   ← offline: operator, circle, line type, MNP warning
        │
   [3] Free API pool         ← carrier, current network, approximate location  (Worker + cache)
        │
   [4] Owner name best-effort ← PakistanDatabase (Turnstile) → Truecaller → "unavailable"
        │
   [5] Result card + "Official verify" buttons (76367 / 667 / 668 / RAABTA / cnic.sims.pk)
        │
   [6] Disclaimer: "public/copied data, official record nahi"
```

- Stack suggestion: **Astro ya plain Vite + vanilla/React PWA**, Tailwind, koi database nahi (Worker KV cache optional, free).
- Clinic: har layer ko alag se fail hone dein — agar naam na mile to bhi network + validation sada chalta rahe.
- Provider chain ko config-driven rakhein — 2026 ka sabaq: **ye sites bar bar marti hain**, is liye 2-3 fallback zaroori.

---

## 6. Risks / sabaq
1. **Owner name source flakiness** — simdatabase/siminfo/simlivetracker sab gaye. Multiple fallbacks lazmi.
2. **Legal/ToS** — ye data copied/leaked snapshot hai; PECA 2016 sec-16 ka zikr hota hai. Disclaimer zaroori.
3. **CORS + CAPTCHA** — server-side proxy ke baghair kuch nahi chalega.
4. **Accuracy score** — Kisi number ka naam ghalat bhi ho sakta hai (SIM reissue, disowning, MNP). App ko confidence
   level dikhana chahiye, "fact" nahi.
5. **Telenor → Ufone merge** — prefix naming update karni parti rahegi.

---

## 7. Mehfooz (verified) free prefix table — MVP ke liye
`030x` `032x` = Jazz · `031x` `0370x` `0371x` = Zong · `033x` `034x` = Ufone (Telenor merge samet) ·
`0339` = Onic (Ufone MVNO) · `0350–0355` = SCOM (AJK/GB) · `0355x` par sources mukhtalif — cautiously label karein.

---

---

## 7b. NADRA ko "hack" kiya ja sakta hai? (16-Nov-2026 research)

**Chhota jawab:** NADRA ke server mein direct free access nahi milta — magar NADRA ka data *already leak ho chuka hai*
aur wahi mirrors free sources ki shakal mein chal rahe hain. Saath hi NADRA ke apne 2-3 free/saste official short codes
CNIC par asli naam/address dete hain.

### NADRA ka official position vs reality
- NADRA ne Jul 2026 mein saaf inkaar kiya ke system breach hua — NCERT/NTISB ke saath investigation ke baad kaha
  "koi evidence nahi" ([pakhtundigital](https://pakhtundigital.com/citizen-data-safe-nadra-denies-reports-of-system-breach/)).
- Magar: Jun 2025 mein dark web par **~602 million records** ka alleged leak
  ([dailydarkweb](https://dailydarkweb.net/pakistans-national-citizen-database-allegedly-breached-602-million-records-leaked-online/)),
  Oct 2026 mein "Ballalaika" handle se **~10 million records** ka alleged leak
  ([brinztech](https://www.brinztech.com/breach-alerts/brinztech-alert-alleged-dark-web-leak-exposes-10-million-records-from-national-citizenship-database/)).
- Jan 2026, Senate Standing Committee on Interior: senator Afnanullah — "All Pakistani nationals' data is on the dark
  web... NADRA, FBR aur banks ka consolidated dataset... kisi ka bhi data Rs 500 mein"
  ([Daily Times](https://dailytimes.com.pk/1438775/nadra-fbr-and-banks-data-available-on-dark-web/)).

> Matlab: hack ka faida pehle hi uthaya ja chuka hai — aam app developer ko leaked dataset hi serve hota hai.

### NADRA ke apne official channels (free ya sasti)
| Channel | Kya deta hai | Cost |
|---|---|---|
| CNIC SMS **7000** | **naam + address/father name** verification | ~Rs 10 + tax ([hamariweb](https://hamariweb.com/mobiles/info/nadra-cnic-tracking-kesey-kaien/), [bolnews](https://www.bolnews.com/pakistan/heres-how-to-verify-cnic-via-sms/)) |
| CNIC SMS **8300** (ECP+NADRA) | voter registration, electoral area, block code | ~Rs 2 ([pakbiz](https://pakbiz.com/blog/nadra-voter-list-check-online/)) |
| Tracking ID SMS **8400** | CNIC application status | normal SMS |
| CNIC SMS **668** (PTA) | per-network SIM count | ~Rs 2 |
| **PakID app** | apna poora record + **family tree FREE** | Rs 0 ([Daily Qudrat](https://en.dailyqudrat.pk/104375/)) |
| **1777** helpline | support | call charges |
| **Verisys** | asli NADRA API — CNIC/NICOP/POC verification | **paid**, institutions ke liye; 2023 se "Ijazat Aap Ki" consent OTP lazmi |

**NADRA ka apna koi free public JSON API nahi hai.** Verisys contract-based hai (NADRA Services Charter 2024 §8.18.2).

### Jo actually free chalta hai
- **PakistanDatabase** (`pakistandataba.se`) — number ya CNIC → naam + CNIC + address, Punjab police records,
  Kashmir family tree. Free web (Turnstile licked). Paid API $20/mo.
- **PTA `cnic.sims.pk`** — CNIC → SIM count (reCAPTCHA).
- Play Store par "Sim & CNIC info" type apps — wahi leaked mirrors, free.
- NADRA ka naya digital platform + **nGRIDS** (district birth/death, geospatial demographic) — area-level data ke liye future source.

### App ke liye natija (ye important hai)
NADRA ka data **CNIC-keyed** hai, number-keyed nahi. Number se CNIC sirf leaked DB (PakistanDatabase) se ati hai.
Is liye:
1. Number input → best-effort naam (PakistanDatabase) + prefix network (offline).
2. **CNIC input mode zaroor rakhein** → "7000 par SMS bhejein" button ke saath. Ye official, Rs 10, aur authentic route hai.
3. Verisys jaisa "official" label app mein na dein — warna log sochenge app NADRA se juda hai.

---

## 8. Agla step (jab user kahe)
- [ ] Pakistandatabase Turnstile flow ko actually test karna (PWA + Worker se) — faisla yahi hoga ke "naam" feature
      possible hai ya nahi.
- [ ] 1 free API key le kar (numlookupapi ya veriphone) Pakistan number par response check karna: kya `location` aa raha hai.
- [ ] MVP scope freeze: PWA, Urdu + English, Phase-1 = network + validation + official verify buttons + best-effort naam.
