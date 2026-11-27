import {useReducer, useState} from 'react';

import type {RegistryEntry, RenderResponse} from '../../core/types.js';
import {renderHash} from './renderHash.js';
import {createTestedStore} from './testedStore.js';
import type {TestState} from './testedStore.js';

export interface TestCount {
  readonly tested: number;
  readonly total: number;
}

export interface Testing {
  readonly on: boolean;
  readonly setOn: (on: boolean) => void;
  /** The state of `entry`; `rendered` is what the page draws for it now, when it is the open one. */
  readonly stateOf: (entry: RegistryEntry, rendered: RenderResponse | undefined) => TestState;
  /** Ticks `entry` for `rendered`, or takes the tick away when it is already tested. */
  readonly toggle: (entry: RegistryEntry, rendered: RenderResponse) => void;
  /** Tested over total for all `entries` and for each channel, the open one judged by `rendered`. */
  readonly count: (
    entries: readonly RegistryEntry[],
    open: RegistryEntry | undefined,
    rendered: RenderResponse | undefined,
  ) => {readonly all: TestCount; readonly email: TestCount; readonly push: TestCount};
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
 * Test mode: whether it is on this visit, and each notification's tick, kept in this browser
 * under `key`. Nothing here leaves the browser.
 */
export function useTesting(key: string, locale: string): Testing {
  const [store] = useState(() => createTestedStore(browserStorage(), key));
  const [on, setOn] = useState(false);
  const [, changed] = useReducer((n: number) => n + 1, 0);
  const stateOf: Testing['stateOf'] = (entry, rendered) =>
    store.stateOf(entry.id, locale, rendered === undefined ? null : renderHash(rendered));
  return {
    on,
    setOn,
    stateOf,
    toggle: (entry, rendered) => {
      if (stateOf(entry, rendered) === 'tested') store.untick(entry.id, locale);
      else store.tick(entry.id, locale, renderHash(rendered));
      changed();
    },
    count: (entries, open, rendered) => {
      const tally = (channel?: RegistryEntry['channel']): TestCount => {
        const of = entries.filter((entry) => channel === undefined || entry.channel === channel);
        const tested = of.filter(
          (entry) => stateOf(entry, entry.id === open?.id ? rendered : undefined) === 'tested',
        ).length;
        return {tested, total: of.length};
      };
      return {all: tally(), email: tally('email'), push: tally('push')};
    },
  };
}
