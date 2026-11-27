import {useReducer, useState} from 'react';

import type {RegistryEntry} from '../../core/types.js';
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
  /** The state of `entry`; `hash` is the hash of what the page draws for it now, `null` when it is not the open one. */
  readonly stateOf: (entry: RegistryEntry, hash: string | null) => TestState;
  /** Ticks `entry` for `hash`, or takes the tick away when it is already tested. */
  readonly toggle: (entry: RegistryEntry, hash: string) => void;
  /** Counts over all `entries` and each channel, the open one judged by `hash`. */
  readonly count: (entries: readonly RegistryEntry[], openId: string | undefined, hash: string | null) => TestCounts;
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
 * Test mode: whether it is on, and each notification's tick for `locale`. Ticks are kept in this
 * browser under `key` and the mode under `modeKey`. Nothing here leaves the browser.
 */
export function useTesting(key: string, modeKey: string, locale: string): Testing {
  const [storage] = useState(browserStorage);
  const [store] = useState(() => createTestedStore(storage, key));
  const [on, setOn] = useState(() => readFlag(storage, modeKey));
  const [, changed] = useReducer((n: number) => n + 1, 0);
  const stateOf: Testing['stateOf'] = (entry, hash) => store.stateOf(entry.id, locale, hash);
  return {
    on,
    setOn: (next) => {
      writeFlag(storage, modeKey, next);
      setOn(next);
    },
    stateOf,
    toggle: (entry, hash) => {
      if (stateOf(entry, hash) === 'tested') store.untick(entry.id, locale);
      else store.tick(entry.id, locale, hash);
      changed();
    },
    count: (entries, openId, hash) => {
      const tally = (channel?: RegistryEntry['channel']): TestCount => {
        const of = entries.filter((entry) => channel === undefined || entry.channel === channel);
        const states = of.map((entry) => stateOf(entry, entry.id === openId ? hash : null));
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
