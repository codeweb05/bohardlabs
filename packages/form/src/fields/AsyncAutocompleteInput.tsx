import Autocomplete from '@mui/material/Autocomplete';
import {useState} from 'react';

import {useFormConfig} from '../config/FormConfigContext';
import {autocompleteText} from '../core/autocompleteText';
import {renderAutocompleteInput} from '../core/renderAutocompleteInput';
import type {FieldBinding} from '../core/useFieldBinding';
import {useAsyncOptions} from './useAsyncOptions';
import type {AsyncOptionsProps} from './useAsyncOptions';

// `Array.isArray` alone narrows an unconstrained generic union like `T | readonly T[]` to a
// type with an `any`-typed branch, which silently drops checking on the array elements. A
// user-defined type guard narrows soundly instead, so `toArray`'s declared `readonly T[]`
// return type is real, not a cast.
function isArray<T>(value: T | readonly T[]): value is readonly T[] {
  return Array.isArray(value);
}

function toArray<T>(value: T | readonly T[] | null): readonly T[] {
  if (value === null) return [];
  return isArray(value) ? value : [value];
}

export interface AsyncAutocompleteInputProps<T> extends AsyncOptionsProps<T> {
  readonly binding: Pick<FieldBinding<unknown>, 'inputId' | 'error' | 'onBlur' | 'inputProps'>;
  readonly value: T | readonly T[] | null;
  readonly onChange: (value: T | T[] | null) => void;
  readonly autoFocus?: boolean;
  readonly disabled?: boolean;
}

/**
 * The Autocomplete behind `AsyncAutocompleteField` and `LocationSearchField`. It takes the
 * value and the change handler explicitly, because the location field stores something
 * other than the option the user picked.
 */
export function AsyncAutocompleteInput<T>({
  binding,
  value,
  onChange,
  loadOptions,
  getOptionValue,
  getOptionLabel,
  multiple = false,
  debounceMs = 300,
  minQueryLength = 0,
  placeholder,
  autoFocus,
  disabled,
}: AsyncAutocompleteInputProps<T>) {
  const {labels} = useFormConfig();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const {options, status} = useAsyncOptions(loadOptions, query, {active: open, debounceMs, minQueryLength});

  // The form holds the item itself, not its id, so an edit screen shows the saved item's
  // label before any search has run. Folding the current value into the loaded options
  // keeps MUI from warning that the value matches none of them.
  const current = toArray(value);
  const loadedIds = new Set(options.map(getOptionValue));
  const merged = [...current.filter((item) => !loadedIds.has(getOptionValue(item))), ...options];
  const text = autocompleteText(labels);

  return (
    <Autocomplete<T, boolean, false, false>
      id={binding.inputId}
      multiple={multiple}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={merged}
      value={multiple ? [...current] : (current[0] ?? null)}
      onChange={(_event, next) => onChange(next)}
      onInputChange={(_event, input, reason) => setQuery(reason === 'input' ? input : '')}
      onBlur={binding.onBlur}
      filterOptions={(all) => all}
      filterSelectedOptions={multiple}
      getOptionLabel={getOptionLabel}
      getOptionKey={(option) => getOptionValue(option)}
      isOptionEqualToValue={(option, selected) => getOptionValue(option) === getOptionValue(selected)}
      loading={status === 'loading'}
      disabled={disabled}
      fullWidth
      {...text}
      noOptionsText={status === 'error' ? labels.loadFailed : text.noOptionsText}
      renderInput={(params) => renderAutocompleteInput(params, binding, {autoFocus, placeholder})}
    />
  );
}
