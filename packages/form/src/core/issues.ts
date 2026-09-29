import type {StandardSchemaV1Issue} from '@tanstack/react-form';

function isIssue(error: unknown): error is StandardSchemaV1Issue {
  return typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string';
}

/**
 * TanStack stores whatever a validator returned: a string from a hand-written check, an
 * issue object from a schema, sometimes an array of issues. This finds the first thing
 * that reads as an error and returns it as an issue.
 */
export function firstIssue(errors: readonly unknown[]): StandardSchemaV1Issue | null {
  for (const error of errors.flat()) {
    if (typeof error === 'string' && error !== '') return {message: error};
    if (isIssue(error)) return error;
  }
  return null;
}
