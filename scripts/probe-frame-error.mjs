const url = "https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/f/av0/rch/aa/0x4AAAAAADMujqAjT0iboJUw/light/normal/new/normal?lang=auto";
const r = await fetch(url, { headers: { accept: "text/html", referer: "https://pakistandataba.se/databases/sim.php" } });
const body = await r.text();
console.log("status", r.status, "len", body.length);
console.log(body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 700));
const scripts = [...body.matchAll(/<script[^>]*src=["']([^"']+)["']/gi)].map(m => m[1]);
console.log("scripts:", scripts);
const inline = [...body.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
console.log("inline count:", inline.length, inline.map(s => s.length));
