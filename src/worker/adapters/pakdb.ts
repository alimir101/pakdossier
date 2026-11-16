/**
 * Owner-name provider. This is the one that answers the actual question
 * ("kis ke naam hai") — name, CNIC and registered address.
 *
 * It cannot run on Cloudflare itself: the search is behind a Turnstile widget
 * whose sitekey is domain-locked to their host, so a sidecar with a real browser
 * mints the token. The sidecar returns HTML; parsing stays here.
 */
import type { Adapter, ProviderFields } from './contract.ts';
import { AdapterError, getJson } from './contract.ts';
import { parsePakdbReport } from './pakdb-html.ts';

interface SidecarResponse {
  ok: boolean;
  reason?: string;
  detail?: string;
  html?: string;
  attempts?: number;
  ms?: number;
}

export const pakdb: Adapter = {
  id: 'pakdb',
  needsKey: false,
  requiresEnv: 'PAKDB_BROWSER_URL',
  carrierKind: 'prefix',
  confidence: 'medium',
  // a real browser, and this site's widget needs ~90s before it gives a token
  timeoutMsMin: 120_000,

  async run(input, ctx) {
    const base = (ctx.env?.PAKDB_BROWSER_URL ?? '').replace(/\/$/, '');
    if (!base) throw new AdapterError('no-key', 'PAKDB_BROWSER_URL set nahi hai (sidecar band hai)');

    const data = (await getJson(
      ctx,
      `${base}/pakdb?number=${encodeURIComponent(input.national)}${ctx.fresh ? '&fresh=1' : ''}`,
    )) as SidecarResponse;
    if (!data.ok || !data.html) {
      const reason = data.reason === 'bad-number' ? 'not-found' : 'http';
      throw new AdapterError(reason, `sidecar: ${data.reason ?? 'no html'}${data.detail ? ` — ${data.detail}` : ''}`);
    }

    const report = parsePakdbReport(data.html);

    if (report.rateLimitedMinutes) {
      throw new AdapterError(
        'rate-limited',
        `mirror ne throttle kiya — ${report.rateLimitedMinutes} min baad try karein`,
        report.rateLimitedMinutes,
      );
    }
    if (report.notFound || report.records.length === 0) {
      throw new AdapterError('not-found', `koi record nahi (hits=0${report.ref ? `, ref ${report.ref}` : ''})`);
    }

    const first = report.records[0]!;
    const fields: ProviderFields = {
      records: report.records,
      totalHits: report.totalHits,
      note: 'Leaked/public mirror. Naam + CNIC + registered pata — official NADRA record nahi, is liye stale ho sakta hai.',
      extra: {
        attempts: data.attempts ?? 0,
        sidecarMs: data.ms ?? 0,
        ...(report.ref ? { ref: report.ref } : {}),
      },
    };
    if (first.name) fields.extra!.ownerName = first.name;
    if (first.cnic) fields.extra!.cnic = first.cnic;
    if (first.address) fields.location = first.address;
    return fields;
  },
};
