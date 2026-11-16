/**
 * Local case file: recent lookups, kept in the browser only.
 *
 * Storage is injected so this is testable without a DOM, and so a corrupt or
 * unavailable localStorage never breaks the app.
 */

export interface HistoryEntry {
  national: string;
  e164: string;
  kind?: string;
  operator?: string;
  owner?: string;
  cnic?: string;
  source?: 'typed' | 'mirror';
  at: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const HISTORY_KEY = 'pakdossier.history.v1';
export const HISTORY_CAP = 25;

export function loadHistory(storage: StorageLike | undefined): HistoryEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is HistoryEntry => !!e && typeof (e as HistoryEntry).e164 === 'string' && typeof (e as HistoryEntry).at === 'number')
      .slice(0, HISTORY_CAP);
  } catch {
    return [];
  }
}

/** Newest first, de-duplicated by number, capped. */
export function addHistory(storage: StorageLike | undefined, entry: HistoryEntry): HistoryEntry[] {
  const list = loadHistory(storage);
  const next = [entry, ...list.filter((e) => e.e164 !== entry.e164)].slice(0, HISTORY_CAP);
  if (storage) {
    try {
      storage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      /* quota / private mode — history is best-effort */
    }
  }
  return next;
}

export function clearHistory(storage: StorageLike | undefined): HistoryEntry[] {
  try {
    storage?.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
  return [];
}

export function relativeAge(entry: HistoryEntry, now: number): string {
  const secs = Math.max(0, Math.round((now - entry.at) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
