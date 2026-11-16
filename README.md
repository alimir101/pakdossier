# PakDossier

Free, offline-first "dossier" for Pakistani mobile numbers. Type a number, get the number's shape,
its **original allocated network**, and one-tap **official** checks — with no API key and no cost.

**Status: complete and verified end-to-end.** Offline engine, number/CNIC modes, official portal launcher, live
provider worker, owner name (naam + CNIC + registered address) via a browser sidecar, CNIC auto-unlock, offline PWA,
share card, local case file, and a `doctor` for the flaky parts. See [BUILD-PLAN.md](BUILD-PLAN.md) for the phase log
and [research/PAKDB-PROOF.md](research/PAKDB-PROOF.md) for the raw evidence.

---

## Honesty rules (built in, not bolted on)

1. A prefix is the **original allocated** network — never "the current network". MNP exists in Pakistan, so the live
   network can differ; every result carries that warning plus the official way to check it (SMS `76367`).
2. Every field is labelled with **source + confidence + date** where it comes off the network.
3. An allocation **gap is a normal answer** ("no allocated range found"), not a guess.
4. Nothing claims to be NADRA/PTA-official. Official channels are always surfaced next to our inference.

## Run it

```bash
npm install
npm run dev        # local dev server
npm test           # unit + render smoke tests (87 tests)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve dist/ locally

node scripts/verify-portals.mjs   # re-check every portal URL is still live (uses node fetch)
node scripts/smoke-preview.mjs    # serve dist/ and assert the bundle carries the catalogue
npm run test:live                 # hit the real internet through the worker
node scripts/e2e-live.mjs         # full stack: app served + /api live (run while `npm run preview` is up)
npm run verify:browser            # real Chromium (via Obscura) — render, SW, offline shell + screenshots
npm run doctor                    # health of every moving part (add -- --deep for one real lookup)
```

## Live providers (worker)

`npm run dev` and `npm run preview` mount the real worker on `/api` — **no Cloudflare account needed**.
The same `handleRequest` deploys to Cloudflare via `npx wrangler deploy` (see `wrangler.toml`).

It runs fine with **zero configuration**: one keyless provider (a public lookup page) gives line type,
numbering area and crowd spam counters. Add any of these five free-tier keys as env vars and they light up
automatically; providers you have not configured are reported as `no-key` rather than silently dropped.

| provider | what only it gives | free quota |
|---|---|---|
| `ipqs` | live-ish (HLR) carrier + active flag | 1,000/mo |
| `veriphone` | carrier, line type | 1,000/mo |
| `numlookupapi` | carrier, location, line type | 250/mo |
| `abstractapi` | carrier, line type | 250/mo |
| `numverify` | carrier, location | 100/mo |
| `whoseno` | **keyless**: line type, area, spam stats | none (60/min) |
| `pakdb` | **owner name + CNIC + registered address** | none (needs sidecar) |

Routes: `GET /api/health` (no secrets), `GET /api/lookup?number=…&fresh=1`, `GET /api/status` (quota counters).
Env: `IPQS_KEY`, `VERIPHONE_KEY`, `NUMLOOKUPAPI_KEY`, `ABSTRACTAPI_KEY`, `NUMVERIFY_KEY`, `ALLOWED_ORIGIN`,
`LOOKUP_TIMEOUT_MS`, `CACHE_TTL_SECONDS`, `DISABLE_KEYLESS`.

## Owner name (naam + CNIC + pata)

The mirror that actually has owner records protects its search with a Cloudflare Turnstile widget whose sitekey is
**domain-locked to their own host** — so a PWA cannot mint a token from our origin (`error 110200`). A tiny sidecar
with a real browser mints the token; the POST itself is a plain fetch. Only that one piece needs a browser.

```bash
npm run setup:obscura                 # downloads the Obscura Windows build into .tools/
npm run dev:obscura                   # terminal 1 — Obscura CDP server on :9222
npm run dev:sidecar                   # terminal 2 — sidecar on :8788 (warms up on boot)
PAKDB_BROWSER_URL=http://127.0.0.1:8788 npm run dev   # terminal 3 — app with owner lookups on
```

Measured reality, so nobody is surprised:

- it is a **leaked/public mirror** → name + CNIC are not the official NADRA record and can be stale;
- it **throttles per network** — after ~15 searches: `TOO MANY SEARCHES … try again in 49 minutes`, surfaced as a
  precise `rate-limited` reason (not as "no records"), with a 30-minute per-number sidecar cache in front of it.
  The sidecar remembers the window and stops navigating the browser until it passes (verified: 6ms vs 3.4s), and the
  UI counts it down and retries once when it opens;
