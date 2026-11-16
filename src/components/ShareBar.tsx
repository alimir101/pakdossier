import { useState } from 'preact/hooks';
import { buildShareSvg, buildShareText, type ShareData } from '../core/share';
import { t, type Lang } from '../i18n/strings';

/** Copy as text, or download a self-contained SVG card. No canvas, no deps. */
export function ShareBar(props: { lang: Lang; data: ShareData }) {
  const tr = (k: string) => t(props.lang, k);
  const [copied, setCopied] = useState(false);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(buildShareText(props.data, props.lang));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const svg = buildShareSvg(props.data);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `pakdossier-${props.data.national.replace(/\D/g, '')}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <div class="actions">
      <button class="btn small" onClick={copyText}>
        {copied ? tr('shared') : tr('shareText')}
      </button>
      <button class="btn small" onClick={download}>
        {tr('shareImage')}
      </button>
    </div>
  );
}
