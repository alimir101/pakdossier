# Pakistan Rs-0 Private Investigator — Free Official & Public Record Lookups
**Probed live on 16-Nov-2026 (`research/probe-registries*.mjs`). Every row below was fetched and its HTTP result recorded.**
Legend for **Status**: `LIVE 200` = fetched OK; `LIVE+CF` = live but Cloudflare/bot-challenge to scripts; `JS-SPA` = live but content rendered by JS; `DEAD` = DNS/HTTP dead; `NOT-VERIFIED` = field list taken from sources, not machine-read.

---

## 1. Identity / NADRA

| Source | URL | Input | Returns | Cost | Friction | Status |
|---|---|---|---|---|---|---|
| PTA SIM Information System | https://cnic.sims.pk/ | 13-digit CNIC | per-network SIM count only (**no name**) | Free | reCAPTCHA | LIVE 200 |
| NADRA SMS 7000 | (SMS) 7000 | CNIC | **name + address/father name** | ~Rs 10 | phone/SMS | NOT-VERIFIED (multi-source) |
| ECP+NADRA SMS 8300 | (SMS) 8300 | CNIC | electoral area, block code, serial (**no name**) | ~Rs 2 | phone/SMS | NOT-VERIFIED (ECP page) |
| NADRA SMS 8400 | (SMS) 8400 | tracking ID | CNIC application status | SMS rate | phone | NOT-VERIFIED |
| PTA SMS 668 | (SMS) 668 | CNIC | SIM count (same as cnic.sims.pk) | ~Rs 2 | phone | NOT-VERIFIED |
| PakID app | app only | own CNIC+biometric | own full record + **family tree** | Free | app+biometric | n/a |
| NADRA family tree / FRC | https://www.nadra.gov.pk/ | own account | family record, FRC | Free / fee for certificate | login; site flaky 403 | LIVE 200 (flaky) |
| NADRA Verisys (official API) | https://www.nadra.gov.pk/ | CNIC + issue date | official verification | Paid, institution contracts | contract | LIVE 200 |
| PakistanDatabase (leaked mirror) | https://pakistandataba.se/databases/sim.php | number **or** CNIC | **name + CNIC + address** | Free web; API $20/mo | Cloudflare Turnstile | LIVE 200 + Turnstile, CAPTCHA-REQUIRED |

## 2. Vehicle / driving licence

| Source | URL | Input | Returns | Cost | Friction | Status |
|---|---|---|---|---|---|---|
| MTMIS Punjab | https://mtmis.excise.punjab.gov.pk/ | reg. no + reg. date + picture code | **owner name, father/husband name, owner city**, engine/chassis, token tax | Free | CAPTCHA | LIVE 200 (results JS) |
| Excise Sindh (MTMIS) | https://excise.gos.pk/ → Vehicle search; `…/vehicle/vehicle_search` | reg. no; or CNIC (two-wheeler/four-wheeler) → lists all vehicles on that CNIC | owner's name reported; CNIC/contact hidden | Free | Cloudflare blocks bots | LIVE+CF (403 to script) |
| KP Excise MV records | https://www.kpexcise.gov.pk/mvrecords/ (resolves to `/new/`) | reg. no | MV record | Free | JS menu | LIVE 200; fields NOT-VERIFIED |
| Balochistan vehicle verification | https://etanb.com/vehicle-verification/ | reg. no + district | owner/engine/registration text present | Free | CAPTCHA | LIVE 200 |
| Islamabad Excise | https://islamabadexcise.gov.pk/ | reg. no | registration status | Free | — | LIVE 200 (flaky) |
| DLIMS Punjab / Dastak licence verify | https://dlims.punjab.gov.pk/verify | CNIC + licence no | licence details | Free | login for apply | LIVE 200 |
| DLS Sindh (Sindh Police) | https://dls.gos.pk/ | CNIC | licence issue/verify | Free | login for apply | LIVE 200 |
| Punjab online ownership transfer | https://excise.punjab.gov.pk/ | reg. no | transfer status | Free/PSID fee | login | LIVE 200 |

## 3. Land / property

