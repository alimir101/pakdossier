const r = await fetch("https://os.liflix.online/api/cnic?cnic=3520296868939", { signal: AbortSignal.timeout(200000) });
const b = await r.text();
console.log("status", r.status, "ct", r.headers.get("content-type"), "len", b.length);
console.log(b.slice(0, 200).replace(/\s+/g, " "));
