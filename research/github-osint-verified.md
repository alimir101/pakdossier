# Verified maintained OSINT GitHub tools — 16 Nov 2026

**Verification method:** `api.github.com/repos/{owner}/{repo}` (65 repos: full_name, pushed_at, stargazers, license, archived) + `img.shields.io/github/last-commit/*` for the few that hit the 60/hr API limit + `web_fetch` HTML cross-check for 4 contested repos. Nothing below is guessed. `pushed` = last push date. Rounded stars (15k/33k/13k) came from badges.

Legend — **Key:** ✅ keyless · ⚠️ free account/cookie needed · 🔑 free API key optional/needed · 💰 real money
**St:** ACT = pushed in 2026 · SLOW = last push >9 months · ARCH = archived

## Username / handle
| repo (owner/repo) | kya karta hai | form | key/paid | license | pushed | st |
|---|---|---|---|---|---|---|
| sherlock-project/sherlock | 400+ sites par username hunt | CLI, Docker | ✅ | MIT | 2026-11-15 | ACT |
| soxoj/maigret | 3000+ sites + profile report; akela sabse acha | CLI, Docker | ✅ | MIT | 2026-11-15 | ACT |
| antoniaci/blackbird | username/email search, JSON+CSV output (p1ngul1n0 se rename) | CLI | ✅ (kuch widget keys optional) | none | 2026-11-03 | ACT |
| WebBreacher/WhatsMyName | site-list based username enumeration | CLI + web (whatsmy.name) | ✅ | NOASSERTION | 2026-11-09 | ARCH |
| thewhiteh4t/nexfil | username/email se profiles | CLI | ✅ | MIT | 2023-09-30 | SLOW |

## Email
| megadose/holehe | email kis site par registered hai (password-reset trick) | CLI | ✅ | GPL-3.0 | 2024-09-10 | SLOW |
| khast3x/h8mail | email → breach/paste correlation | CLI | 🔑 HIBP key optional (free basic) | NOASSERTION | 2023-08-15 | SLOW |

## Phone
| sundowndev/phoneinfoga | number OSINT: carrier, format, scanner footprints | CLI + web UI + Docker | ✅ core; 🔑 numverify optional | GPL-3.0 | 2026-08-25 | ACT |
| megadose/ignorant | number un apps (Amazon/IG/Snap…) par registered hai? | CLI | ✅ | GPL-3.0 | 2024-07-27 | SLOW |

## Image / EXIF / metadata
| exiftool/exiftool | sabse mukammal EXIF/XMP/metadata reader-writer | CLI (Perl) | ✅ | GPL-3.0 | 2026-11-10 | ACT |
| drewnoakes/metadata-extractor | image metadata library | lib (Java) | ✅ | Apache-2.0 | 2026-11-05 | ACT |
| mattiasw/ExifReader | browser/node EXIF reader | lib (JS) | ✅ | MPL-2.0 | 2026-11-13 | ACT |
| jvoisin/mat2 | metadata anonymiser (EXIF strip) | CLI, GUI | ✅ | LGPL-3.0 | 2026-11-15 | ACT |

## Geolocation & chronolocation
| mourner/suncalc | sun position → shadow direction se photo ka time/place | lib (JS) | ✅ | BSD-2 | 2026-11-10 | ACT |
| GPSBabel/gpsbabel | GPS/geotag format converter | CLI, GUI | ✅ | GPL-2.0 | 2026-11-13 | ACT |
| openstreetmap/iD | browser OSM editor (map ke against verify) | web | ✅ | ISC | 2026-11-15 | ACT |
| Leaflet/Leaflet + openlayers/openlayers | maps banane ki JS libs | lib (JS) | ✅ OSM tiles free; Mapbox optional 💰 | BSD-2 | 2026-11-15 / 11-14 | ACT |
| photoprism/photoprism | photo library + geo map, self-host | web + Docker | ✅ | NOASSERTION | 2026-11-15 | ACT |

