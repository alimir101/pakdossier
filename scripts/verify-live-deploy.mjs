const base = "https://os.liflix.online";
const idx = await fetch(base + "/");
console.log("app /:", idx.status, "bytes=" + (await idx.text()).length, "| server:", idx.headers.get("server") ?? "-");
const h = await (await fetch(base + "/api/health")).json();
console.log("providers:", h.providers.map(p => `${p.id}:${p.keyPresent ? "on" : "off"}`).join(" "));
const t0 = Date.now();
try {
  const r = await fetch(base + "/api/lookup?number=03331234567", { signal: AbortSignal.timeout(180000) });
  const b = await r.json();
  const owner = (b.results ?? []).find(x => x.provider === "pakdb");
  const why = (b.partial ?? []).find(p => p.provider === "pakdb");
  console.log(`lookup: HTTP ${r.status} in ${Date.now() - t0}ms results=${b.results?.length}`);
  console.log(owner?.fields?.records?.length
    ? "*** OWNER DATA LIVE *** " + owner.fields.records.map(x => `${x.name} | ${x.cnic} | ${x.address}`).join("  //  ")
    : `pakdb: ${why?.reason} — ${why?.detail?.slice(0, 80)}`);
} catch (e) { console.log("lookup ERR", e.message); }
const c = await (await fetch(base + "/api/cnic?cnic=3520296868939", { signal: AbortSignal.timeout(180000) })).json();
console.log("cnic reverse:", c.ok ? `records=${c.records?.length} hits=${c.totalHits}` : JSON.stringify(c).slice(0, 120));
