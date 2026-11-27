export type TestState = 'untested' | 'tested' | 'retest';

export interface TestedStore {
  /** `null` hash: the stored state as it is, `tested` when a tick exists, since nothing is there to compare. */
  readonly stateOf: (id: string, locale: string, hash: string | null) => TestState;
  readonly tick: (id: string, locale: string, hash: string) => void;
  readonly untick: (id: string, locale: string) => void;
  readonly clear: () => void;
}

const keyOf = (id: string, locale: string): string => JSON.stringify([id, locale]);

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
 * The ticks a reviewer gave, each for an entry and a locale with the hash of the render ticked.
 * They live in `storage` under `key`, in this browser only, and hold ids and hashes, never a
 * render. With `null` or a storage that throws they are kept for the session.
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
    stateOf: (id, locale, hash) => {
      const ticked = ticks.get(keyOf(id, locale));
      if (ticked === undefined) return 'untested';
      return hash === null || ticked === hash ? 'tested' : 'retest';
    },
    tick: (id, locale, hash) => {
      ticks.set(keyOf(id, locale), hash);
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
