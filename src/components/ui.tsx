import type { ComponentChildren } from 'preact';

export function Badge(props: { tone: 'ok' | 'warn' | 'info' | 'muted'; children: ComponentChildren }) {
  return <span class={`badge badge-${props.tone}`}>{props.children}</span>;
}

export function Row(props: { label: string; children: ComponentChildren; hint?: string }) {
  return (
    <div class="row">
      <div class="row-label">{props.label}</div>
      <div class="row-value">{props.children}</div>
      {props.hint ? <div class="row-hint">{props.hint}</div> : null}
    </div>
  );
}

export function Meta(props: { items: Array<{ label: string; value: string; tone?: 'warn' }> }) {
  return (
    <div class="meta">
      {props.items.map((it) => (
        <span class={it.tone === 'warn' ? 'meta-item warn' : 'meta-item'} key={it.label + it.value}>
          <span class="meta-label">{it.label}</span> {it.value}
        </span>
      ))}
    </div>
  );
}
