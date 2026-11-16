# OSINT Playbook — Pakistan, Rs 0 budget (16-Nov-2026)

Ye file pichhle research ka nichor hai. Sab kuch **aaj live probe** kiya gaya hai (scripts `research/probe-*.mjs`).
Detail appendices alag files mein hain: `research/github-osint-verified.md` (65 GitHub repos verify kiye gaye) aur
`research/PK-REGISTRIES.md` (Pakistan ke portals, URL-by-URL).

---

## 0. Pehle sach: "hack" nahi, "pivot" hai

OSINT mein aap system mein ghusste nahi — aap **ek sarkha (clue) se doosre tak** jate hain (pivot). Aap ki asli
taqat sarkhon ki tadaad hai, kisi ek tool ki jadoo nahi. Is liye "kitni door ja sakte hain" ka jawab ye hai:
**jitni door aap pivot kar sakte hain — aur Pakistan mein pivot ka darwaza CNIC hai.**

---

## 1. Ceiling 3 teerein mein (honest)

### Tier A — 100% free, aaj chalta hai, legal, official
Agar aap ke paas CNIC (ya gaari ka number, ya reference number) hai to Pakistan ke **official free portals** se aap
ye nikal sakte hain: naam, pata, gaari ka malik, zameen ka malik, muqadma, company director, NTN, bijli/gas bill par
naam+pata, landline directory. Ye sab Tier A hai — koi jawaz nahi, koi paisa nahi.

### Tier B — Best-effort, copied/leaked mirrors par
Number se naam/CNIC nikalna. NADRA/PTA ka koi reverse lookup nahi hai, is liye ye sirf leaked snapshot sites se milta hai
(best free: PakistanDatabase). Yahan mila hua CNIC **Tier A ka master key** ban jata hai — magar data purana ho sakta hai.

