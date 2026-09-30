import {useEffect, useLayoutEffect, useRef, useState} from 'react';

import {toEditorError} from '../errors';
import {loadSource, type LoadedImage} from '../input/loadSource';
import type {ImageEditorError, ImageEditorInput} from '../types';

type Settled = {status: 'ready'; image: LoadedImage} | {status: 'error'; error: ImageEditorError};

export type LoadState = {status: 'idle'} | {status: 'loading'} | Settled;

/**
 * Loads `source` into a working copy and owns its object URL: it is revoked when the
 * source changes and on unmount, which is also when the editor closes. A failure is
 * reported through `onError` once.
 */
export function useLoadedImage(
  source: Blob | string | null,
  input: ImageEditorInput | undefined,
  onError: ((error: ImageEditorError) => void) | undefined,
): LoadState {
  // Keyed by the source it belongs to, so a new source reads as loading without a reset
  // inside the effect.
  const [settled, setSettled] = useState<{source: Blob | string; state: Settled} | null>(null);
  const latest = useRef({input, onError});
  useLayoutEffect(() => {
    latest.current = {input, onError};
  });

  useEffect(() => {
    if (source === null) return;
    let cancelled = false;
    let loaded: LoadedImage | null = null;

    async function start(from: Blob | string) {
      try {
        const image = await loadSource(from, latest.current.input ?? {});
        if (cancelled) {
          image.revoke();
          return;
        }
        loaded = image;
        setSettled({source: from, state: {status: 'ready', image}});
      } catch (error) {
        if (cancelled) return;
        const reported = toEditorError(error, 'load-failed');
        setSettled({source: from, state: {status: 'error', error: reported}});
        latest.current.onError?.(reported);
      }
    }

    start(source).catch(() => undefined);
    return () => {
      cancelled = true;
      loaded?.revoke();
    };
  }, [source]);

  if (source === null) return {status: 'idle'};
  return settled?.source === source ? settled.state : {status: 'loading'};
}
