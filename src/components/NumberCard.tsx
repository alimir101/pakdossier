import { useMemo, useState } from 'preact/hooks';
import { displayNational } from '../core/normalize';
import { analyseNumber } from '../core/analyse';
import { liveNetworkSmsLink, telLink, waLink } from '../core/formats';
import { t, type Lang } from '../i18n/strings';
import { Badge, Row } from './ui';

function formatAsYouType(value: string): string {
  const plus = value.trim().startsWith('+');
  const d = value.replace(/\D/g, '').slice(0, 15);
  if (plus) {
    if (d.length <= 2) return `+${d}`;
    return `+${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 12)}`.trim();
  }
  if (d.length <= 4) return d;
  return `${d.slice(0, 4)} ${d.slice(4, 11)}`.trim();
}

export function NumberCard(props: { lang: Lang; raw: string; onRaw: (v: string) => void }) {
  const lang = props.lang;
  const tr = (k: string) => t(lang, k);
  const [copied, setCopied] = useState(false);
  const raw = props.raw;
  const state = useMemo(() => analyseNumber(raw), [raw]);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  const liveLink = state.stage === 'ok' ? liveNetworkSmsLink(state.n.national ?? '') : undefined;

  return (
    <>
      <div class="card">
        <input
          class="input"
          inputMode="tel"
          autocomplete="tel"
          aria-label={tr('tabNumber')}
          placeholder={tr('placeholder')}
          value={raw}
          onInput={(e) => props.onRaw(formatAsYouType((e.target as HTMLInputElement).value))}
        />
        <div class="hints">
          <Badge tone="info">{tr('offline')}</Badge>
          {raw ? (
            <button class="link" onClick={() => props.onRaw('')}>
              {tr('clear')}
            </button>
          ) : null}
        </div>
      </div>

      {state.stage === 'empty' ? (
        <div class="card muted">{tr('emptyHint')}</div>
      ) : state.stage === 'bad' ? (
        <div class="card">
          <div class="bad-title">{tr('invalid')}</div>
          <Row label={tr('reason')}>
            <code>{state.n.reason}</code>
          </Row>
          {state.n.e164 ? <Row label={tr('e164')}>{state.n.e164}</Row> : null}
        </div>
      ) : (
        <div class="card">
          <div class="badges">
            {state.n.valid ? <Badge tone="ok">{tr('valid')}</Badge> : <Badge tone="warn">{tr('possibleOnly')}</Badge>}
            <Badge tone="muted">{state.n.kind}</Badge>
          </div>

          <Row label={tr('national')}>
            <strong>{displayNational(state.n)}</strong>
          </Row>
          <Row label={tr('e164')}>
            <code>{state.n.e164}</code>
          </Row>

          {state.n.kind === 'mobile' && state.info ? (
            <>
              <div class="divider" />
              <Row label={tr('operator')} hint={state.info.allocated ? tr('operatorNote') : undefined}>
                {state.info.allocated ? (
                  <>
                    <strong>{state.info.operator}</strong>
                    {state.info.brand ? <span class="dim"> · {state.info.brand}</span> : null}
                    {state.info.regionNote ? <div class="dim">{state.info.regionNote}</div> : null}
                  </>
                ) : (
                  <span class="warn">{tr('unallocated')}</span>
                )}
              </Row>
              {state.info.mnc ? <Row label="MNC">{state.info.mnc}</Row> : null}
              {state.info.allocation ? (
                <Row label={tr('allocation')}>
                  <Badge tone="muted">{state.info.allocation}</Badge>
                </Row>
              ) : null}
              {state.info.confidence ? (
                <Row label={tr('confidence')}>
                  <Badge tone={state.info.confidence === 'high' ? 'ok' : 'warn'}>{state.info.confidence}</Badge>
                </Row>
              ) : null}
              {state.info.note ? <div class="note">{state.info.note}</div> : null}
              {state.info.sources.length ? (
                <details class="sources">
                  <summary>
                    {tr('sources')} ({state.info.sources.length})
                  </summary>
                  <ul>
                    {state.info.sources.map((s) =>
                      s.startsWith('http') ? (
                        <li key={s}>
                          <a href={s} target="_blank" rel="noreferrer noopener">
                            {s}
                          </a>
                        </li>
                      ) : (
                        <li key={s}>{s}</li>
                      ),
                    )}
                  </ul>
                </details>
              ) : null}

              <div class="divider" />
              <div class="actions">
                {liveLink ? (
                  <a class="btn primary" href={liveLink}>
                    {tr('liveNetwork')}
                  </a>
                ) : null}
                <a class="btn" href={telLink(state.n.e164 ?? '')}>
                  {tr('call')}
                </a>
                <a class="btn" href={waLink(state.n.e164 ?? '')} target="_blank" rel="noreferrer noopener">
                  {tr('whatsapp')}
                </a>
                <button class="btn" onClick={() => copy(state.n.e164 ?? '')}>
                  {copied ? tr('copied') : tr('copy')}
                </button>
              </div>
              {liveLink ? <div class="hint">{tr('liveNetworkHint')}</div> : null}
            </>
          ) : state.n.kind !== 'mobile' ? (
            <div class="note">{tr('landlineNote')}</div>
          ) : null}
        </div>
      )}
    </>
  );
}
