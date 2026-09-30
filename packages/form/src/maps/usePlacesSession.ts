import {useRef} from 'react';

import type {PlacesProvider} from './types.js';

/**
 * One billing session from the first keystroke of a search to the pick that ends it. A
 * session belongs to the provider that started it, so a new provider starts a new one.
 */
export function usePlacesSession(provider: PlacesProvider) {
  const session = useRef<{readonly provider: PlacesProvider; readonly token: object} | null>(null);
  return {
    current: () => {
      if (session.current?.provider !== provider) session.current = {provider, token: provider.newSession()};
      return session.current.token;
    },
    end: () => {
      session.current = null;
    },
  };
}
