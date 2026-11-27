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
  /** The state of `entry` in the locale, judged by the catalog's fingerprint for it. */
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

/**
 * Test mode: whether it is on, and each notification's tick for `locale`. A tick keeps the
 * fingerprint `fingerprints` gives the entry in that locale, and an entry is judged against the
 * one the catalog gives now, so an edit to the server's template shows as changed on every entry,
 * opened or not, and typing values never moves a tick. Ticks are kept in this browser under
 * `key` and the mode under `modeKey`. Nothing here leaves the browser.
 */
export function useTesting(
  key: string,
  modeKey: string,
  locale: string,
  fingerprints: Catalog['fingerprints'],
): Testing {
  const [storage] = useState(browserStorage);
  const [store] = useState(() => createTestedStore(storage, key));
  const [on, setOn] = useState(() => readFlag(storage, modeKey));
  const [, changed] = useReducer((n: number) => n + 1, 0);
  // Own properties only, so an id or a locale such as `constructor` is never read off the prototype.
  const fingerprintOf = (entry: RegistryEntry): string | null => {
    const byLocale = Object.hasOwn(fingerprints, entry.id) ? fingerprints[entry.id] : undefined;
    return byLocale !== undefined && Object.hasOwn(byLocale, locale) ? (byLocale[locale] ?? null) : null;
  };
  const stateOf: Testing['stateOf'] = (entry) => store.stateOf(entry.id, locale, fingerprintOf(entry));
  return {
    on,
    setOn: (next) => {
      writeFlag(storage, modeKey, next);
      setOn(next);
    },
    stateOf,
    toggle: (entry) => {
      if (stateOf(entry) === 'tested') store.untick(entry.id, locale);
      else store.tick(entry.id, locale, fingerprintOf(entry));
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