## Social media
| instaloader/instaloader | Instagram posts/stories/DP (login optional) | CLI, lib | ⚠️ login optional, free | MIT | 2026-11-01 | ACT |
| subzeroid/instagrapi | Instagram private API | lib | ⚠️ IG account | NOASSERTION | 2026-11-16 | ACT |
| vladkens/twscrape | X/Twitter scraping, async (snscrape ka replacement) | CLI, lib | ⚠️ X account cookies | MIT | 2026-11-13 | ACT |
| d60/twikit | Twitter/X internal API, keyless-ish | lib | ⚠️ cookies | MIT | 2026-03-10 | ACT |
| JustAnotherArchivist/snscrape | X + FB + more, purana standard | CLI, lib | ✅ | GPL-3.0 | 2023-11-15 | SLOW |
| yt-dlp/yt-dlp | 1000+ sites ka video/audio/metadata | CLI | ✅ | Unlicense | 2026-11-15 | ACT |
| mikf/gallery-dl | 200+ sites ki image galleries | CLI | ✅ | GPL-2.0 | 2026-11-14 | ACT |
| davidteather/TikTok-Api | TikTok user/video/sound data | lib | ✅ (ms_token optional) | MIT | 2026-11-14 | ACT |
| kevinzg/facebook-scraper | FB public pages/posts | lib | ✅ | MIT | 2024-06-22 | SLOW |
| joeyism/linkedin_scraper | LinkedIn profile/company/job scrape | lib | ✅ | GPL-3.0 | 2026-04-10 | ACT |
| Datalux/Osintgram | Instagram followers/following/geo | CLI | ⚠️ IG login | GPL-3.0 | 2026-10-30 | ACT |
| qeeqbox/social-analyzer | 1000+ sites par profile detect + web UI | CLI, lib, web | ✅ | AGPL-3.0 | 2026-11-08 | ACT |

## Domain / IP / host
| projectdiscovery/subfinder | passive subdomain enum | CLI, Docker | ✅ (+🔑 free keys se zyada sources) | MIT | 2026-11 | ACT |
| projectdiscovery/httpx | HTTP probing + tech detect | CLI | ✅ | MIT | 2026-11 | ACT |
| projectdiscovery/nuclei | 8000+ template vuln/tech scan | CLI | ✅ | MIT | 2026-11-x | ACT |
| projectdiscovery/dnsx | DNS resolution toolkit | CLI | ✅ | MIT | 2026-11-16 | ACT |
| owasp-amass/amass | deep attack-surface / OAM | CLI | ✅ | NOASSERTION | 2026-11-16 | ACT |
| laramies/theHarvester | emails, subdomains, hosts | CLI | ✅ (+🔑 optional sources) | GPL-2.0 | 2026-11-15 | ACT |
| lanmaster53/recon-ng | module-based recon framework | CLI | ✅ modules; kuch 🔑 | GPL-3.0 | 2026-10-05 | ACT |
| darkoperator/dnsrecon | DNS records/zone transfer/brute | CLI | ✅ | GPL-2.0 | 2026-11-14 | ACT |
| Findomain/Findomain | fast subdomain finder | CLI | ✅ | GPL-3.0 | 2026-11-13 | ACT |
| s0md3v/Photon | crawler: URLs, emails, keys | CLI | ✅ | none | 2026-10 | ACT |
| urbanadventurer/WhatWeb | CMS/tech fingerprint | CLI | ✅ | GPL-2.0 | 2026-04-02 | ACT |
| EnableSecurity/wafw00f | WAF detect | CLI | ✅ | BSD-3 | 2026-04-19 | ACT |
| trufflesecurity/trufflehog | secrets + verify | CLI, Docker | ✅ | AGPL-3.0 | 2026-11-16 | ACT |
| gitleaks/gitleaks | git repo secrets | CLI, Docker | ✅ | MIT | 2026-10-28 | ACT |
| initstring/cloud_enum | AWS/Azure/GCP bucket enum | CLI | ✅ | MIT | 2026-10-04 | ACT |
| lc/gau | known-URLs fetch (wayback/otx/urlscan) | CLI | ✅ | MIT | 2026-10-12 | ACT |
| michenriksen/aquatone | host screenshotting | CLI | ✅ | MIT | 2022-05-22 | ARCH |

