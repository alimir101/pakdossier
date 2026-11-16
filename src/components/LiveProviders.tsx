import { t, type Lang } from '../i18n/strings';
import type { LookupState } from '../hooks/useLookup';
import { Badge, Meta } from './ui';
import { ThrottleNote } from './ThrottleNote';

/**
 * Live providers panel. Presentational: the request is owned by useLookup so the
 * CNIC-unlock logic can read the same result.
 *
 * Deliberately shows the *skipped* providers too, so the user learns why nothing
 * better came back (usually: no free API key yet, or the mirror throttling).
 */
export function LiveProviders(props: { lang: Lang; national?: string; state: LookupState; onRefresh: () => void }) {
  const lang = props.lang;
  const tr = (k: string) => t(lang, k);
  const state = props.state;
  const national = props.national;

  const skipped = state.state === 'ok' ? state.data.partial : state.state === 'empty' ? state.partial : [];
  /** the mirror's own "come back in N minutes" instruction, if it gave one */
  const throttle = skipped.find((p) => p.reason === 'rate-limited');

  return (
    <section class="card">
      <div class="section-head">
        <div>
          <h2 class="section-title">{tr('liveTitle')}</h2>
          <p class="section-sub">{tr('liveHint')}</p>
        </div>
        {national ? (
          <div class="counters">
            <button class="link" onClick={props.onRefresh}>
              {tr('refresh')}
            </button>
          </div>
        ) : null}
      </div>

      {state.state === 'idle' ? <div class="note">{tr('liveIdle')}</div> : null}
      {state.state === 'loading' ? <div class="note">{tr('liveLoading')}</div> : null}
      <ThrottleNote lang={lang} failure={throttle} onRetry={props.onRefresh} />
      {state.state === 'error' ? (
        <div class="note warn">
          {tr('liveError')}: {state.message}
        </div>
      ) : null}
      {state.state === 'empty' ? <div class="note">{tr('liveEmpty')}</div> : null}

      {state.state === 'ok'
        ? state.data.results.map((r) => {
            const f = r.fields;
            const items: Array<{ label: string; value: string; tone?: 'warn' }> = [];
            if (f.carrier) items.push({ label: tr('carrier'), value: f.carrier });
            if (f.lineType) items.push({ label: tr('lineType'), value: f.lineType });
            if (f.location) items.push({ label: tr('location'), value: f.location });
            if (f.numberingArea) items.push({ label: tr('area'), value: f.numberingArea });
            if (typeof f.safeReports === 'number') items.push({ label: tr('safe'), value: String(f.safeReports) });
            if (typeof f.spamReports === 'number') items.push({ label: tr('spam'), value: String(f.spamReports) });
            if (f.extra?.spamRatio !== undefined) items.push({ label: tr('spamRatio'), value: `${f.extra.spamRatio}%` });
            if (typeof f.valid === 'boolean') items.push({ label: tr('validLabel'), value: f.valid ? 'yes' : 'no' });
            if (typeof f.active === 'boolean') items.push({ label: tr('active'), value: f.active ? 'yes' : 'no' });
            items.push({ label: 'ms', value: String(r.latencyMs) });

            return (
              <article class="pentry" key={r.provider}>
                <div class="pentry-head">
                  <strong>{r.provider}</strong>
                  <Badge tone={r.confidence === 'high' ? 'ok' : 'warn'}>{r.confidence}</Badge>
                  <Badge tone={r.carrierKind === 'live' ? 'ok' : 'muted'}>
                    {r.carrierKind === 'live' ? tr('liveKind') : tr('prefixKind')}
                  </Badge>
                </div>
                <Meta items={items} />
                {f.records?.length ? (
                  <div class="records">
                    {f.records.map((rec, i) => (
                      <div class="record" key={`${rec.cnic}-${i}`}>
                        <div class="record-name">
                          <strong>{rec.name}</strong>
                          {f.records!.length > 1 ? <span class="dim"> #{i + 1}</span> : null}
                        </div>
                        <div class="record-line">
                          <span class="dim">CNIC</span> <code>{rec.cnic}</code>
                        </div>
                        <div class="record-line">{rec.address}</div>
                      </div>
                    ))}
                    {f.totalHits && f.totalHits > f.records.length ? (
                      <div class="hint">
                        {f.totalHits} hits, {f.records.length} dikhaye
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {f.note ? <p class="dim small">{f.note}</p> : null}
              </article>
            );
          })
        : null}

      {skipped.length ? (
        <details class="sources">
          <summary>
            {tr('liveSkipped')} ({skipped.length})
          </summary>
          <ul>
            {skipped.map((p) => (
              <li key={p.provider}>
                <code>{p.provider}</code> — <span class="warn">{p.reason}</span>
                {p.detail ? <span class="dim"> · {p.detail}</span> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p class="hint">{tr('liveNote')}</p>
    </section>
  );
}
