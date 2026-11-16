import dns from "node:dns";
dns.setServers(["8.8.8.8","1.1.1.1"]);
for (const h of ["pakistandatabase.com","www.pakistandatabase.com","api.pakistandatabase.com","fuckingapisystem.pakistandatabase.com"]) {
  try { const a = await dns.promises.resolve4(h); console.log(h, "->", a.join(",")); } catch(e){ console.log(h, "-> DNS FAIL", e.code||e.message); }
}
try {
  const r = await fetch("https://pakistandatabase.com/databases/sim.php", { signal: AbortSignal.timeout(20000), redirect: "follow" });
  const h = await r.text();
  console.log("site status", r.status, "len", h.length, "turnstile:", /cf-turnstile/.test(h), "sitekey:", (h.match(/data-sitekey="([^"]+)"/)||[])[1]);
} catch(e){ console.log("site ERR", e.cause?.code||e.message); }
