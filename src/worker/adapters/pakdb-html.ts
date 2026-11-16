/**
 * Parser for a PakistanDatabase SIM/CNIC report.
 *
 * The report is whitespace-separated text, not a real table, so CNIC (a 13-digit
 * anchor) is what makes row splitting reliable. Input is HTML; tags are stripped
 * here so callers can hand over a raw response.
 *
 * Real observed row:
 *   923451234567 SYED NAJAF ALI 4220106671817 PLOT 7 ZIA ALHAQ COLONY AQAB IMAM BAARGAH GULSHAN
 */

export interface PakdbRecord {
  mobile: string;
  name: string;
  cnic: string;
  address: string;
}

export interface PakdbReport {
  notFound: boolean;
  totalHits: number;
  records: PakdbRecord[];
  ref?: string;
  /** the mirror throttles per network; minutes until it will answer again */
  rateLimitedMinutes?: number;
}

const MOBILE = '92\\d{10}';
const CNIC = '\\d{13}';

function strip(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Row extraction that does not care about column order.
 *
 * Each record contributes exactly two anchors (a 92-mobile and a 13-digit CNIC),
 * and records never interleave, so pairing the anchors in index order is both
 * simple and correct. Text between the pair is the name; text after it is the
 * address. The CNIC is the only reliable anchor in this whitespace soup.
 */
function extractRecords(body: string): PakdbRecord[] {
  const anchors: Array<{ kind: 'mobile' | 'cnic'; value: string; index: number }> = [];
  for (const m of body.matchAll(new RegExp(MOBILE, 'g'))) {
    anchors.push({ kind: 'mobile', value: m[0], index: m.index });
  }
  for (const m of body.matchAll(new RegExp(CNIC, 'g'))) {
    anchors.push({ kind: 'cnic', value: m[0], index: m.index });
  }
  anchors.sort((a, b) => a.index - b.index);

  const records: PakdbRecord[] = [];
  for (let i = 0; i + 1 < anchors.length; i += 2) {
    const a = anchors[i]!;
    const b = anchors[i + 1]!;
    if (a.kind === b.kind) continue; // unpaired duplicate anchor
    const first = Math.min(a.index, b.index);
    const last = Math.max(a.index, b.index);
    // the address must stop where the next record's first anchor begins
    const nextStart = anchors[i + 2]?.index ?? body.length;
    const name = body.slice(first + (a.index < b.index ? a.value.length : b.value.length), last).trim();
    const address = body
      .slice(last + (a.index < b.index ? b.value.length : a.value.length), nextStart)
      .trim();
    if (!name) continue;
    const mobile = a.kind === 'mobile' ? a.value : b.value;
    const cnic = a.kind === 'cnic' ? a.value : b.value;
    records.push({ mobile, name, cnic, address });
  }
  return records;
}

export function parsePakdbReport(html: string): PakdbReport {
  const text = strip(html);
  const empty: PakdbReport = { notFound: true, totalHits: 0, records: [] };

  if (/VERIFICATION FAILED/i.test(text)) {
    return { ...empty, notFound: true };
  }

  // Observed after ~15 searches from one IP: "TOO MANY SEARCHES from your
  // network — try again in 49 minutes." This is not a report, and it must not be
  // mistaken for "no records".
  const limited = /TOO MANY SEARCHES[^.]*?try again in (\d+)\s*minutes?/i.exec(text);
  if (limited) {
    return { ...empty, notFound: true, rateLimitedMinutes: Number(limited[1]) };
  }

  const ref = /REF\s*\/\/\s*([A-Za-z0-9-]+)/.exec(text)?.[1];
  const totalHits = Number(/TOTAL HITS\s*(\d+)/i.exec(text)?.[1] ?? NaN);

  if (/NO RECORDS/i.test(text)) {
    return { notFound: true, totalHits: 0, records: [], ...(ref ? { ref } : {}) };
  }

  // Only parse after the "N RECORD(S) FOUND" marker. The column-header line that
  // follows is skipped token-wise, so a CNIC search (where column order may
  // differ) parses with the same code.
  const found = /(?:RECORD|RECORDS) FOUND/i.exec(text);
  if (!found) return { ...empty, ...(ref ? { ref } : {}), ...(Number.isFinite(totalHits) ? { totalHits } : {}) };

  const body = text
    .slice(found.index + found[0].length)
    .replace(/^(?:\s*(?:Mobile|Name|CNIC|Address|Mobile No|Father|Husband)\s*)+/i, ' ')
    .replace(/\s*REF\s*\/\/[\s\S]*$/, '')
    .trim();

  const records = extractRecords(body);

  return {
    notFound: records.length === 0,
    totalHits: Number.isFinite(totalHits) ? totalHits : records.length,
    records,
    ...(ref ? { ref } : {}),
  };
}
