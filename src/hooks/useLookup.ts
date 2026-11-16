import { useEffect, useState } from 'preact/hooks';
import { lookup, type LookupOutcome } from '../api/client';

export type LookupState = LookupOutcome | { state: 'idle' } | { state: 'loading' };

/**
 * Owns the live lookup so both the panel and the CNIC-unlock logic read the
 * same result (previously the request lived inside the presentational panel).
 */
export function useLookup(national?: string) {
  const [state, setState] = useState<LookupState>({ state: 'idle' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!national) {
      setState({ state: 'idle' });
      return;
    }
    const ac = new AbortController();
    setState({ state: 'loading' });
    void lookup(national, { signal: ac.signal, fresh: nonce > 0 }).then((out) => {
      if (!ac.signal.aborted) setState(out);
    });
    return () => ac.abort();
  }, [national, nonce]);

  return { state, refresh: () => setNonce((n) => n + 1) };
}
