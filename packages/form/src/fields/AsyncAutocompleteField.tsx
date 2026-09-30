import {FieldShell} from '../core/FieldShell.js';
import type {CommonFieldProps} from '../core/types.js';
import {useFieldBinding} from '../core/useFieldBinding.js';
import {AsyncAutocompleteInput} from './AsyncAutocompleteInput.js';
import type {AsyncOptionsProps} from './useAsyncOptions.js';

export interface AsyncAutocompleteFieldProps<T> extends CommonFieldProps, AsyncOptionsProps<T> {}

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
