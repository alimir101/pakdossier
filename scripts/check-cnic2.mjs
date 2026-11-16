const r = await fetch("https://os.liflix.online/api/cnic?cnic=3520296868939", { signal: AbortSignal.timeout(200000) });
const b = await r.text();
const title = /<title>([^<]*)<\/title>/i.exec(b)?.[1] ?? "(no title)";
console.log("status", r.status, "| cloudflare?", r.headers.get("cf-ray") ? "yes" : "no", "| title:", title);
if (r.headers.get("content-type")?.includes("json")) console.log(b.slice(0, 250));
const h = await (await fetch("https://os.liflix.online/healthz")).json().catch(() => null);
console.log("healthz:", JSON.stringify(h));
