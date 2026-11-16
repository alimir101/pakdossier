/**
 * Offline link builders. Zero network, pure functions.
 *
 * These are the boring but load-bearing part: they turn the dossier into
 * one-tap actions on the user's own phone (SMS short codes, tel:, wa.me).
 */

export const OFFICIAL_SHORTCODE = {
  /** PTA — live network for ANY number. Rs ~2. */
  liveNetwork: '76367',
  /** PTA — how many SIMs sit on a CNIC. Rs ~2. */
  simOnCnic: '668',
  /** NADRA — verify a CNIC's name + address. Rs ~10. */
  cnicVerify: '7000',
  /** ECP+NADRA — voter registration check. */
  voter: '8300',
  /** PTA DIRBS — IMEI compliance. */
  imei: '8484',
} as const;

export const OFFICIAL_PORTAL = {
  cnicSimCount: 'https://cnic.sims.pk/',
  dirbs: 'https://dirbs.pta.gov.pk/',
  mtmisPunjab: 'https://mtmis.excise.punjab.gov.pk/',
  punjabLandRecords: 'https://punjab-zameen.gov.pk/',
  sindhLandRecords: 'https://sindhzameen.gos.pk/',
  punjabCourts: 'https://dsj.punjab.gov.pk/',
  secp: 'https://eservices.secp.gov.pk/eServices/NameSearch.jsp',
  fbrVerify: 'https://e.fbr.gov.pk/esbn/Verification',
  lescoBill: 'https://bill.pitc.com.pk/lescobill',
  ssgcBill: 'https://viewbill.ssgc.com.pk/web/',
  ptclDirectory: 'https://ptcl.com.pk/directory/index',
} as const;

/** `sms:76367?body=N%2003...` — works on Android and iOS. */
export function smsLink(target: string, body?: string): string {
  const t = String(target).replace(/[^\d+]/g, '');
  if (!body) return `sms:${t}`;
  return `sms:${t}?body=${encodeURIComponent(body)}`;
}

/** `tel:+923001234567` */
export function telLink(e164: string): string {
  const t = String(e164).trim().replace(/[^\d+]/g, '');
  return `tel:${t}`;
}

/** `https://wa.me/923001234567?text=...` */
export function waLink(e164: string, text?: string): string {
  const t = String(e164).trim().replace(/[^\d]/g, '');
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${t}${q}`;
}

function digitsOf(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

/** Live network check for ANY number — the only official thing a number yields. */
export function liveNetworkSmsLink(national: string): string | undefined {
  const d = digitsOf(national);
  if (d.length < 10) return undefined;
  const national11 = d.startsWith('0') ? d.slice(0, 11) : d.startsWith('92') ? `0${d.slice(2, 12)}` : `0${d.slice(0, 10)}`;
  if (!national11.startsWith('03') || national11.length !== 11) return undefined;
  return smsLink(OFFICIAL_SHORTCODE.liveNetwork, `N ${national11}`);
}

export function cnicSimCountSmsLink(cnic: string): string | undefined {
  const d = digitsOf(cnic);
  return d.length === 13 ? smsLink(OFFICIAL_SHORTCODE.simOnCnic, d) : undefined;
}

export function cnicVerifySmsLink(cnic: string): string | undefined {
  const d = digitsOf(cnic);
  return d.length === 13 ? smsLink(OFFICIAL_SHORTCODE.cnicVerify, d) : undefined;
}

export function voterSmsLink(cnic: string): string | undefined {
  const d = digitsOf(cnic);
  return d.length === 13 ? smsLink(OFFICIAL_SHORTCODE.voter, d) : undefined;
}

export function imeiSmsLink(imei: string): string | undefined {
  const d = digitsOf(imei);
  return d.length === 15 ? smsLink(OFFICIAL_SHORTCODE.imei, d) : undefined;
}

/** 3520212345671 → 35202-1234567-1 */
export function formatCnic(cnic: string): string {
  const d = digitsOf(cnic);
  if (d.length !== 13) return d;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

export function isCnic(value: unknown): boolean {
  const d = digitsOf(value);
  if (d.length !== 13) return false;
  if (/^(\d)\1{12}$/.test(d)) return false; // 1111111111111
  const first = d[0]!;
  return first >= '1' && first <= '7';
}
