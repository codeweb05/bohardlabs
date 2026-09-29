/**
 * TanStack Form cannot check that the component at a path matches the value type there,
 * so a field checks at runtime in development and warns once. Each constant is the check
 * and the words used in the warning.
 */
export interface ValueExpectation {
  readonly test: (value: unknown) => boolean;
  readonly description: string;
}

const isScalar = (value: unknown) => typeof value === 'string' || typeof value === 'number';

export const STRING: ValueExpectation = {test: (value) => typeof value === 'string', description: 'a string'};

export const BOOLEAN: ValueExpectation = {test: (value) => typeof value === 'boolean', description: 'a boolean'};

export const NULLABLE_NUMBER: ValueExpectation = {
  test: (value) => value === null || typeof value === 'number',
  description: 'a number or null',
};

export const NULLABLE_SCALAR: ValueExpectation = {
  test: (value) => value === null || isScalar(value),
  description: 'a string, a number or null',
};

export const SCALAR_ARRAY: ValueExpectation = {
  test: (value) => Array.isArray(value) && value.every(isScalar),
  description: 'an array of strings or numbers',
};

/**
 * Bundlers replace `process.env.NODE_ENV` textually at build time, but `process` itself is
 * `undefined` in a browser bundle, so guarding with `typeof process !== 'undefined'` first
 * would never fire in a consumer's dev build: the whole expression gets dead-code-eliminated
 * before it ever runs. Reading through `try`/`catch` instead lets the replacement happen
 * without a runtime reference to `process`.
 */
export function isDevelopment(): boolean {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}

export function describeValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return `a ${typeof value}`;
}
