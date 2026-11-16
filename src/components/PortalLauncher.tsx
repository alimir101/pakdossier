import { groupPortals, portalStats, type PortalCtx } from '../core/portals';
import { loc, t, type Lang } from '../i18n/strings';
import { Badge, Meta } from './ui';

/**
 * The launcher. It is deliberately honest: every row states what the portal
 * gives, what it costs, what it needs, and when we last verified it. Entries
 * whose input the user has not supplied are shown but disabled.
 */
export function PortalLauncher(props: {
  lang: Lang;
  ctx: PortalCtx;
  readyOnly: boolean;
  onToggleReadyOnly: (v: boolean) => void;
}) {
  const lang = props.lang;
  const tr = (k: string) => t(lang, k);
  const readyOnly = props.readyOnly;
  const groups = groupPortals(props.ctx, { readyOnly });
  const stats = portalStats(props.ctx);

  return (
    <section class="card">
      <div class="section-head">
        <div>
          <h2 class="section-title">{tr('officialPortals')}</h2>
          <p class="section-sub">{tr('officialPortalsHint')}</p>
        </div>
        <div class="counters">
          <Badge tone={stats.ready ? 'ok' : 'muted'}>
            {stats.ready}/{stats.total} {tr('ready')}
          </Badge>
          <button
            class="link"
            onClick={() => props.onToggleReadyOnly(!readyOnly)}
            title={readyOnly ? tr('showAll') : tr('showReady')}
          >
            {readyOnly ? tr('showAll') : tr('showReady')}
          </button>
        </div>
      </div>

      {groups.length === 0 ? <div class="note">{tr('noneReady')}</div> : null}

      {groups.map((group) => (
        <div class="pgroup" key={group.id}>
          <h3 class="pgroup-title">{loc(lang, group.label)}</h3>
          {group.entries.map(({ entry, action }) => (
            <article class={action.ready ? 'pentry' : 'pentry disabled'} key={entry.id}>
              <div class="pentry-head">
                <strong>{loc(lang, entry.label)}</strong>
                {entry.official ? <Badge tone="info">{tr('official')}</Badge> : null}
              </div>
              <p class="pentry-gives">{loc(lang, entry.gives)}</p>
              <Meta
                items={[
                  { label: tr('cost'), value: entry.cost, tone: /free/i.test(entry.cost) ? undefined : 'warn' },
                  { label: '', value: loc(lang, entry.friction) },
                  ...(entry.verifiedOn ? [{ label: tr('verified'), value: entry.verifiedOn }] : []),
                  ...(action.ready ? [] : [{ label: tr('needs'), value: action.missing.join(', '), tone: 'warn' as const }]),
                ]}
              />
              {action.ready ? (
                <a
                  class="btn small"
                  href={action.href}
                  target={entry.kind === 'url' ? '_blank' : undefined}
                  rel="noreferrer noopener"
                >
                  {entry.kind === 'sms' ? tr('sendSms') : tr('open')}
                </a>
              ) : (
                <button class="btn small" disabled>
                  {entry.kind === 'sms' ? tr('sendSms') : tr('open')}
                </button>
              )}
            </article>
          ))}
        </div>
      ))}

      <p class="hint">{tr('portalNote')}</p>
    </section>
  );
}
