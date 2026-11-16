import { useEffect, useState } from 'preact/hooks';
import { lookupCnic, type CnicOutcome } from '../api/client';
import { isCnic } from '../core/formats';

export type CnicLookupState = CnicOutcome | { state: 'idle' } | { state: 'loading' };

/** Reverse lookup for a CNIC: which numbers sit on it. */
export function useCnicLookup(cnic: string) {
  const [state, setState] = useState<CnicLookupState>({ state: 'idle' });
  const [nonce, setNonce] = useState(0);
  const valid = isCnic(cnic);

  useEffect(() => {
    if (!valid) {
      setState({ state: 'idle' });
      return;
    }
    const ac = new AbortController();
    setState({ state: 'loading' });
    void lookupCnic(cnic, { signal: ac.signal, fresh: nonce > 0 }).then((out) => {
      if (!ac.signal.aborted) setState(out);
    });
    return () => ac.abort();
  }, [cnic, valid, nonce]);

  return { state, refresh: () => setNonce((n) => n + 1) };
}
