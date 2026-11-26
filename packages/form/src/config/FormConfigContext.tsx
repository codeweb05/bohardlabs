import type {StandardSchemaV1Issue} from '@tanstack/react-form';
import {createContext, useContext, useMemo} from 'react';
import type {ReactNode} from 'react';

import type {CommonFieldProps} from '../core/types.js';
import {DEFAULT_FORM_LABELS} from './labels.js';
import type {FormLabels} from './labels.js';

/**
 * Turns a validation issue into the sentence shown under a field. A plain string error is
 * handed over as `{message}`, so one function covers schema issues and hand-written
 * validators alike.
 */
export type FormatError = (issue: StandardSchemaV1Issue) => string;

interface FormConfig {
  readonly labels: FormLabels;
  readonly formatError: FormatError;
  readonly size?: CommonFieldProps['size'];
}

const defaultFormatError: FormatError = (issue) => issue.message;

/** The defaults are the context default, so a field outside any provider still reads real strings. */
const FormConfigContext = createContext<FormConfig>({labels: DEFAULT_FORM_LABELS, formatError: defaultFormatError});

interface FormConfigProviderProps {
  readonly labels?: Partial<FormLabels>;
  readonly formatError?: FormatError;
  /**
   * The size of every field below, and of `SubmitButton` and `CancelButton`. A field's own
   * `size` wins. Without either, MUI's default (and your theme's) applies.
   */
  readonly size?: CommonFieldProps['size'];
  readonly children: ReactNode;
}

/**
 * Supplies the words the package puts on screen itself, and the sentence shown under an
 * invalid field, and the size of the fields below it. Keep `labels` and `formatError` stable
 * (module level or `useMemo`).
 *
 * @example
 * const labels: Partial<FormLabels> = {showPassword: 'Passwort anzeigen', hidePassword: 'Passwort verbergen'};
 *
 * <FormConfigProvider labels={labels}>{children}</FormConfigProvider>
 */
export function FormConfigProvider({labels, formatError, size, children}: Readonly<FormConfigProviderProps>) {
  const value = useMemo<FormConfig>(
    () => ({
      labels: labels ? {...DEFAULT_FORM_LABELS, ...labels} : DEFAULT_FORM_LABELS,
      formatError: formatError ?? defaultFormatError,
      size,
    }),
    [labels, formatError, size],
  );

  return <FormConfigContext.Provider value={value}>{children}</FormConfigContext.Provider>;
}

export function useFormConfig(): FormConfig {
  return useContext(FormConfigContext);
}

/** A field's own size, else the provider's, else undefined so MUI's default applies. */
export function useFieldSize(size: CommonFieldProps['size']): CommonFieldProps['size'] {
  const shared = useFormConfig().size;
  return size ?? shared;
}
