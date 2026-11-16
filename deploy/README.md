# Homelab deploy (Docker Compose)

Ye stack **homelab par** chalta hai, aap ke mojooda Traefik + cloudflared ke peeche. Kuch naya public nahi khulta,
aur kisi chalti hui service ko chhua nahi jata (alag project `os`, alag networks, koi host port nahi).

## Kya chalta hai

| Service | Kaam | Public? |
|---|---|---|
| `app` | PWA + API (ek process, `server/app.mjs`) | haan — sirf `os.liflix.online` par, Traefik ke through |
| `obscura` | asli headless browser (captcha-wale gov portals ke liye) | nahi (internal) |
| `sidecar` | browser ko chalata hai, `/pakdb` deta hai | nahi (internal) |

Data `/srv/cloud/os/` par (root disk 85% bhara hai, is liye).

## Steps (homelab par)

```bash
# 1) data + env
sudo mkdir -p /srv/cloud/os/cache

# CDP token (Obscura refuses a non-loopback bind without one, min 32 bytes).
# Read by BOTH the browser and the sidecar via env_file.
sudo sh -c 'echo "OBSCURA_CDP_TOKEN=$(openssl rand -hex 32)" > /srv/cloud/os/obscura.env'
sudo chmod 600 /srv/cloud/os/obscura.env

cd <repo>/deploy
cp .env.example .env          # PUBLIC_HOST; optional provider keys

# 2) network confirm (Traefik isi par hai)
docker network ls | grep dokploy-network

# 3) build + start
docker compose -f compose.yml --env-file .env up -d --build

# 4) dekho
docker compose -f compose.yml ps
docker compose -f compose.yml exec -T app node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>console.log(r.status))"
curl -s https://os.liflix.online/healthz
```

Pehli baar build mein 2-3 minute lagte hain (images download hoti hain).

## Cloudflare Access (auth) — lazmi

Traefik mein koi auth middleware nahi hai, to UI khula rahega. Cloudflare dashboard mein:

`Zero Trust → Access → Applications → Add an application → Self-hosted`
- Application: `os.liflix.online`
- Policy: `Emails` → apna email
- Session: 24h

Iske baad URL kholne par email-OTP maangega.

## Verify / troubleshoot

```bash
docker compose -f compose.yml logs -f app        # app logs
docker compose -f compose.yml logs -f sidecar    # browser sidecar logs
curl -s localhost:8080/api/health                # providers + kaun configured hai
```

**Obscura ke baare mein ahem:** usay `serve --port 9222 --stealth --workers 2` se chalna chahiye.
Bina `--workers 2` page ke andar ke scripts execute nahi hote (test kiya gaya) → owner lookup toot jata hai.

## Rollback

```bash
docker compose -f compose.yml down            # containers band (data /srv/cloud/os rehta hai)
docker compose -f compose.yml down --rmi local -v   # images + volumes bhi
```

## Known limits (honest)

1. Owner-naam wala hissa ek **public mirror + asli browser** par tika hai — mirror throttle karti hai (mahine mein
   kuch windows), aur obscura kabhi kabhi widget par phans jata hai. App ka baqi hissa (offline engine, CNIC mode,
   30 official portals) tab bhi chalta rehta hai.
2. Vault abhi `bind` hai (`/srv/cloud/os/cache`), Postgres M1 mein aayega.
3. `obscura` ko 512MB shm diya gaya hai; browser peaks par RAM dekhte rehna (swap already 3.2 GiB used).
