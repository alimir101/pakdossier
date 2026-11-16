const js = await (await fetch("https://challenges.cloudflare.com/turnstile/v0/api.js")).text();
console.log("api.js len", js.length);
for (const needle of ["turnstile/f/", "rch", "av0", "/f/", "challenge-platform"]) {
  let i = js.indexOf(needle);
  let n = 0;
  while (i >= 0 && n < 3) {
    console.log(`\n[${needle}] @${i}: ...${js.slice(Math.max(0, i - 160), i + 160).replace(/\s+/g, " ")}...`);
    i = js.indexOf(needle, i + 1);
    n++;
  }
}
