import type {AnyFieldApi, AnyFormApi} from '@tanstack/react-form';

/**
 * A server error answers the value that was submitted, so it stops applying the moment
 * the user edits that field. TanStack does not clear it on its own, and while it stays
 * set the form cannot submit.
 */
export function clearServerError(field: AnyFieldApi): void {
  if (field.state.meta.errorMap.onServer === undefined) return;
  field.setMeta((meta) => ({...meta, errorMap: {...meta.errorMap, onServer: undefined}}));
}

export interface ServerErrors {
  /** Messages keyed by TanStack field path (`email`, `items[0].name`). */
  readonly fields?: Readonly<Record<string, string>>;
  /** A message about the whole submission, shown by `FormError`. */
  readonly form?: string;
}

/**
 * Puts a backend's rejection on screen. Turning a response body into this shape is the
 * consumer's job; the package knows no response format.
 *
 * A message for a path with no mounted field is added to the form message instead of
 * being dropped, so the user always sees why the save failed.
 */
export function applyServerErrors(form: AnyFormApi, errors: ServerErrors): void {
  const unplaced: string[] = [];

  for (const [name, message] of Object.entries(errors.fields ?? {})) {
    if (!form.getFieldInfo(name).instance) {
      unplaced.push(message);
      continue;
    }
    // Touched, because an error only shows on a touched field and the user may never
    // have been in this one.
    form.setFieldMeta(name, (meta) => ({...meta, isTouched: true, errorMap: {...meta.errorMap, onServer: message}}));
  }

  const formMessage = [errors.form, ...unplaced].filter(Boolean).join(' ');
  form.setErrorMap({onServer: formMessage === '' ? undefined : formMessage});
}
