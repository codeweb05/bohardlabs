import {useReducer, useState} from 'react';

import type {Catalog, RegistryEntry} from '../../core/types.js';
import {createTestedStore, readFlag, writeFlag} from './testedStore.js';
import type {TestState} from './testedStore.js';

export interface TestCount {
  readonly tested: number;
  /** Ticked, but the render has changed since. */
  readonly retest: number;
  readonly total: number;
}

export interface TestCounts {
  readonly all: TestCount;
  readonly email: TestCount;
  readonly push: TestCount;
}

export interface Testing {
  readonly on: boolean;
  readonly setOn: (on: boolean) => void;
  /** The state of `entry` in its channel's locale, judged by the catalog's fingerprint for it. */
  readonly stateOf: (entry: RegistryEntry) => TestState;
  /** Ticks `entry` with the catalog's fingerprint, or takes the tick away when it is already tested. */
  readonly toggle: (entry: RegistryEntry) => void;
  /** Counts over all `entries` and each channel, every one judged the same way. */
  readonly count: (entries: readonly RegistryEntry[]) => TestCounts;
}

// The store may be blocked or throw, as in a private window; ticks are then kept for the visit.
function browserStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

// What the server fingerprints a channel that lists no locale in.
const FALLBACK_LOCALE = 'en';

/**
 * Test mode: whether it is on, and each notification's tick. Each entry is judged in its own
 * channel's locale: the page's `locale` when that channel lists it, else the channel's first
 * listed locale, else `'en'`, as the server fingerprints it. So an open Spanish email leaves an
 * English-only push judged in English. A tick keeps the fingerprint the catalog gives the entry
 * in that locale, and an entry is judged against the one the catalog gives now, so an edit to the
 * server's template shows as changed on every entry, opened or not, and typing values never moves
 * a tick. Ticks are kept in this browser under `key` and the mode under `modeKey`. Nothing here
 * leaves the browser.
 */
export function useTesting(
  key: string,
  modeKey: string,
  locale: string,
  catalog: Pick<Catalog, 'locales' | 'fingerprints'>,
): Testing {
  const {locales, fingerprints} = catalog;
  const [storage] = useState(browserStorage);
  const [store] = useState(() => createTestedStore(storage, key));
  const [on, setOn] = useState(() => readFlag(storage, modeKey));
  const [, changed] = useReducer((n: number) => n + 1, 0);
  // Own properties only, so an id or a locale such as `constructor` is never read off the prototype.
  const localeOf = (entry: RegistryEntry): string => {
    const listed = (Object.hasOwn(locales, entry.channel) ? locales[entry.channel] : undefined) ?? [];
    return listed.includes(locale) ? locale : (listed[0] ?? FALLBACK_LOCALE);
  };
  const fingerprintOf = (entry: RegistryEntry, at: string): string | null => {
    const byLocale = Object.hasOwn(fingerprints, entry.id) ? fingerprints[entry.id] : undefined;
    return byLocale !== undefined && Object.hasOwn(byLocale, at) ? (byLocale[at] ?? null) : null;
  };
  const stateOf: Testing['stateOf'] = (entry) => {
    const at = localeOf(entry);
    return store.stateOf(entry.id, at, fingerprintOf(entry, at));
  };
  return {
    on,
    setOn: (next) => {
      writeFlag(storage, modeKey, next);
      setOn(next);
    },
    stateOf,
    toggle: (entry) => {
      const at = localeOf(entry);
      if (stateOf(entry) === 'tested') store.untick(entry.id, at);
      else store.tick(entry.id, at, fingerprintOf(entry, at));
      changed();
    },
    count: (entries) => {
      const tally = (channel?: RegistryEntry['channel']): TestCount => {
        const of = entries.filter((entry) => channel === undefined || entry.channel === channel);
        const states = of.map(stateOf);
        return {
          tested: states.filter((state) => state === 'tested').length,
          retest: states.filter((state) => state === 'retest').length,
          total: of.length,
        };
      };
      return {all: tally(), email: tally('email'), push: tally('push')};
    },
  };
}
