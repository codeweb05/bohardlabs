import {useStore} from '@tanstack/react-form';
import {useEffect, useId, useRef} from 'react';

import {useFormConfig} from '../config/FormConfigContext.js';
import {useFieldContext} from '../context.js';
import {clearServerError} from '../serverErrors.js';
import {firstIssue} from './issues.js';
import {describeValue, isDevelopment} from './valueChecks.js';
import type {ValueExpectation} from './valueChecks.js';

export interface FieldBinding<T> {
  readonly name: string;
  readonly formId: string;
  readonly inputId: string;
  readonly labelId: string;
  readonly helperId: string;
  readonly value: T;
  /** The formatted first error, or null while none should show. */
  readonly error: string | null;
  readonly setValue: (value: T) => void;
  readonly onBlur: () => void;
  /** Spread onto the element that takes focus. */
  readonly inputProps: {
    readonly 'aria-describedby': string;
    readonly 'aria-invalid': boolean;
    readonly 'aria-required': boolean | undefined;
    readonly 'data-form-id': string;
  };
}

interface FieldBindingOptions {
  readonly required?: boolean;
  readonly expect?: ValueExpectation;
}

/**
 * Everything a field needs from TanStack and the package, in one place: ids from `useId`,
 * the value, the error to show (touched and invalid, first error, through `formatError`),
 * and the aria wiring for the input. Exported so a consumer's own field follows the same
 * contract as the built-in ones.
 */
export function useFieldBinding<T>({required, expect}: FieldBindingOptions = {}): FieldBinding<T> {
  const field = useFieldContext<T>();
  const {formatError} = useFormConfig();
  const id = useId();
  const value = useStore(field.store, (state) => state.value);
  const isTouched = useStore(field.store, (state) => state.meta.isTouched);
  const errors = useStore(field.store, (state) => state.meta.errors);

  const issue = isTouched ? firstIssue(errors) : null;
  const error = issue ? formatError(issue) : null;
  const helperId = `${id}-helper`;

  useValueWarning(field.name, value, expect);

  return {
    name: field.name,
    formId: field.form.formId,
    inputId: `${id}-input`,
    labelId: `${id}-label`,
    helperId,
    value,
    error,
    setValue: (next) => {
      clearServerError(field);
      field.handleChange(next);
    },
    onBlur: field.handleBlur,
    inputProps: {
      'aria-describedby': helperId,
      'aria-invalid': error !== null,
      'aria-required': required || undefined,
      'data-form-id': field.form.formId,
    },
  };
}

function useValueWarning(name: string, value: unknown, expect: ValueExpectation | undefined) {
  const warned = useRef(false);
  useEffect(() => {
    if (!expect || warned.current || !isDevelopment() || expect.test(value)) return;
    warned.current = true;
    console.warn(
      `@vt-labs/form: field "${name}" holds ${describeValue(value)}, but the component rendered for it expects ${expect.description}.`,
    );
  }, [name, value, expect]);
}
