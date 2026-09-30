import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import {AsyncAutocompleteInput} from './AsyncAutocompleteInput';
import type {LoadOptions} from './useAsyncOptions';

export interface AsyncAutocompleteFieldProps<T> extends CommonFieldProps {
  /**
   * Called with what the user typed. Abort on `signal`; a newer query has replaced this one.
   * For caching, call `queryClient.fetchQuery` in here.
   */
  readonly loadOptions: LoadOptions<T>;
  readonly getOptionValue: (option: T) => string | number;
  readonly getOptionLabel: (option: T) => string;
  /** Store `T[]` instead of `T | null`. */
  readonly multiple?: boolean;
  readonly debounceMs?: number;
  readonly minQueryLength?: number;
  readonly placeholder?: string;
}

export function AsyncAutocompleteField<T>({
  label,
  description,
  required,
  tooltip,
  disabled,
  ...inputProps
}: Readonly<AsyncAutocompleteFieldProps<T>>) {
  const binding = useFieldBinding<T | T[] | null>({required});

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <AsyncAutocompleteInput<T>
        {...inputProps}
        disabled={disabled}
        binding={binding}
        value={binding.value ?? null}
        onChange={binding.setValue}
      />
    </FieldShell>
  );
}
