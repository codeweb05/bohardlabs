export type TestState = 'untested' | 'tested' | 'retest';

/**
 * A fingerprint as the catalog gives it; `null` where the server's render threw. A `null` is kept
 * and compared as a value of its own, so it never reads as tested against a real fingerprint.
 */
export type Fingerprint = string | null;

export interface TestedStore {
  /** `tested` when the tick's fingerprint is `fingerprint`, `retest` when it is another, `untested` with no tick. */
  readonly stateOf: (id: string, locale: string, fingerprint: Fingerprint) => TestState;
  readonly tick: (id: string, locale: string, fingerprint: Fingerprint) => void;
  readonly untick: (id: string, locale: string) => void;
  readonly clear: () => void;
}

const keyOf = (id: string, locale: string): string => JSON.stringify([id, locale]);

/** How a fingerprint is stored: no fingerprint is the empty string, which no real one is. */
const storedForm = (fingerprint: Fingerprint): string => fingerprint ?? '';

/** Ticks as stored: `[id, locale, hash]` triples. Anything else in the value is dropped. */
function read(storage: Storage | null, key: string): Map<string, string> {
  const ticks = new Map<string, string>();
  try {
    const stored = storage?.getItem(key) ?? null;
    const found: unknown = stored === null ? [] : JSON.parse(stored);
    if (!Array.isArray(found)) return ticks;
    for (const row of found as unknown[]) {
      if (Array.isArray(row) && row.length === 3 && row.every((part) => typeof part === 'string')) {
        const [id, locale, hash] = row as [string, string, string];
        ticks.set(keyOf(id, locale), hash);
      }
    }
  } catch {
    // Unreadable or blocked: start with no ticks.
  }
  return ticks;
}

/**
 * The ticks a reviewer gave, each for an entry and a locale with the catalog's fingerprint of it
 * when ticked. They live in `storage` under `key`, in this browser only, and hold ids and
 * fingerprints, never a render. With `null` or a storage that throws they are kept for the session.
 */
export function createTestedStore(storage: Storage | null, key: string): TestedStore {
  const ticks = read(storage, key);
  const save = (): void => {
    try {
      if (ticks.size === 0) {
        storage?.removeItem(key);
        return;
      }
      const rows = [...ticks].map(([entry, hash]): [string, string, string] => {
        const [id, locale] = JSON.parse(entry) as [string, string];
        return [id, locale, hash];
      });
      storage?.setItem(key, JSON.stringify(rows));
    } catch {
      // Kept for this visit only.
    }
  };
  return {
    stateOf: (id, locale, fingerprint) => {
      const ticked = ticks.get(keyOf(id, locale));
      if (ticked === undefined) return 'untested';
      return ticked === storedForm(fingerprint) ? 'tested' : 'retest';
    },
    tick: (id, locale, fingerprint) => {
      ticks.set(keyOf(id, locale), storedForm(fingerprint));
      save();
    },
    untick: (id, locale) => {
      ticks.delete(keyOf(id, locale));
      save();
    },
    clear: () => {
      ticks.clear();
      save();
    },
  };
}

/** The list's filter in test mode: everything, what is left to test (never tested or changed), or what is tested. */
export type TestFilter = 'all' | 'todo' | 'tested';

export function shows(filter: TestFilter, state: TestState): boolean {
  if (filter === 'all') return true;
  return filter === 'tested' ? state === 'tested' : state !== 'tested';
}

/** Whether the flag stored under `key` is on; off when nothing is stored or storage is missing or throws. */
export function readFlag(storage: Storage | null, key: string): boolean {
  try {
    return storage?.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** Stores the flag under `key`; off removes it. A storage that throws leaves it for this visit only. */
export function writeFlag(storage: Storage | null, key: string, on: boolean): void {
  try {
    if (on) storage?.setItem(key, '1');
    else storage?.removeItem(key);
  } catch {
    // Kept for this visit only.
  }
}
