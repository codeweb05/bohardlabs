import {useState} from 'react';

import type {Option} from '../core/types.js';

function sameOption<V extends string | number>(a: Option<V>, b: Option<V>): boolean {
  return a.value === b.value && a.label === b.label && a.disabled === b.disabled && a.description === b.description;
}

function sameOptions<V extends string | number>(a: readonly Option<V>[], b: readonly Option<V>[]): boolean {
  return a.length === b.length && a.every((option, index) => b[index] !== undefined && sameOption(option, b[index]));
}

/**
 * The selection to hand MUI Autocomplete as `value`. MUI resets the typed text whenever
 * `value` changes identity, and a selection looked up in `options` is a new object every
 * time a consumer maps their options inline. This returns the previous array until an
 * option in it actually changes, so a re-render mid-search keeps what the user typed.
 */
export function useHeldOptions<V extends string | number>(next: readonly Option<V>[]): Option<V>[] {
  const [held, setHeld] = useState(() => [...next]);
  if (sameOptions(held, next)) return held;
  const fresh = [...next];
  setHeld(fresh);
  return fresh;
}
