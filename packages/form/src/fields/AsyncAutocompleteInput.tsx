import Autocomplete from '@mui/material/Autocomplete';
import MuiTextField from '@mui/material/TextField';
import {useState} from 'react';

import {useFormConfig} from '../config/FormConfigContext';
import {autocompleteText} from '../core/autocompleteText';
import type {FieldBinding} from '../core/useFieldBinding';
import {useAsyncOptions} from './useAsyncOptions';
import type {LoadOptions} from './useAsyncOptions';

function toArray<T>(value: T | readonly T[] | null) {
  if (value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export interface AsyncAutocompleteInputProps<T> {
  readonly binding: Pick<FieldBinding<unknown>, 'inputId' | 'error' | 'onBlur' | 'inputProps'>;
  readonly value: T | readonly T[] | null;
  readonly onChange: (value: T | T[] | null) => void;
  readonly multiple?: boolean;
  readonly loadOptions: LoadOptions<T>;
  readonly getOptionValue: (option: T) => string | number;
  readonly getOptionLabel: (option: T) => string;
  readonly debounceMs?: number;
  readonly minQueryLength?: number;
  readonly autoFocus?: boolean;
  readonly disabled?: boolean;
  readonly placeholder?: string;
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
      renderInput={(params) => {
        const htmlInput = {...params.slotProps.htmlInput, ...binding.inputProps};
        return (
          <MuiTextField
            {...params}
            autoFocus={autoFocus}
            placeholder={placeholder}
            error={binding.error !== null}
            slotProps={{...params.slotProps, htmlInput}}
          />
        );
      }}
    />
  );
}
