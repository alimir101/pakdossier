import { useEffect, useState } from 'preact/hooks';
import { t, type Lang } from '../i18n/strings';
import { minutesLeft, throttleFrom } from '../core/throttle';
import type { ProviderFailure } from '../worker/types';

/**
 * When the mirror tells us to wait, count it down instead of forgetting.
 * When it hits zero the panel refreshes itself once — no blind retry loops.
 */
export function ThrottleNote(props: { lang: Lang; failure?: ProviderFailure; onRetry: () => void }) {
  const tr = (k: string) => t(props.lang, k);
  const [now, setNow] = useState(() => Date.now());
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!props.failure?.retryAfterMinutes) return;
    const id = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(id);
  }, [props.failure?.retryAfterMinutes]);

  useEffect(() => {
    if (!props.failure?.retryAfterMinutes) {
      setArmed(false);
      return;
    }
    const left = minutesLeft(throttleFrom(props.failure.retryAfterMinutes, now), now);
    if (left === 0 && !armed) {
      setArmed(true);
      props.onRetry();
    }
  }, [now, props.failure?.retryAfterMinutes, armed]);

  if (!props.failure) return null;
  const left = props.failure.retryAfterMinutes
    ? minutesLeft(throttleFrom(props.failure.retryAfterMinutes, now), now)
    : 0;

  return (
    <div class="note warn">
      {tr('throttled')} — <strong>{left || props.failure.retryAfterMinutes}</strong> {tr('minutes')}
      {props.failure.detail ? <div class="dim small">{props.failure.detail}</div> : null}
    </div>
  );
}
