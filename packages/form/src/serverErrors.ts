import type {AnyFieldApi} from '@tanstack/react-form';

/**
 * A server error answers the value that was submitted, so it stops applying the moment
 * the user edits that field. TanStack does not clear it on its own, and while it stays
 * set the form cannot submit.
 */
export function clearServerError(field: AnyFieldApi): void {
  if (field.state.meta.errorMap.onServer === undefined) return;
  field.setMeta((meta) => ({...meta, errorMap: {...meta.errorMap, onServer: undefined}}));
}
