import Autocomplete from '@mui/material/Autocomplete';

import {useFormConfig} from '../config/FormConfigContext';
import {autocompleteText} from '../core/autocompleteText';
import {FieldShell} from '../core/FieldShell';
import {renderAutocompleteInput} from '../core/renderAutocompleteInput';
import type {CommonFieldProps, Option} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import {NULLABLE_SCALAR} from '../core/valueChecks';
import {findOption} from './optionLookup';

export interface SearchableSelectFieldProps<V extends string | number> extends CommonFieldProps {
  readonly options: readonly Option<V>[];
  readonly placeholder?: string;
}

/** `SelectField` for lists long enough that scrolling stops working, filtered in the browser. */
export function SearchableSelectField<V extends string | number>({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  options,
  placeholder,
}: Readonly<SearchableSelectFieldProps<V>>) {
  const binding = useFieldBinding<V | null>({required, expect: NULLABLE_SCALAR});
  const {labels} = useFormConfig();

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <Autocomplete<Option<V>>
        id={binding.inputId}
        options={options}
        value={findOption(options, binding.value) ?? null}
        onChange={(_event, option) => binding.setValue(option?.value ?? null)}
        onBlur={binding.onBlur}
        getOptionLabel={(option) => option.label}
        getOptionDisabled={(option) => option.disabled === true}
        isOptionEqualToValue={(option, value) => option.value === value.value}
        disabled={disabled}
        fullWidth
        {...autocompleteText(labels)}
        renderInput={(params) => renderAutocompleteInput(params, binding, {autoFocus, placeholder})}
      />
    </FieldShell>
  );
}
