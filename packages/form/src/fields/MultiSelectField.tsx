import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';

import {useFormConfig} from '../config/FormConfigContext';
import {autocompleteText} from '../core/autocompleteText';
import {FieldShell} from '../core/FieldShell';
import {LabelledByShell} from '../core/LabelledByShell';
import {renderAutocompleteInput} from '../core/renderAutocompleteInput';
import type {CommonFieldProps, Option} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import type {FieldBinding} from '../core/useFieldBinding';
import {SCALAR_ARRAY} from '../core/valueChecks';
import {findOption} from './optionLookup';

export interface MultiSelectFieldProps<V extends string | number> extends CommonFieldProps {
  readonly options: readonly Option<V>[];
  readonly placeholder?: string;
  /** Type to filter. Worth it past a dozen options. */
  readonly searchable?: boolean;
}

/**
 * `SearchableMulti` can use `FieldShell`'s default `as="label"` layout: Autocomplete's `id`
 * lands on a real `<input>`, a legitimate `<label for>` target. `PlainMulti` cannot: its
 * `id` lands on MUI Select's display `div`, so it uses `LabelledByShell`, the same layout
 * `SelectField` uses for the identical reason (see its comment there).
 */
export function MultiSelectField<V extends string | number>(props: Readonly<MultiSelectFieldProps<V>>) {
  const {label, description, required, tooltip, disabled} = props;
  const binding = useFieldBinding<V[]>({required, expect: SCALAR_ARRAY});
  const selected = (Array.isArray(binding.value) ? binding.value : []).flatMap(
    (value) => findOption(props.options, value) ?? [],
  );

  if (props.searchable) {
    return (
      <FieldShell
        binding={binding}
        label={label}
        description={description}
        required={required}
        tooltip={tooltip}
        disabled={disabled}
      >
        <SearchableMulti {...props} binding={binding} selected={selected} />
      </FieldShell>
    );
  }

  return (
    <LabelledByShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <PlainMulti {...props} binding={binding} selected={selected} />
    </LabelledByShell>
  );
}

interface VariantProps<V extends string | number> extends MultiSelectFieldProps<V> {
  readonly binding: FieldBinding<V[]>;
  readonly selected: readonly Option<V>[];
}

function PlainMulti<V extends string | number>({
  options,
  placeholder,
  disabled,
  autoFocus,
  binding,
  selected,
}: VariantProps<V>) {
  return (
    <Select<string[]>
      multiple
      labelId={binding.labelId}
      value={selected.map((option) => String(option.value))}
      onChange={(event) => {
        const raw = event.target.value;
        const values = typeof raw === 'string' ? raw.split(',') : raw;
        binding.setValue(values.flatMap((value) => findOption(options, value)?.value ?? []));
      }}
      onBlur={binding.onBlur}
      error={binding.error !== null}
      disabled={disabled}
      autoFocus={autoFocus}
      fullWidth
      displayEmpty
      renderValue={() =>
        selected.length === 0 ? (
          <Box component="span" sx={{color: 'text.secondary'}}>
            {placeholder ?? '​'}
          </Box>
        ) : (
          <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5}}>
            {selected.map((option) => (
              <Chip key={String(option.value)} label={option.label} size="small" />
            ))}
          </Box>
        )
      }
      SelectDisplayProps={{id: binding.inputId, ...binding.inputProps}}
    >
      {options.map((option) => (
        <MenuItem key={String(option.value)} value={String(option.value)} disabled={option.disabled}>
          {option.label}
        </MenuItem>
      ))}
    </Select>
  );
}

function SearchableMulti<V extends string | number>({
  options,
  placeholder,
  disabled,
  autoFocus,
  binding,
  selected,
}: VariantProps<V>) {
  const {labels} = useFormConfig();
  return (
    <Autocomplete<Option<V>, true>
      multiple
      id={binding.inputId}
      options={options}
      value={[...selected]}
      onChange={(_event, chosen) => binding.setValue(chosen.map((option) => option.value))}
      onBlur={binding.onBlur}
      getOptionLabel={(option) => option.label}
      getOptionDisabled={(option) => option.disabled === true}
      isOptionEqualToValue={(option, value) => option.value === value.value}
      filterSelectedOptions
      disabled={disabled}
      fullWidth
      {...autocompleteText(labels)}
      renderInput={(params) =>
        renderAutocompleteInput(params, binding, {
          autoFocus,
          placeholder: selected.length === 0 ? placeholder : undefined,
        })
      }
    />
  );
}
