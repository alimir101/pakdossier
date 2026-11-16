import dns from "node:dns";
dns.setServers(["8.8.8.8","1.1.1.1"]);
const urls=["https://mtmis.excise.punjab.gov.pk/","https://dsj.punjab.gov.pk/","https://punjab-zameen.gov.pk/","https://excise.gos.pk/"];
for(const u of urls){const h=new URL(u).hostname;try{await dns.promises.resolve4(h);}catch{console.log(u+" DNS-FAIL");continue;}
try{const r=await fetch(u,{headers:{"user-agent":"Mozilla/5.0 Chrome/126"},signal:AbortSignal.timeout(25000)});const b=await r.text();
const t=b.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ");
console.log(u+"\tHTTP "+r.status+"\tlen="+b.length+"\tinputs="+(b.match(/<input/gi)||[]).length+"\t"+t.slice(0,180));}catch(e){console.log(u+"\tFAIL "+(e.cause?.code||e.message));}}
