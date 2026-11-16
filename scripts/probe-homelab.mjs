import net from "node:net";
const probe = (host, port) => new Promise((res) => {
  const s = net.connect({ host, port, timeout: 3000 });
  s.on("connect", () => { s.destroy(); res("OPEN"); });
  s.on("timeout", () => { s.destroy(); res("TIMEOUT"); });
  s.on("error", (e) => res("ERR " + e.code));
});
for (const [h, p] of [["192.168.102.4", 22], ["192.168.102.4", 443], ["192.168.102.4", 80]]) {
  console.log(`${h}:${p} -> ${await probe(h, p)}`);
}