| Source | URL | Input | Returns | Cost | Friction | Status |
|---|---|---|---|---|---|---|
| PLRA Punjab (fard / mutation) | https://punjab-zameen.gov.pk/ | district/tehsil/village + khewat/khasra/CNIC | **owner name(s), fard, mutation status** | Free online; fee for certified copy | JS-SPA | LIVE 200 (JS-SPA) |
| e-Stamping Punjab (verify) | https://es.punjab-zameen.gov.pk/eStampCitizenPortal/ChallanFormView/VerifyStamp | e-stamp no | stamp verification; also SMS 8100 | Free | — | LIVE 200 |
| Sindh Zameen / LARMIS (BoR Sindh) | https://sindhzameen.gos.pk/ | district/taluka/deh + owner CNIC **or name** | ownership record (Form VII-A etc.) | Free | — | LIVE 200 |
| KP CLRMIS e-Fard | https://efard.kplr.gkp.pk/ | account + name/father/CNIC | eFard PDF | Free + fee | **account + NADRA biometric at e-Sahulat** | LIVE 200 |
| KP SDC appointment | https://kplr.gkp.pk/ | — | appointment for record | Free | — | LIVE 200 |
| ePay Punjab (property/professional tax) | https://epay.punjab.gov.pk/ | PSID/reference | tax payment & receipt | Free | — | LIVE 200 |
| Sindh ePay | https://epay.gos.pk/ | PSID | tax payment | Free | — | LIVE 200 |
| Punjab tenant/employee registration | https://pkm.punjab.gov.pk/public/ | CNIC | tenant/employee record | Fee | — | LIVE 200 |
| Sindh tenant registration (TRUST) | https://tenantregister.sindhpolice.gov.pk/ | CNIC | landlord/tenant record | Free | — | LIVE 200 |

## 4. Business / tax

| Source | URL | Input | Returns | Cost | Friction | Status |
|---|---|---|---|---|---|---|
| SECP company name search | https://eservices.secp.gov.pk/eServices/NameSearch.jsp | company name | name availability/registration | Free | — | LIVE 200 |
| SECP directors (Form-29) | https://eservices.secp.gov.pk/ | company + doc request | directors/shareholders | Paid certified copy | login | LIVE 200 (root empty SPA) |
| SECP main site | https://www.secp.gov.pk/ | — | notices | Free | Cloudflare | LIVE+CF (403) |
| FBR NTN / verification portal | https://e.fbr.gov.pk/esbn/Verification | NTN/CNIC | verification (now redirects iris.fbr.gov.pk) | Free | OTP on iris | LIVE 200 |
| FBR Active Taxpayer List (online) | https://e.fbr.gov.pk/atlsearchutility.aspx?PID=… | CNIC/NTN | ATL status | Free | — | LIVE 200 |
| FBR ATL by SMS | (SMS) 9966 — `ATL <CNIC/NTN>` | CNIC/NTN | ATL status | SMS rate | phone | NOT-VERIFIED (FBR page) |
| FBR ATL sales-tax list download | https://fbr.gov.pk/atl-sales-tax/163223 | — | full ATL file (updated 16-Nov-2026) | Free | big file | LIVE 200 |
| FBR "tax directory" | `taxdirectory.fbr.gov.pk` | — | income-tax directory | Free | — | **DEAD (DNS)**; use fbr.gov.pk category page |
| Trade licence | https://kmc.gos.pk/ (Karachi), Dastak/LCCI | business name/CNIC | municipal trade licence | Fee | city-wise, no central portal | KMC LIVE 200; `mcl.gov.pk` DNS-DEAD |
| LCCI chamber membership | https://lcci.com.pk/ | company | chamber record | Free/paid | — | LIVE 200 |

## 5. Courts / police

| Source | URL | Input | Returns | Cost | Friction | Status |
|---|---|---|---|---|---|---|
| Punjab district judiciary CMS | https://dsj.punjab.gov.pk/ | district + party name/CNIC/police station | case status, cause list | Free | CAPTCHA (math) | LIVE 200 |
| Sindh High Court case search | https://cases.shc.gov.pk/ | case no/party, all benches | case status | Free | — | LIVE 200 |
| Sindh district courts CFMS | https://cases.districtcourtssindh.gos.pk/ | case no/party | case status, cause list | Free | — | LIVE 200 |
| Supreme Court search | https://www.supremecourt.gov.pk/ , https://www.scp.gov.pk/ | case/party | case & judgment search | Free | — | LIVE 200 |
| Lahore High Court | https://lhc.gov.pk/ | case | judgments/cause lists (case-status subpath 404) | Free | — | LIVE 200 |
| Punjab Police / e-complaint | https://punjabpolice.gov.pk/ , https://igp-8787-center.psca.gop.pk/online/complaint , 1787 | complaint/E-Tag | complaint & FIR copy, tracking | Free | portal 403 to bots | LIVE 200; e-complaint LIVE+CF |
| Punjab police services (Khidmat Markaz) | https://pkm.punjab.gov.pk/public/ | CNIC | character cert, verification, tenant reg, **copy of FIR** | Fee per service | center/online | LIVE 200 |
| Sindh Police | https://www.sindhpolice.gov.pk/ , https://karachipolice.gov.pk/ | — | FIR / station info | Free | — | LIVE 200 |
| KP Police | https://kppolice.gov.pk/ | — | FIR/complaint | Free | — | LIVE 200 |

