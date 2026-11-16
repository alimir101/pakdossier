import {
  cnicSimCountSmsLink,
  cnicVerifySmsLink,
  formatCnic,
  isCnic,
  telLink,
  voterSmsLink,
} from '../core/formats';
import type { CnicLookupState } from '../hooks/useCnicLookup';
import { t, type Lang } from '../i18n/strings';
import { Badge } from './ui';

/**
 * CNIC mode. NADRA's data is CNIC-keyed, not number-keyed, so this is the mode
 * that actually unlocks the official checks — and the same CNIC can be reversed
 * into the numbers registered on it.
 */
export function CnicCard(props: {
  lang: Lang;
  cnic: string;
  onCnic: (v: string) => void;
  lookup: CnicLookupState;
  onRefresh: () => void;
}) {
  const lang = props.lang;
  const tr = (k: string) => t(lang, k);
  const cnic = props.cnic;
  const valid = isCnic(cnic);

  const actions = [
    { id: '7000', label: 'NADRA verify (naam + pata)', href: cnicVerifySmsLink(cnic), cost: 'Rs ~10' },
    { id: '668', label: 'PTA — CNIC par kitni SIM', href: cnicSimCountSmsLink(cnic), cost: 'Rs ~2' },
    { id: '8300', label: 'ECP — voter registration', href: voterSmsLink(cnic), cost: 'Rs ~2' },
  ];

  return (
    <>
      <div class="card">
        <input
          class="input"
          inputMode="numeric"
          aria-label={tr('tabCnic')}
          placeholder={tr('cnicPlaceholder')}
          value={cnic}
          onInput={(e) => {
            const d = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 13);
            props.onCnic(d.length === 13 ? formatCnic(d) : d);
          }}
        />
        <div class="hints">
          {cnic ? (
            valid ? (
              <Badge tone="ok">{tr('cnicOk')}</Badge>
            ) : (
              <Badge tone="warn">{tr('cnicInvalid')}</Badge>
            )
          ) : (
            <span class="dim">{tr('cnicEmpty')}</span>
          )}
          {cnic ? (
            <button class="link" onClick={() => props.onCnic('')}>
              {tr('clear')}
            </button>
          ) : null}
        </div>
        {valid ? <div class="hint">{tr('cnicHint')}</div> : null}
      </div>

      {valid ? (
        <div class="card">
          <h2 class="section-title">{tr('quickActions')}</h2>
          <div class="quick">
            {actions.map((a) => (
              <a class="pill" href={a.href ?? '#'} key={a.id}>
                <strong>{a.label}</strong>
                <span class="dim small">{a.cost}</span>
              </a>
            ))}
          </div>
          <div class="hint">SMS {actions.map((a) => a.id).join(' / ')}</div>
        </div>
      ) : null}

      {valid ? (
        <div class="card">
          <div class="section-head">
            <h2 class="section-title">{tr('cnicNumbers')}</h2>
            <div class="counters">
              {props.lookup.state === 'ok' ? (
                <Badge tone="ok">{props.lookup.data.records.length}</Badge>
              ) : null}
              <button class="link" onClick={props.onRefresh}>
                {tr('refresh')}
              </button>
            </div>
          </div>

          {props.lookup.state === 'loading' ? <div class="note">{tr('cnicLoading')}</div> : null}
          {props.lookup.state === 'error' ? (
            <div class="note warn">
              {tr('liveError')}: {props.lookup.message}
            </div>
          ) : null}
          {props.lookup.state === 'empty' ? (
            <div class="note">
              {props.lookup.message === 'no-sidecar'
                ? tr('cnicSidecarOff')
                : props.lookup.rateLimitedMinutes
                  ? `${tr('cnicThrottled')} (${props.lookup.rateLimitedMinutes} min)`
                  : tr('cnicNumbersEmpty')}
            </div>
          ) : null}

          {props.lookup.state === 'ok'
            ? props.lookup.data.records.map((rec, i) => (
                <div class="record" key={`${rec.mobile}-${i}`}>
                  <div class="record-name">
                    <a href={telLink(`+${rec.mobile}`)}>{props.lang === 'ur' ? rec.mobile : `+${rec.mobile}`}</a>
                    <span class="dim"> {rec.name}</span>
                  </div>
                  <div class="record-line">{rec.address}</div>
                </div>
              ))
            : null}
          {props.lookup.state === 'ok' && props.lookup.data.rateLimitedMinutes ? (
            <div class="hint">
              {tr('cnicThrottled')} ({props.lookup.data.rateLimitedMinutes} min)
            </div>
          ) : null}
          <p class="hint">{tr('cnicNumbersNote')}</p>
        </div>
      ) : null}
    </>
  );
}
