import type {Option} from '../core/types';

/** Finds the option a DOM value stands for. The DOM stringifies; the option keeps the real type. */
export function findOption<V extends string | number>(
  options: readonly Option<V>[],
  raw: unknown,
): Option<V> | undefined {
  return options.find((option) => String(option.value) === String(raw));
}
