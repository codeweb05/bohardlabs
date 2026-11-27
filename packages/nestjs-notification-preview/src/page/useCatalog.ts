import {useEffect, useState} from 'react';

import type {Catalog} from '../core/types.js';
import type {PreviewClient} from './client.js';

export type CatalogState =
  | {readonly state: 'loading'}
  | {readonly state: 'loaded'; readonly catalog: Catalog}
  | {readonly state: 'failed'; readonly error: unknown};

/** The registry and locales, loaded once per client; an unmount aborts the call. A failure keeps its error. */
export function useCatalog(client: PreviewClient): CatalogState {
  const [loaded, setLoaded] = useState<CatalogState>({state: 'loading'});
  useEffect(() => {
    const controller = new AbortController();
    const load = async (): Promise<void> => {
      let next: CatalogState;
      try {
        next = {state: 'loaded', catalog: await client.catalog({signal: controller.signal})};
      } catch (error: unknown) {
        next = {state: 'failed', error};
      }
      if (!controller.signal.aborted) setLoaded(next);
    };
    void load();
    return () => {
      controller.abort();
    };
  }, [client]);
  return loaded;
}