### Tier C — Wall: public ko kabhi nahi milta (chahe Rs 0 ho ya Rs 1000)
1. **Live GPS location.** Sirf operator ke HLR mein. Na NADRA ke paas, na PTA ke paas. Jo site "live SIM tracker" kehti hai
   wo galat keh rahi hai ([source](https://checksimownerdetails.pk/live-sim-tracker-pakistan/)).
2. **Kisi ajnabi number ka official/current malik.** Registration record operator ke biometric system mein hai.
   Public ko sirf purana snapshot milta hai.
3. **Number → CNIC ka official rikord.** Sirf mirrors.
4. **Pura NADRA record / family tree / biometric.** PakID app ya franchise. FRC/RABTA ke liye CNIC + biometric.
5. **Bank/credit/eCIB, aur telecom traces.** Paisa ya sarkari letter.

> Yani: **free mein aap Tier A tak pohanch sakte hain — bashart ke aap ke paas CNIC ho. Tier C kabhi nahi.**

---

## 2. Golden key = CNIC (ye poori strategy hai)

NADRA ka data **CNIC-keyed** hai, number-keyed nahi. Number sirf ek adad hai. CNIC mil gaya to ye sab khulta hai:

| CNIC milne ke baad | Kya milta hai | Source |
|---|---|---|
| SMS `7000` | **authentic naam + pata** (Rs ~10) | official |
| MTMIS Punjab | **gaari ka malik, walid ka naam, city**, engine/chassis | free official |
| PLRA / Sindh Zameen / KP eFard | **zameen ka malik**, fard, mutation | free official |
| dsj.punjab.gov.pk / cases.shc.gov.pk | muqadma, cause list | free official |
| SECP + FBR (ATL/Verification) | company, director, NTN, tax status | free official |
| bill.pitc.com.pk / SSGC / KE | bijli-gas bill par **consumer naam + pata** | free official |
| PTCL directory | landline ↔ naam/pata | free official |

Is liye asli sawal ye nahi "number se kya nikalta hai" — asli sawal ye hai **"number se CNIC kaise nikalein"**,
aur uske baad sab apne aap khul jata hai.

---

## 3. Sirf ek mobile number diya ho — realistic chain

1. **Offline prefix:** `030x/032x` Jazz · `031x/0370x-0371x` Zong · `033x/034x` Ufone (Telenor merge samet) ·
   `0339` Onic · `0350–0355` SCOM (AJK/GB). → operator + original network, foran.
2. **SMS `N 03xxxxxxxxx` → 76367** (Rs ~2, official): porting ke baad bhi **current network**. Ye number ka wahid
   official output hai.
3. **Number → naam/CNIC/pata:** sirf copied DB se — PakistanDatabase (`pakistandataba.se`, Cloudflare Turnstile).
4. **CNIC mil gaya →** upar wala pura table chal jata hai (7000 par authentic naam+pata, MTMIS par gaari, PLRA par zameen...).
5. **Parallel free pivots (number se):** WhatsApp profile pic/status (contact save kar ke), Telegram, Truecaller/GetContact
   crowd name, Google reverse image DP par, Facebook "search by phone" (privacy settings ke hisaab se).

Yahi asli ceiling hai: number → CNIC (mirror) → phir Tier A poora. Wall: live location + official current owner.

---

## 4. Free official Pakistan sources (Tier A) — verified live aaj

Sabse kaam ki cheezein (poori list `PK-REGISTRIES.md`):

| Kaam | URL | Input | Kya deta hai | Friction |
|---|---|---|---|---|
| **CNIC → naam + pata** | SMS `7000` | CNIC | authentic naam + pata (Rs ~10) | SMS |
| **Gaari → malik** | https://mtmis.excise.punjab.gov.pk/ | reg no + reg date + picture code | malik ka naam, walid, city | CAPTCHA |
| Gaari (Sindh) | https://excise.gos.pk/ | reg no / CNIC | malik | Cloudflare (browser chahiye) |
| **Zameen → malik** | https://punjab-zameen.gov.pk/ | district/tehsil + khewat/khasra/CNIC | fard, malik | JS app |
| Zameen (Sindh) | https://sindhzameen.gos.pk/ | CNIC **ya naam** | ownership record | — |
| Court case | https://dsj.punjab.gov.pk/ | party name / CNIC | case status, cause list | CAPTCHA |
| Company | https://eservices.secp.gov.pk/eServices/NameSearch.jsp | company name | registration | — |
| NTN/ATL | https://e.fbr.gov.pk/esbn/Verification | NTN/CNIC | verification, ATL | OTP |
| Bijli bill | https://bill.pitc.com.pk/lescobill | 14-digit ref | bill par naam+pata | CAPTCHA, name-search nahi |
| Sui gas | https://viewbill.ssgc.com.pk/web/ | 10-digit consumer no | bill | — |
| PTCL landline | https://ptcl.com.pk/directory/index | naam **ya** pata | landline ↔ naam/pata | CAPTCHA |
| IMEI/DIRBS | https://dirbs.pta.gov.pk/ · SMS `8484` | 15-digit IMEI | device compliance | — |
| CNIC → kitni SIM | https://cnic.sims.pk/ · SMS `668` | CNIC | per-network SIM count (naam nahi) | reCAPTCHA |
| Voter | SMS `8300` | CNIC | electoral area/block | SMS |
| Passport/degree/sanad | DGIP · HEC eservices · IBCC/BISE | token/roll | status, attestation | fee/account |

**Dead (avoid):** simdatabase.pk, siminfo.pk, simlivetracker.com.pk, sims.pk (cert expired), `plra.punjab.gov.pk`,
`ecourts.punjab.gov.pk`, `mtmis.punjab.gov.pk` — inke naye URLs upar hain.

---

## 5. Toolkit (GitHub) — 65 repos machine-verified aaj

Poori verified table: `research/github-osint-verified.md`. Rs 0 ke liye **top 10 starter stack**:

1. **maigret** + **sherlock** — username se 400-3000 sites.
2. **holehe** — email kis site par registered hai; **h8mail** — breach correlate.
3. **phoneinfoga** — number ki footprint.
4. **exiftool** + **mat2** + **suncalc** — photo metadata, aur saya (shadow) se time/place.
5. **instaloader** / **instagrapi** (Instagram), **twscrape**/**twikit** (X) — free cookie se.
6. **yt-dlp** + **gallery-dl** — video/image + metadata.
7. **theHarvester** + **subfinder / dnsx / httpx** — domain/email footprint.
8. **spiderfoot** (Docker) — sab ko correlate karne wala framework.
9. **tesseract + apache/tika + pdfplumber** — documents/OCR.
10. **joplin/logseq** (notes) + **gephi** (link chart) — case file aur graph.

Curated index: `jivoi/awesome-osint`, `osintshifu/awesome-osint-repos`, lockfale/OSINT-Framework.

**Caveats (inhon ne apna ip jalana):** X/IG/LinkedIn par login cookies lazmi aur rate-limit/ban aam hai; AWS/GCP jaisi
shared IPs par kuch sites block karti hain (residential IP behtar); free-tier APIs 100–250 calls/mah tak; breach datasets
free hain magar 100+ GB; HIBP download paid. `SLOW` (unmaintained) tools sirf backup ke liye.

---

## 6. Legal + ethics (Pakistan)

- **PECA 2016 section 16**: kisi aur ki "identity information" baghair ijazat hasil/istemal karna — 3 saal tak qaid ya
  Rs 50 lakh tak jurmana ([text](https://lawhub.pk/laws/section/d229def0d21e4decb6e43b27b32c7b98/)). Practically
  sab log karte hain, magar report mein source likhna aadat bana lein.
- NADRA ka **"Ijazat Aap Ki"** consent model — institutions Verisys se pehle OTP consent lete hain. App mein bhi ye
  mentality rakhein: "consent + source + timestamp".
- **Leaked ≠ official.** Kabhi na kahein "NADRA se verify hua" — kahein "public/copied data".
- Apne aap ko evidence discipline dein: screenshot + timestamp + URL, aur `web.archive.org` / `archive.today` par
  snapshot. Hunchly free milta hai Maltego CE Basic ke saath (200 credits/mo).

---

## 7. Practically kitni door — 3 level

| Level | Kya kar sakte hain | Cost |
|---|---|---|
| **L1 — Amateur pro** | Username/email/number footprint, social media, image/EXIF, geolocation from photos, aur CNIC/reg-no/ref-no se sab official records | Rs 0 |
| **L2 — Serious** | + HLR/current carrier APIs, Verisys jaisa NADRA verify, certified fard/FRC, eCIB, paid data brokers, cloud VM + proxy | chhota paisa |
| **L3 — State level** | Biometric match, live location trace, CDR/tower data, operator ki internal info, dark-web datasets | paisa ya sarkari rabta |

Aap L1 par **poora** khare hain — sirf tools/portal seekhne ki der hai. L1 ke andar bhi 80% log jahan ruk jate hain,
wo sirf 3 wajah se rukte hain: CNIC nahi milta, CNIC hai magar portals pata nahi, aur evidence discipline nahi.

---

## 8. Aap ke app se rabta

Ye poori research aap ke "SIM owner details app" ka **version 2** hai:
- v1 = number → operator + best-effort naam.
- v2 = number → dossier: operator, current network (76367 deep-link), naam (mirror), **CNIC (mirror) → phir 7000 / MTMIS /
  PLRA / SECP / FBR / court / bill ke deep-links ek hi screen par**.
- Yani app ek "OSINT console" ban jaye, sirf lookup nahi — aur ye cheez Pakistan mein abhi free web par bikhri hui hai,
  ek jagah nahi hai.
