for (const host of ["os.liflix.online", "liflix.online", "cloud.liflix.online"]) {
  try {
    const r = await fetch("https://" + host + "/", { signal: AbortSignal.timeout(15000), redirect: "manual" });
    const body = (await r.text()).slice(0, 120).replace(/\s+/g, " ");
    console.log(`${host.padEnd(24)} HTTP ${r.status} ct=${r.headers.get("content-type") ?? "-"} server=${r.headers.get("server") ?? "-"}`);
    console.log(`   ${body}`);
  } catch (e) { console.log(`${host.padEnd(24)} ERR ${e.cause?.code ?? e.message}`); }
}
