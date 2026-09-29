import type {StandardSchemaV1Issue} from '@tanstack/react-form';
import {createContext, useContext, useMemo} from 'react';
import type {ReactNode} from 'react';

import {DEFAULT_FORM_LABELS} from './labels';
import type {FormLabels} from './labels';

/**
 * Turns a validation issue into the sentence shown under a field. A plain string error is
 * handed over as `{message}`, so one function covers schema issues and hand-written
 * validators alike.
 */
export type FormatError = (issue: StandardSchemaV1Issue) => string;

interface FormConfig {
  readonly labels: FormLabels;
  readonly formatError: FormatError;
}

const defaultFormatError: FormatError = (issue) => issue.message;

/** The defaults are the context default, so a field outside any provider still reads real strings. */
const FormConfigContext = createContext<FormConfig>({labels: DEFAULT_FORM_LABELS, formatError: defaultFormatError});

interface FormConfigProviderProps {
  readonly labels?: Partial<FormLabels>;
  readonly formatError?: FormatError;
  readonly children: ReactNode;
}

export function FormConfigProvider({labels, formatError, children}: Readonly<FormConfigProviderProps>) {
  const value = useMemo<FormConfig>(
    () => ({
      labels: labels ? {...DEFAULT_FORM_LABELS, ...labels} : DEFAULT_FORM_LABELS,
      formatError: formatError ?? defaultFormatError,
    }),
    [labels, formatError],
  );

  return <FormConfigContext.Provider value={value}>{children}</FormConfigContext.Provider>;
}

export function useFormConfig(): FormConfig {
  return useContext(FormConfigContext);
}
