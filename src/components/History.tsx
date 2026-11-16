import { t, type Lang } from '../i18n/strings';
import type { HistoryEntry } from '../core/history';
import { relativeAge } from '../core/history';

export function History(props: {
  lang: Lang;
  entries: HistoryEntry[];
  now: number;
  onPick: (e164: string) => void;
  onClear: () => void;
}) {
  const tr = (k: string) => t(props.lang, k);
  if (props.entries.length === 0) {
    return (
      <section class="card">
        <h2 class="section-title">{tr('history')}</h2>
        <div class="note">{tr('historyEmpty')}</div>
      </section>
    );
  }

  return (
    <section class="card">
      <div class="section-head">
        <h2 class="section-title">{tr('history')}</h2>
        <div class="counters">
          <span class="badge badge-muted">{props.entries.length}</span>
          <button class="link" onClick={props.onClear}>
            {tr('historyClear')}
          </button>
        </div>
      </div>
      <ul class="hist">
        {props.entries.map((e) => (
          <li key={e.e164}>
            <button class="hist-item" onClick={() => props.onPick(e.e164)}>
              <span class="hist-num">{e.national}</span>
              <span class="dim small">
                {[e.operator, e.owner, e.cnic].filter(Boolean).join(' · ') || e.kind}
              </span>
              <span class="hist-age dim">{relativeAge(e, props.now)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p class="hint">{tr('historyNote')}</p>
    </section>
  );
}
