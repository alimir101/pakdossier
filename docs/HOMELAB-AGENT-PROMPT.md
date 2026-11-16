# Homelab Agent — Discovery Prompt (copy everything below the line)

> **How to use:** paste everything from "BEGIN PROMPT" to "END PROMPT" into your homelab agent.
> It only *reads* the machine — no changes. At the end it prints one report; paste that whole report back.

---

BEGIN PROMPT

You are inspecting a homelab host so an architect can plan a self-hosted investigation platform on it.
**Read-only:** do not change, restart, or install anything. Run the commands below, then output ONE report.

## Context (why you are doing this)
A platform will run here behind the *existing* Traefik reverse proxy on a new subdomain (e.g. `os.<domain>`).
It needs: a small web UI, a small API, a headless-browser worker (Obscura, ~300-500MB RAM), Postgres, and a
storage volume for evidence. It must NOT disturb anything already running. So we need exact facts about this host,
its Traefik, its networks/ports, its spare capacity, and its backup/DNS setup.

## Rules
1. **Inspect, don't guess.** If something cannot be determined, write `UNKNOWN` and the command that failed.
2. **Never print secret values.** Print key NAMES and whether they exist, plus length/prefix (e.g. `CF_API_TOKEN=set (40 chars, cf_…)`). Redact tokens, passwords, emails, acme.json contents, private keys.
3. Prefer the exact commands given. Add extra commands if useful, and say what you added.
4. **Do not** run `docker compose down/up`, do not pull images, do not edit files.
5. If a command needs sudo and you have it, use it; if not, note `no sudo` and continue.
6. Keep raw outputs trimmed to the relevant lines. Full paths > pasted walls of text.
7. End with the **SUMMARY FOR THE ARCHITECT** block, filled in from real findings.

## Commands to run (skip any that don't apply, and say so)

### A. Host identity & capacity
```
uname -a; hostnamectl 2>/dev/null; cat /etc/os-release 2>/dev/null
nproc; free -h; df -hT | grep -vE 'tmpfs|overlay'; lsblk -o NAME,SIZE,TYPE,MOUNTPOINT
uptime; cat /sys/class/power_supply/*/status 2>/dev/null || true
ip -brief addr; ip route | head -5
cat /etc/resolv.conf 2>/dev/null | head -10
timedatectl 2>/dev/null | head -5
```

### B. Docker runtime
```
docker version --format '{{.Server.Version}}' 2>/dev/null; docker compose version 2>/dev/null
docker info --format '{{.ServerVersion}} | containers={{.Containers}} running={{.ContainersRunning}} images={{.Images}} driv={{.Driver}} root={{.DockerRootDir}}'
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
docker network ls; docker network inspect <the traefik network> --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null
docker volume ls | head -30
docker system df
```
Also state: is the Docker socket mounted into Traefik? Is Portainer / Dockge / Komodo / Yacht present? How are stacks managed (compose files on disk, Portainer stacks, GUI)? Give the **directory** where compose files live.

### C. Traefik (the important part)
Find how Traefik runs and paste the SANITIZED config + labels:
```
docker ps --filter name=traefik --format '{{.Names}}\t{{.Image}}\t{{.Ports}}'
docker inspect <traefik-container> --format '{{json .Mounts}}' | python3 -m json.tool 2>/dev/null | head -60
docker inspect <traefik-container> --format '{{json .Args}}' | python3 -m json.tool 2>/dev/null
docker inspect <traefik-container> --format '{{json .Config.Labels}}' | python3 -m json.tool 2>/dev/null
```
Then report explicitly:
- Entrypoint name(s) for HTTPS (e.g. `websecure`) and the HTTP→HTTPS redirect entrypoint
- `certificatesResolvers` name(s) and challenge type (http / dns / tls-alpn). If DNS challenge: which provider, env var names only.
- `acme.json` path + permissions + size
- Provider type (docker / file) and, if file provider, the **directory path** and list of dynamic config files
- `providers.docker.network` value (the network Traefik attaches to)
- Whether the Docker provider has `exposedByDefault: false`
- Dashboard: enabled? at which hostname, and is it protected (middleware)?
- Existing **middlewares** defined: name + type (basicauth / forwardauth / rateLimit / headers / redirect). If forward-auth, which service (Authentik / Authelia / Cloudflare Access / none)?
- Existing **routers**: list `RouterName -> Host rule` (this tells us which subdomains are taken and the naming convention)
- Any `defaultRule`, `priority`, or wildcard (`*.domain`) routers
- TLS options / min version / HSTS settings
- Access logs: enabled? path?

