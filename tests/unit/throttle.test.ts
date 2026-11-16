import { describe, expect, it } from 'vitest';
import { isOpen, minutesLeft, throttleFrom, throttleLabel } from '../../src/core/throttle';

const T0 = 1_700_000_000_000;

describe('throttle window', () => {
  it('turns the mirror\'s minutes into an expiry', () => {
    const s = throttleFrom(30, T0);
    expect(s.until).toBe(T0 + 30 * 60_000);
    expect(s.minutes).toBe(30);
  });

  it('counts down and rounds up, then hits zero', () => {
    const s = throttleFrom(10, T0);
    expect(minutesLeft(s, T0)).toBe(10);
    expect(minutesLeft(s, T0 + 9.5 * 60_000)).toBe(1);
    expect(minutesLeft(s, T0 + 10 * 60_000)).toBe(0);
    expect(minutesLeft(s, T0 + 99 * 60_000)).toBe(0);
  });

  it('never goes negative', () => {
    expect(minutesLeft(throttleFrom(1, T0), T0 + 60 * 60_000)).toBe(0);
  });

  it('isOpen is only true inside the window', () => {
    const s = throttleFrom(5, T0);
    expect(isOpen(s, T0)).toBe(true);
    expect(isOpen(s, T0 + 5 * 60_000)).toBe(false);
    expect(isOpen(undefined, T0)).toBe(false);
  });

  it('formats a label', () => {
    expect(throttleLabel(7)).toBe('~7 min');
  });
});