- many numbers are simply absent (e.g. `0300 439955` → `TOTAL HITS 0`);
- it does not run on Cloudflare itself, so on deploy the sidecar lives wherever a browser can run.

Two hosts are tried (`.se` and `.com`, same backend) so one going down does not take the feature with it, and
obscura's flaky navigation is retried. Deployment steps: [docs/DEPLOY.md](docs/DEPLOY.md), plus a
`Dockerfile.sidecar` if you would rather run the browser piece in a container.

### Environment quirks of this machine (already handled, but worth knowing)

- **npm cache must live inside the workspace** (the sandbox denies writes to `%LOCALAPPDATA%\npm-cache`).
  That is why `.npmrc` sets `cache=.npm-cache`.
- **The sandbox denies `child_process.spawn` with piped stdio**, which kills Vitest's default `forks` pool with
  `EPERM`. `vite.config.ts` therefore pins `pool: 'threads'`.
- `curl.exe` on this box fails with a schannel error for every HTTPS request — use `node`'s built-in `fetch`
  (see `scripts/*.mjs`) for any network probing.
- Vite dev/preview binds to `localhost` (IPv6 `::1`); fetch `http://localhost:PORT/`, not `127.0.0.1`.

## Layout

```
src/core/        pure, offline, fully unit-tested logic
  types.ts         domain types (confidence / provenance baked in)
  normalize.ts     any number shape -> canonical, with a real reason to reject
  prefix.ts        prefix -> original network + MNP warning + data-integrity guard
  prefixes.pk.json the prefix table (ranges, allocation kind, confidence, sources)
  formats.ts       sms: / tel: / wa.me link builders + official short codes
  analyse.ts       the single UI decision: empty | bad | ok
src/i18n/        Roman Urdu + English strings
src/app.tsx      UI shell (Preact) — L0 card + official actions
worker/          (next) Cloudflare Worker proxy + provider adapters
tests/unit/      68 tests, incl. prefix-data integrity and a render smoke test
```

## What works today (no internet needed)

- Accepts every human way of writing a PK number (`03001234567`, `0300-1234567`, `+92 300 1234567`,
  `00923001234567`, `923001234567`, `3001234567`) and canonicalises it.
- Rejects junk with an honest reason: `empty`, `not-a-number`, `too-short`, `too-long`, `not-pakistan`.
- Identifies kind (mobile / landline / UAN / toll-free) without depending on unreliable metadata.
- Maps `03xx` prefix to operator, MNC, allocation kind, confidence and source links; flags documented gaps.
- Builds `sms:76367?body=N 0300…`, `tel:`, `wa.me` and copy actions.
- **CNIC mode**: validates a CNIC and offers NADRA verify (7000), PTA SIM count (668) and voter check (8300).
- **CNIC reverse**: type a CNIC and it asks the mirror which numbers sit on it — number, name and address,
  with a clear note when the mirror is throttling.
- **Auto-unlock**: when a lookup returns an owner record, its CNIC is shown as a chip (with provider + confidence)
  and **silently unlocks every CNIC-keyed official portal**. A typed CNIC always outranks it; a "dismiss" button
  re-locks it. This is the app's core move: one number → a CNIC → the whole official map.
- **Share**: a WhatsApp-ready text, and a self-contained SVG card (no canvas).
- **Case file**: recent lookups in `localStorage` only (deduped, capped) — click one to re-run it.
- **Offline**: a hand-written service worker caches the shell, so the offline engine and the official links still
  work with no network. Verified in a real browser by cutting the network and reloading.
- **Official portal launcher**: 30 entries across 9 categories (network, identity, device, vehicle, land, courts,
  business, utilities, misc) — each with what it gives, cost, friction and a verified date. Entries whose input is
  missing are shown disabled, not hidden, so the user sees the whole map.

## Troubleshooting

`npm run doctor` checks every moving part in one shot: build output, optional provider keys, Obscura, the sidecar,
the mirror, and a sample of official portals. It exits non-zero only on a hard failure, so it is CI-friendly.
`npm run doctor -- --deep` also performs one real lookup — use it sparingly, because the mirror's throttle is
**sliding**: every search pushes the window forward, so constant probing keeps you locked out.

## Next up

Custom domain + real deploy (see [docs/DEPLOY.md](docs/DEPLOY.md)), and optionally a free provider key so the
live-carrier line lights up.