### D. DNS, domain, TLS, public entry
- Which domain/subdomain pattern is used, and where DNS is hosted (Cloudflare / registrar / local Pi-hole·AdGuard)
- Static public IP or DDNS? If DDNS, which tool (router, ddclient, Cloudflare API script)?
- Router port forwards for 80/443 present?
- Is Cloudflare in front (orange cloud / Tunnel / Access)? Any `cloudflared` container?
- Local DNS server present (Pi-hole / AdGuard / Unbound / dnsmasq) and does it do internal names?

### E. Security posture
```
sudo ufw status verbose 2>/dev/null || sudo iptables -S 2>/dev/null | head -30
ss -tulpn | head -40
tailscale status 2>/dev/null || wg show 2>/dev/null || echo 'no tailscale/wireguard'
ls -la /etc/cron* 2>/dev/null | head -20
```
Also: fail2ban? crowdsec? any IDS? Is SSH key-only? Non-standard SSH port? `sudo` available to you?

### F. Backups & storage for data
- Backup tool in use (restic / borg / duplicati / rclone / rsync / Proxmox PBS) and where it writes
- Mounted NAS / extra disks usable for an evidence vault (path + free space)
- Is there a UPS? Any monitoring (Uptime Kuma, Grafana, node_exporter)?

### G. Spare capacity verdict
State, with numbers: can this host run **4 extra containers 24/7** (UI ~120MB, API ~150MB, Obscura browser ~500MB, Postgres ~200MB) plus ~5GB disk for a database and evidence store? Any CPU/RAM headroom concern? Any disk-pressure concern?

### H. The VPS (if you can reach it)
- Host/OS/specs, Docker version, what containers already run (names + images + ports)
- Its compose directory, and whether it also has Traefik or plain port mapping
- Can this homelab SSH into it? Through what (public IP, Tailscale, WireGuard)?
- Spare capacity there, and egress public IP (so we know it is a *different* egress than this host)

## Output format (one reply, markdown, in this order)

1. `## A. Host` … `## H. VPS` — one section each, facts only, commands' trimmed output inline
2. `## Free resources` — numbers (CPU, RAM free, disk free, spare ports)
3. `## Traefik facts` — the bullet list from section C, filled in
4. `## What is taken` — subdomains, ports, networks, volume names
5. `## Unknowns` — every `UNKNOWN`, with the command that failed and why
6. `## Risks you noticed` — e.g. Docker socket exposed, dashboard public, no backups, disk >90% full
7. `## SUMMARY FOR THE ARCHITECT` — fill exactly these keys:

```
host_os:
cpu_cores:
ram_total_free:
disk_free_vault_path:
docker_version:
compose_files_dir:
stacks_manager:
traefik_https_entrypoint:
traefik_cert_resolver:
traefik_challenge_type:
traefik_docker_network:
traefik_provider:
traefik_dashboard:
existing_middlewares:
auth_option_available:            # basicauth / forwardauth(which) / cloudflare-access / none
taken_subdomains:
suggested_free_subdomain:
dns_host:
public_ip_type:                   # static / ddns / cloudflare-tunnel
ports_80_443_forwarded:
cloudflare_present:
local_dns:
backup_tool_and_target:
nas_or_extra_disk:
ups:
tailscale_or_wireguard:
spare_capacity_for_4_containers:  # yes/no + numbers
vps_reachable_from_here:          # yes(how)/no
vps_spare_capacity:
vps_egress_ip:
secrets_location:                 # where env/secrets live (.env paths), names only
```

END PROMPT
