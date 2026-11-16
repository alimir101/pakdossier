/**
 * Keyless provider: a public lookup page that carries line type, numbering area
 * and crowd report counters in its JSON-LD.
 *
 * Honest limits, encoded here rather than in prose:
 *  - `carrierKind: 'prefix'` — the carrier shown is prefix-derived, NOT live.
 *  - confidence 'low' — it is a community/aggregator page, not a registry.
 *  - the subscriber name is masked unless you are in their app.
 */
import type { Adapter, ProviderFields } from './contract.ts';
import { AdapterError, getText } from './contract.ts';

const LD_JSON = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

/** Pure parser so it can be fixture-tested without the network. */
export function parseWhoseno(html: string): ProviderFields {
  const ldDescriptions = [...html.matchAll(LD_JSON)]
    .map((m) => m[1] ?? '')
    .map((raw) => {
      try {
        const obj = JSON.parse(raw) as { description?: string; '@type'?: string };
        return obj.description ?? '';
      } catch {
        return '';
      }
    })
    .filter(Boolean)
    .join(' ');

  const text = `${ldDescriptions} ${stripTags(html)}`;

  const area = /(\d{3,5})\s+numbering area/i.exec(text)?.[1];
  const carrier = /linked to ([A-Za-z][A-Za-z .&]{1,24}?)(?:\s+with|\s*\.|,|\s+\d)/i.exec(text)?.[1]?.trim();
  const reports = Number(/(?:with|Read Reports \()\s*(\d+)\s*(?:comm|\))/i.exec(text)?.[1] ?? NaN);
  const safe = Number(/\bSafe\s+(\d{1,6})\b/i.exec(text)?.[1] ?? NaN);
  const spam = Number(/\bSpam\/Scam\s+(\d{1,6})\b/i.exec(text)?.[1] ?? NaN);

  const lineTypeRaw = /Line Type\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i.exec(text)?.[1]?.trim();

  if (!area && !lineTypeRaw && !carrier) {
    throw new AdapterError('parse', 'whoseno: koi pehchaan wala field nahi mila (page badal gaya?)');
  }

  const fields: ProviderFields = {
    note: 'Community page. Carrier prefix-based hai (live nahi). Naam masked hota hai.',
  };
  if (area) fields.numberingArea = area;
  if (carrier) fields.carrier = carrier;
  if (lineTypeRaw) fields.lineType = lineTypeRaw.toLowerCase();
  if (Number.isFinite(reports) && reports > 0) fields.reports = reports;
  if (Number.isFinite(safe) && safe >= 0) fields.safeReports = safe;
  if (Number.isFinite(spam) && spam >= 0) fields.spamReports = spam;

  const extra: Record<string, number> = {};
  if (Number.isFinite(safe) && Number.isFinite(spam) && safe + spam > 0) {
    extra.spamRatio = Math.round((spam / (safe + spam)) * 100);
  }
  if (Object.keys(extra).length) fields.extra = extra;

  return fields;
}

export const whoseno: Adapter = {
  id: 'whoseno',
  needsKey: false,
  carrierKind: 'prefix',
  confidence: 'low',
  async run(input, ctx) {
    const html = await getText(ctx, `https://www.whoseno.com/pk/${input.national}`);
    return parseWhoseno(html);
  },
};
