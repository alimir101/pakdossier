/**
 * Official portal catalogue: load, validate, and turn each entry into a
 * one-tap action for the user's own phone.
 *
 * The app does NOT scrape these portals in this phase — it launches them, and
 * says honestly what the user must bring (cost / friction / required input).
 */
import raw from '../data/portals.json';
import { isCnic, smsLink } from './formats';

export type PortalKind = 'url' | 'sms';

export interface Localized {
  ur: string;
  en: string;
}

export interface PortalEntry {
  id: string;
  category: string;
  kind: PortalKind;
  url?: string;
  target?: string;
  bodyTemplate?: string;
  requires: string[];
  label: Localized;
  gives: Localized;
  cost: string;
  friction: Localized;
  official?: boolean;
  verifiedOn?: string;
}

interface PortalFile {
  verifiedOn: string;
  note: string;
  categories: Array<{ id: string; label: Localized }>;
  entries: PortalEntry[];
}

export const portalFile = raw as unknown as PortalFile;

/** What the app can already know about the user's target. */
export interface PortalCtx {
  national?: string;
  cnic?: string;
  imei?: string;
  trackingId?: string;
}

export const CTX_KEYS = ['national', 'cnic', 'imei', 'trackingId'] as const;
export type CtxKey = (typeof CTX_KEYS)[number];

const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');

/**
 * Canonical 11-digit national mobile form (03XXXXXXXXX) from whatever the
 * caller holds — national, E.164 or bare significant digits.
 */
export function national11(v: unknown): string | undefined {
  const d = digits(v);
  let n: string | undefined;
  if (d.length === 11 && d.startsWith('0')) n = d;
  else if (d.length === 12 && d.startsWith('92')) n = `0${d.slice(2)}`;
  else if (d.length === 10 && d.startsWith('3')) n = `0${d}`;
  return n && n.length === 11 && n.startsWith('03') ? n : undefined;
}

function isPresent(key: string, ctx: PortalCtx): boolean {
  switch (key) {
    case 'national':
      return national11(ctx.national) !== undefined;
    case 'cnic':
      return isCnic(ctx.cnic);
    case 'imei':
      return digits(ctx.imei).length === 15;
    case 'trackingId':
      return String(ctx.trackingId ?? '').trim().length >= 6;
    default:
      return false;
  }
}

export interface PortalAction {
  ready: boolean;
  href?: string;
  /** context keys this entry needs and the user has not supplied */
  missing: string[];
}

/** Build the launch action for one entry, given what we know. */
export function buildAction(entry: PortalEntry, ctx: PortalCtx): PortalAction {
  const missing = entry.requires.filter((k) => !isPresent(k, ctx));
  if (missing.length) return { ready: false, missing };

  if (entry.kind === 'sms') {
    const template = entry.bodyTemplate ?? '';
    const body = template.replace(/\{(\w+)\}/g, (_m, key: string) => {
      if (key === 'national') return national11(ctx.national) ?? digits(ctx.national);
      const v = (ctx as Record<string, unknown>)[key];
      return String(v ?? '');
    });
    return { ready: true, href: smsLink(entry.target ?? '', body.trim()), missing: [] };
  }

  const url = (entry.url ?? '').replace(/\{(\w+)\}/g, (_m, key: string) => String((ctx as Record<string, unknown>)[key] ?? ''));
  return { ready: true, href: url, missing: [] };
}

export interface PortalGroup {
  id: string;
  label: Localized;
  entries: Array<{ entry: PortalEntry; action: PortalAction }>;
}

/**
 * Group every entry by category. `readyOnly` filters to launchable ones —
 * used so the UI can lead with what actually works right now.
 */
export function groupPortals(ctx: PortalCtx, opts: { readyOnly?: boolean } = {}): PortalGroup[] {
  return portalFile.categories
    .map((cat) => {
      const entries = portalFile.entries
        .filter((e) => e.category === cat.id)
        .map((entry) => ({ entry, action: buildAction(entry, ctx) }))
        .filter((row) => (opts.readyOnly ? row.action.ready : true));
      return { id: cat.id, label: cat.label, entries };
    })
    .filter((g) => g.entries.length > 0);
}

/** How many entries can be launched right now, and how many exist. */
export function portalStats(ctx: PortalCtx): { ready: number; total: number } {
  const all = portalFile.entries.map((e) => buildAction(e, ctx));
  return { ready: all.filter((a) => a.ready).length, total: all.length };
}

/** Data-integrity guard, run in tests. */
export function validatePortals(): string[] {
  const issues: string[] = [];
  const catIds = new Set(portalFile.categories.map((c) => c.id));
  const seenIds = new Set<string>();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(portalFile.verifiedOn)) issues.push('verifiedOn ISO date nahi hai');

  for (const e of portalFile.entries) {
    const where = `${e.id}`;
    if (seenIds.has(e.id)) issues.push(`duplicate id: ${e.id}`);
    seenIds.add(e.id);
    if (!catIds.has(e.category)) issues.push(`unknown category "${e.category}" in ${where}`);
    if (e.kind === 'url' && !/^https:\/\//.test(e.url ?? '')) issues.push(`url https nahi: ${where}`);
    if (e.kind === 'sms') {
      if (!/^\d{3,6}$/.test(e.target ?? '')) issues.push(`sms target digits nahi: ${where}`);
      if (!e.bodyTemplate || !e.bodyTemplate.trim()) issues.push(`sms bodyTemplate khali: ${where}`);
    }
    if (e.kind === 'sms' && e.url) issues.push(`sms entry par url bhi hai: ${where}`);
    if (!e.requires) issues.push(`requires missing: ${where}`);
    for (const k of e.requires ?? []) {
      if (!(CTX_KEYS as readonly string[]).includes(k)) issues.push(`unknown requires key "${k}" in ${where}`);
    }
    for (const f of ['label', 'gives', 'friction'] as const) {
      const loc = e[f];
      if (!loc?.ur?.trim() || !loc?.en?.trim()) issues.push(`${f} bilingual nahi: ${where}`);
    }
    if (!e.cost?.trim()) issues.push(`cost khali: ${where}`);
  }
  return issues;
}
