/**
 * Sharing: plain text for WhatsApp, and a self-contained SVG card for an image.
 *
 * SVG (not canvas) because it is a pure string -> fully testable, no canvas
 * shim needed, and it stays crisp at any size.
 */
import type { Lang } from '../i18n/strings';

export interface ShareData {
  national: string;
  e164?: string;
  kind?: string;
  operator?: string;
  ownerName?: string;
  cnic?: string;
  address?: string;
  cnicFromMirror?: boolean;
  portalCount?: number;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildShareText(d: ShareData, lang: Lang): string {
  const ur = [
    `PakDossier — ${d.national}`,
    d.operator ? `Network (prefix): ${d.operator}` : undefined,
    d.kind ? `Qism: ${d.kind}` : undefined,
    d.ownerName ? `Naam: ${d.ownerName}` : undefined,
    d.cnic ? `CNIC: ${d.cnic}${d.cnicFromMirror ? ' (public data — 7000 se tasdeeq)' : ''}` : undefined,
    d.address ? `Pata: ${d.address}` : undefined,
    d.portalCount ? `${d.portalCount} official checks tayyar` : undefined,
    'Official verify: SMS 76367 (network), 668 (SIMs), 7000 (naam/pata)',
  ].filter(Boolean);

  const en = [
    `PakDossier — ${d.national}`,
    d.operator ? `Network (prefix): ${d.operator}` : undefined,
    d.kind ? `Kind: ${d.kind}` : undefined,
    d.ownerName ? `Name: ${d.ownerName}` : undefined,
    d.cnic ? `CNIC: ${d.cnic}${d.cnicFromMirror ? ' (public data — verify via 7000)' : ''}` : undefined,
    d.address ? `Address: ${d.address}` : undefined,
    d.portalCount ? `${d.portalCount} official checks ready` : undefined,
    'Official verify: SMS 76367 (network), 668 (SIMs), 7000 (name/address)',
  ].filter(Boolean);

  return (lang === 'ur' ? ur : en).join('\n');
}

const W = 1000;
const H = 620;

function row(label: string, value: string, y: number): string {
  return `
  <text x="70" y="${y}" class="lbl">${escapeXml(label)}</text>
  <text x="70" y="${y + 34}" class="val">${escapeXml(value)}</text>`;
}

/** Self-contained card: no external fonts or images. */
export function buildShareSvg(d: ShareData): string {
  const rows: string[] = [];
  let y = 250;
  if (d.kind) {
    rows.push(row('QISM / KIND', d.kind, y));
    y += 78;
  }
  if (d.operator) {
    rows.push(row('NETWORK (PREFIX)', d.operator, y));
    y += 78;
  }
  if (d.cnic) {
    rows.push(row(d.cnicFromMirror ? 'CNIC (public data)' : 'CNIC', d.cnic, y));
    y += 78;
  }

  const owner = d.ownerName ? escapeXml(d.ownerName.slice(0, 34)) : '';
  const address = d.address ? escapeXml(d.address.slice(0, 62)) : '';
  const footer = d.portalCount ? `${d.portalCount} official checks · 76367 · 668 · 7000` : '76367 · 668 · 7000';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b1220"/><stop offset="1" stop-color="#12233a"/>
    </linearGradient>
  </defs>
  <style>
    .brand{fill:#4aa3e8;font:700 26px system-ui,sans-serif;letter-spacing:1px}
    .num{fill:#ffffff;font:700 58px system-ui,sans-serif}
    .lbl{fill:#7f93ab;font:700 17px system-ui,sans-serif;letter-spacing:1.2px}
    .val{fill:#e8eef7;font:600 30px system-ui,sans-serif}
    .owner{fill:#ffffff;font:700 34px system-ui,sans-serif}
    .addr{fill:#a9bccf;font:400 21px system-ui,sans-serif}
    .foot{fill:#6f8299;font:400 18px system-ui,sans-serif}
  </style>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="0" y="0" width="10" height="${H}" fill="#4aa3e8"/>
  <text x="70" y="80" class="brand">PAKDOSSIER</text>
  <text x="70" y="170" class="num">${escapeXml(d.national)}</text>
  ${d.e164 ? `<text x="70" y="212" class="addr">${escapeXml(d.e164)}</text>` : ''}
  ${owner ? `<text x="930" y="170" text-anchor="end" class="owner">${owner}</text>` : ''}
  ${rows.join('')}
  ${address ? `<text x="70" y="${H - 90}" class="addr">${address}</text>` : ''}
  <text x="70" y="${H - 46}" class="foot">${escapeXml(footer)}</text>
  <text x="930" y="${H - 46}" text-anchor="end" class="foot">public data · official record nahi</text>
</svg>`;
}