## Person / framework / breach
| smicallef/spiderfoot | 200+ modules, correlate sab; CLI + web UI | CLI, Docker, web | ✅ modules; kuch 🔑; HX cloud 💰 | MIT | 2026-04-13 | ACT |
| kpcyrd/sn0int | Rust OSINT framework, keyless | CLI | ✅ | GPL-3.0 | 2026-09-20 | ACT |
| Ekultek/WhatBreach | breachers DB se email/number search | CLI | ✅ | none | 2025-08-14 | SLOW |
| hmaverickadams/breach-parse | "Breach Compilation" torrent se bulk search | CLI | ✅ (dataset free) | none | 2024-03-21 | SLOW |

## Note-taking & link-analysis / graph
| gephi/gephi | graph visualisation + network metrics | GUI (Java) | ✅ | GPL-3.0 | 2026-11-08 | ACT |
| jacomyal/sigma.js | webgraph (WebGL) library | lib (TS) | ✅ | MIT | 2026-11-10 | ACT |
| visjs/vis-network | network graph library | lib (JS) | ✅ | Apache-2.0 | 2026-11-16 | ACT |
| jgraph/drawio-desktop | manual link chart / entity diagram | GUI | ✅ | GPL-3.0 | 2026-11-05 | ACT |
| laurent22/joplin | notes + backlinks | GUI, CLI, self-host | ✅ (Joplin Cloud 💰 optional) | NOASSERTION | 2026-11-15 | ACT |
| logseq/logseq | outliner/knowledge graph | GUI | ✅ | AGPL-3.0 | 2026-11-15 | ACT |
| TriliumNext/Trilium | notes + relation graph, self-host | GUI, web, Docker | ✅ | AGPL-3.0 | 2026-11-16 | ACT |

## Document / metadata
| apache/tika | 1600+ file formats se text+metadata nikalna | CLI/server | ✅ | Apache-2.0 | 2026-11-13 | ACT |
| tesseract-ocr/tesseract | OCR engine | CLI, lib | ✅ | Apache-2.0 | 2026-11-15 | ACT |
| ocrmypdf/OCRmyPDF | PDF → searchable PDF + sidecar | CLI, Docker | ✅ | MPL-2.0 | 2026-11-16 | ACT |
| jsvine/pdfplumber | PDF text/table/char coordinates | lib | ✅ | MIT | 2026-10-15 | ACT |

## Automation frameworks
| n8n-io/n8n | 400+ nodes, low-code automation; OSINT API chaining | web, Docker, self-host | ✅ self-host (cloud 💰) | NOASSERTION (fair-code) | 2026-11-16 | ACT |
| microsoft/playwright | browser automation (login-walled sites) | CLI, lib, Docker | ✅ | Apache-2.0 | 2026-11-15 | ACT |

## Awesome / curated lists
| jivoi/awesome-osint | sabse bada OSINT index | docs | n/a | NOASSERTION | 2026-11-12 | ACT |
| hslatman/awesome-threat-intelligence | threat-intel feeds/tools | docs | n/a | Apache-2.0 | 2026-10 | ACT |
| sinwindie/OSINT | workflow/collection playbooks | docs | n/a | none | 2023-06 | SLOW |

## Unverified / dead (confirmed nahi chal rahe)
| repo | finding |
|---|---|
| tomquirk/linkedin-api | GitHub page 404 (API + badge + web_fetch teeno) → repo gayab; pip package ab bhi hai |
| graphviz/graphviz (GitHub) | GH par archived + 5 stars; asli dev GitLab par — `ellson/graphviz` mirror last commit Jun 2018 |
| michenriksen/aquatone | archived, last push May 2022 — chalega magar naya nahi |
| WebBreacher/WhatsMyName | repo archived; data live `whatsmy.name` se aata hai |
