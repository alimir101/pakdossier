# Homelab Agent — Deploy Prompt (copy everything below the line)

> **How to use:** apne usi homelab agent session mein ye poora prompt paste kar dein (jisne discovery ki thi).
> Ye deploy karega, verify karega, aur ek chhota report degi jo aap mujhe paste kar denge.

---

BEGIN PROMPT

Aap is homelab par ek chhota self-hosted app deploy kar rahe ho. Aap ne pehle is host ki discovery ki thi
(Traefik v3.7.14, dokploy-network, /srv/cloud, Dokploy, cloudflared). Wahi facts ab use karo.

## Kya deploy karna hai
Repo (public): `https://github.com/alimir101/pakdossier`
Uske andar `deploy/compose.yml` ek 3-container stack hai:
- `app` — PWA + API (Traefik ke peeche, sirf `os.liflix.online` par public)
- `obscura` — headless browser (internal)
- `sidecar` — browser ko chalata hai (internal)

Aap ka kaam: ise **os** project ke naam se chalana, aur verify karke report dena.

## Sakht niyam (existing kuch na tootay)
1. **Kisi chalti hui service ko restart na karo**, Traefik/Dokploy ko touch na karo, koi compose file edit na karo
   (sirf is naye stack ki).
2. **Koi naya public port na kholo** aur UFW ko change na karo — Traefik ke through route hoga.
3. Naya stack alag project `os` hai, apna network (`os-internal`) + `dokploy-network` (external) use karta hai.
4. Data `/srv/cloud/os/` par rahega (root disk 85% bhara hai — wahan kuch bara na rakho).
5. Internet chahiye (images build hongi). Build 2-4 minute le sakta hai — normal hai.

## Steps

```bash
# 1) git + folder
command -v git >/dev/null || sudo apt-get update && sudo apt-get install -y git
sudo mkdir -p /srv/cloud/os/cache
sudo chown -R "$USER":"$USER" /srv/cloud/os 2>/dev/null || true

# 2) repo (kahin bhi, jaise /opt/src)
sudo mkdir -p /opt/src && sudo chown "$USER":"$USER" /opt/src
cd /opt/src
[ -d pakdossier ] || git clone --depth 1 https://github.com/alimir101/pakdossier.git
cd pakdossier && git pull --ff-only

# 3) env + sanity
cd deploy
[ -f .env ] || cp .env.example .env
docker network ls | grep -q dokploy-network || echo "WARN: dokploy-network nahi mila"
docker compose -f compose.yml config >/dev/null && echo "compose OK"

# 4) start (build included)
docker compose -f compose.yml --env-file .env up -d --build

# 5) verify (andar se)
docker compose -f compose.yml ps
docker compose -f compose.yml exec -T app node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>console.log('healthz',r.status))"
docker compose -f compose.yml exec -T app node -e "fetch('http://127.0.0.1:8080/api/health').then(r=>r.text()).then(t=>console.log(t.slice(0,300)))"
```

Phir **bahar se** (Cloudflare ke through) — ye asli proof hai:

```bash
curl -s -o /dev/null -w "https://os.liflix.online -> %{http_code}\n" https://os.liflix.online/healthz
curl -s https://os.liflix.online/api/health | head -c 300; echo
```

Mumkin natije:
- `200` aur JSON → sab theek, Traefik router lag gaya.
- `404` → Traefik tak pohanch raha hai magar router nahi bana: `docker compose ps` dekho (app chal raha hai?),
  phir `docker inspect os-app-1 --format '{{json .Config.Labels}}'` mein `traefik.enable=true` aur
  `traefik.docker.network=dokploy-network` confirm karo. Container `dokploy-network` par hai ya nahi:
  `docker inspect os-app-1 --format '{{json .NetworkSettings.Networks}}'`.
- `502/503` → app crash hua: `docker compose -f compose.yml logs --tail=80 app`.

## Extra checks (agar asaan ho)
1. `curl -s localhost:9222/json/version` ke bajaye: `docker compose exec -T obscura /opt/obscura/obscura --version`
2. `docker stats --no-stream` se 3 containers ka RAM note karo (obscura sabse bhaari hoga).
3. `docker compose -f compose.yml exec -T sidecar node -e "fetch('http://127.0.0.1:8788/healthz').then(r=>r.text()).then(console.log)"`
   — ye browser sidecar ke health ki line degi (expected: `{"ok":true,...}`).

## Report (isi shakal mein, aur kuch nahi)

```
DEPLOY RESULT
app_container:      running/not (docker compose ps se)
compose_errors:     none / <kaun sa>
health_internal:    <http code>
health_public:      <http code from https://os.liflix.online/healthz>
api_health_public:  <kaun se providers configured hain — sirf provider ids + keyPresent true/false>
traefik_router:     os-intel-websecure dikha? (docker inspect se labels confirm)
networks_attached:  os-internal + dokploy-network? yes/no
ram_used_mb:        app / obscura / sidecar (docker stats se)
sidecar_healthz:    <line>
git_rev:            <git -C /opt/src/pakdossier rev-parse --short HEAD>
notes:              jo bhi ajeeb laga
```

Rollback (agar kuch galat lage):
```
cd /opt/src/pakdossier/deploy && docker compose -f compose.yml down
```

Yaad rakho: **Traefik, Dokploy, cloudflared aur baqi 62 containers ko touch nahi karna.**

END PROMPT