## 6. Utilities (bill → name + address)

| Source | URL | Input | Returns | Cost | Friction | Status |
|---|---|---|---|---|---|---|
| PITC DISCO bills (LESCO/IESCO/GEPCO/FESCO/MEPCO/HESCO/PESCO/SEPCO/QESCO/TESCO) | https://bill.pitc.com.pk/lescobill (etc.) | 14-digit reference no or Customer ID | **bill PDF shows consumer name + address** | Free | CAPTCHA; **no search by CNIC/name** | LIVE 200 (LESCO/GEPCO) |
| K-Electric | https://ke.com.pk/bills-e-payments/ | 13-digit ref/consumer ID | bill | Free | — | LIVE 200 |
| SNGPL (gas, north) | https://sngpl.com.pk/ → bill calc (`billcalc.jsp?mdids=92`) | 11-digit consumer no | bill w/ name+address | Free | CAPTCHA | site LIVE 200 |
| SSGC (gas, south) | https://viewbill.ssgc.com.pk/web/ | 10-digit consumer no | bill | Free | — | LIVE 200 |
| PTCL phone directory | https://ptcl.com.pk/directory/index | city + name **or** address | **landline number ↔ name/address** | Free | CAPTCHA | LIVE 200 |
| Pakistan Post postal code | https://www.pakpost.gov.pk/postcode.php | area | postal code | Free | — | LIVE 200 |

## 7. Voter & misc

| Source | URL | Input | Returns | Cost | Friction | Status |
|---|---|---|---|---|---|---|
| ECP voter check (SMS only) | https://ecp.gov.pk/check-your-registration | CNIC → 8300 | electoral area, block, serial | ~Rs 2 | no online form | LIVE 200 |
| ECP electoral rolls | https://ecp.gov.pk/electoral-rolls | — | stats/rolls | Free | — | LIVE 200 |
| PTA DIRBS (IMEI) | https://dirbs.pta.gov.pk/ , SMS 8484, `*8484#` | 15-digit IMEI | device compliance status | Free | — | LIVE 200 |
| DGIP passport | https://www.dgip.gov.pk/ , https://onlinemrp.dgip.gov.pk/ | token no | renewal + status (tracking via SMS 9988) | Fee | 403 to some bots | LIVE 200 (node) / 403 (web_fetch) |
| HEC degree attestation | https://eservices.hec.gov.pk/ , https://www.hec.gov.pk/english/services/students/DAS/Pages/Degree-Attestation.aspx | degree data | e-attestation, verification status | Rs 3,000/doc | account+payment | LIVE 200 |
| IBCC equivalence/attestation | https://ibcc.edu.pk/ | certificates | equivalence/attestation | Fee | — | LIVE 200 |
| BISE Lahore | https://www.biselahore.com/ | roll no | results, sanad/verification | Free/fee | — | LIVE 200 |
| IPO Pakistan (trademark/patent) | https://ipo.gov.pk/ | mark/app no | TM/patent record | Free | — | LIVE 200 |
| FIA | https://www.fia.gov.pk/ | — | immigration/agency info | Free | — | LIVE 200 |
| PFA / DRAP licence | https://pfa.gop.pk/ , https://www.dra.gov.pk/ | licence/company | food/drug licence | Free | — | LIVE 200 |

**Dead / not working today:** `simdatabase.pk` (NXDOMAIN), `siminfo.pk` (NXDOMAIN), `simdatabase.com.pk` (SERVFAIL), `simlivetracker.com.pk` (lame delegation), `sims.pk` (cert expired), `taxdirectory.fbr.gov.pk`, `mcl.gov.pk`, `passport.gov.pk`, `plra.punjab.gov.pk`, `ecourts.punjab.gov.pk`, `mtmis.sindh.gov.pk`, `mtmis.excise.sindh.gov.pk`, `dls.sindh.gov.pk`, `estamp.punjab.gov.pk`, `epay.sindh.gov.pk`, `casestatus.lhc.gov.pk`, `verify.hec.gov.pk`, `pcr.punjab.gov.pk` (404 on root).

---

## The one-and-only wall (what public can never get)
1. **Live GPS location** of a number — only the operator's HLR; no public feed.
2. **Official/current SIM owner** for a *stranger's* number — NADRA/operator only; everything public is a copied (leaked) snapshot.
3. **CNIC from a mobile number** — only via the copied DBs; PTA/NADRA have no public reverse lookup.
