/**
 * The mirror throttles per network and tells us for how long. Rather than
 * forgetting that and hammering it again, we remember the window and count down.
 *
 * Pure so it is testable; the sidecar keeps the same numbers on its side to skip
 * pointless browser navigations.
 */
export interface ThrottleState {
  /** epoch ms when the mirror should answer again */
  until: number;
  /** what the mirror told us, in minutes */
  minutes: number;
}

export function throttleFrom(minutes: number, now: number): ThrottleState {
  return { until: now + minutes * 60_000, minutes };
}

/** whole minutes left, rounded up; 0 when the window has passed */
export function minutesLeft(state: ThrottleState, now: number): number {
  const ms = state.until - now;
  return ms <= 0 ? 0 : Math.ceil(ms / 60_000);
}

export function isOpen(state: ThrottleState | undefined, now: number): boolean {
  return !!state && state.until > now;
}

/** Short label for the UI; language-agnostic on purpose (numbers + unit). */
export function throttleLabel(minutes: number): string {
  return `~${minutes} min`;
}
