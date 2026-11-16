import { useEffect, useMemo, useState } from 'preact/hooks';
import { analyseNumber } from './core/analyse';
import { buildPortalCtx } from './core/ctx';
import { discoverOwner } from './core/discover';
import { isCnic } from './core/formats';
import { addHistory, clearHistory, loadHistory, type HistoryEntry, type StorageLike } from './core/history';
import { portalStats } from './core/portals';
import { useLookup } from './hooks/useLookup';
import { useCnicLookup } from './hooks/useCnicLookup';
import { t, type Lang } from './i18n/strings';
import { NumberCard } from './components/NumberCard';
import { CnicCard } from './components/CnicCard';
import { PortalLauncher } from './components/PortalLauncher';
import { LiveProviders } from './components/LiveProviders';
import { History } from './components/History';
import { ShareBar } from './components/ShareBar';
import { Badge } from './components/ui';

type Mode = 'number' | 'cnic';

const storage: StorageLike | undefined = typeof localStorage === 'undefined' ? undefined : localStorage;

export function App() {
  const [lang, setLang] = useState<Lang>('ur');
  const [mode, setMode] = useState<Mode>('number');
  const [raw, setRaw] = useState('');
  const [cnicTyped, setCnicTyped] = useState('');
  const [ignoreDiscovered, setIgnoreDiscovered] = useState(false);
  const [readyOnly, setReadyOnly] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory(storage));
  const [now] = useState(() => Date.now());

  const tr = (k: string) => t(lang, k);

  const analysis = useMemo(() => analyseNumber(raw), [raw]);
  const national = analysis.stage === 'ok' && analysis.n.kind === 'mobile' ? analysis.n.national : undefined;
  const operator = analysis.stage === 'ok' && analysis.info?.allocated ? analysis.info.operator : undefined;

  const { state, refresh } = useLookup(national);

  /**
   * The point of the whole app: a mirror gives us a CNIC, and that CNIC unlocks
   * every official portal. Never silently — it is shown, and can be dismissed.
   */
  const finding = useMemo(() => discoverOwner(state), [state]);
  const discoveredCnic = !ignoreDiscovered && finding ? finding.cnic : undefined;

  const { ctx, cnicSource } = useMemo(
    () => buildPortalCtx({ national, cnicTyped, discoveredCnic, ignoreDiscovered }),
    [national, cnicTyped, discoveredCnic, ignoreDiscovered],
  );

  // Reverse lookup runs on the CNIC tab only (that is the explicit intent), and
  // for whichever CNIC is currently in play.
  const cnicInPlay = isCnic(cnicTyped) ? cnicTyped : (discoveredCnic ?? '');
  const { state: cnicLookup, refresh: refreshCnic } = useCnicLookup(mode === 'cnic' ? cnicInPlay : '');

  const readyCount = useMemo(() => portalStats(ctx).ready, [ctx]);

  // Record history once per resolved number (deduped by e164 inside addHistory).
  useEffect(() => {
    if (analysis.stage !== 'ok' || !analysis.n.e164 || analysis.n.kind !== 'mobile') return;
    setHistory(
      addHistory(storage, {
        national: analysis.n.national ?? analysis.n.e164,
        e164: analysis.n.e164,
        kind: analysis.n.kind,
        ...(operator ? { operator } : {}),
        ...(finding?.name ? { owner: finding.name } : {}),
        ...(finding?.cnic ? { cnic: finding.cnic } : {}),
        ...(finding?.cnic ? { source: 'mirror' as const } : {}),
        at: Date.now(),
      }),
    );
  }, [analysis, operator, finding]);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  const showChip = !!finding && cnicSource === 'mirror' && mode === 'number';

  return (
    <div class="wrap">
      <header class="head">
        <div>
          <h1>{tr('appName')}</h1>
          <p class="tag">{tr('tagline')}</p>
        </div>
        <div class="lang">
          <button class={lang === 'ur' ? 'on' : ''} onClick={() => setLang('ur')}>
            Roman Urdu
          </button>
          <button class={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
            English
          </button>
        </div>
      </header>

      <div class="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={mode === 'number'}
          class={mode === 'number' ? 'tab on' : 'tab'}
          onClick={() => setMode('number')}
        >
          {tr('tabNumber')}
        </button>
        <button
          role="tab"
          aria-selected={mode === 'cnic'}
          class={mode === 'cnic' ? 'tab on' : 'tab'}
          onClick={() => setMode('cnic')}
        >
          {tr('tabCnic')}
        </button>
      </div>

      {mode === 'number' ? (
        <>
          <NumberCard lang={lang} raw={raw} onRaw={setRaw} />
          <LiveProviders lang={lang} national={national} state={state} onRefresh={refresh} />
        </>
      ) : (
        <CnicCard lang={lang} cnic={cnicTyped} onCnic={setCnicTyped} lookup={cnicLookup} onRefresh={refreshCnic} />
      )}

      {showChip && finding ? (
        <section class="card discovered">
          <div class="pentry-head">
            <strong>{tr('cnicFound')}</strong>
            <code>{finding.cnic}</code>
            <Badge tone="muted">{finding.provider}</Badge>
            <Badge tone="warn">{finding.confidence}</Badge>
          </div>
          {finding.name ? <div class="record-name">{finding.name}</div> : null}
          {finding.address ? <div class="dim small">{finding.address}</div> : null}
          <p class="hint">{tr('cnicFoundNote')}</p>
          <div class="actions">
            <button class="btn small" onClick={() => copy(finding.cnic)}>
              {copied ? tr('copied') : tr('copy')}
            </button>
            <button
              class="btn small"
              onClick={() => {
                setCnicTyped(finding.cnic);
                setMode('cnic');
              }}
            >
              {tr('useCnic')}
            </button>
            <button class="btn small" onClick={() => setIgnoreDiscovered(true)}>
              {tr('dismiss')}
            </button>
          </div>
        </section>
      ) : null}

      {analysis.stage === 'ok' && analysis.n.e164 ? (
        <section class="card">
          <div class="section-head">
            <h2 class="section-title">{tr('share')}</h2>
            <Badge tone="info">{tr('offlineReady')}</Badge>
          </div>
          <ShareBar
            lang={lang}
            data={{
              national: analysis.n.national ?? analysis.n.e164,
              e164: analysis.n.e164,
              kind: analysis.n.kind,
              ...(operator ? { operator } : {}),
              ...(finding?.name ? { ownerName: finding.name } : {}),
              ...(finding?.cnic ? { cnic: finding.cnic, cnicFromMirror: cnicSource === 'mirror' } : {}),
              ...(finding?.address ? { address: finding.address } : {}),
              portalCount: readyCount,
            }}
          />
        </section>
      ) : null}

      <PortalLauncher lang={lang} ctx={ctx} readyOnly={readyOnly} onToggleReadyOnly={setReadyOnly} />

      <History
        lang={lang}
        entries={history}
        now={now}
        onPick={(e164) => {
          setRaw(e164);
          setMode('number');
        }}
        onClear={() => setHistory(clearHistory(storage))}
      />

      <footer class="foot">
        <p>{tr('disclaimer')}</p>
        <p class="dim small">{tr('next')}</p>
      </footer>
    </div>
  );
}
