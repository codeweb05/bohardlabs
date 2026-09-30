import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import {useState} from 'react';

import {useFormConfig} from '../config/FormConfigContext.js';
import {autocompleteText} from '../core/autocompleteText.js';
import {FieldShell} from '../core/FieldShell.js';
import {LabelledByShell} from '../core/LabelledByShell.js';
import {renderAutocompleteInput} from '../core/renderAutocompleteInput.js';
import type {CommonFieldProps, Option} from '../core/types.js';
import {useFieldBinding} from '../core/useFieldBinding.js';
import type {FieldBinding} from '../core/useFieldBinding.js';
import {SCALAR_ARRAY} from '../core/valueChecks.js';
import {findOption} from './optionLookup.js';

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
  // A stored value no longer in `options` (an archived tag) stays selected, labelled with
  // itself, so a toggle elsewhere does not drop it. DurationField keeps off-list values too.
  const selected = (Array.isArray(binding.value) ? binding.value : []).flatMap((value): Option<V>[] => {
    if (typeof value !== 'string' && typeof value !== 'number') return [];
    return [findOption(props.options, value) ?? {value, label: String(value)}];
  });

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

/** `options`, plus any selected value that is not one of them, so it can be unpicked. */
function withSelected<V extends string | number>(
  options: readonly Option<V>[],
  selected: readonly Option<V>[],
): Option<V>[] {
  return [...options, ...selected.filter((option) => !options.includes(option))];
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
  // An off-list value keeps its menu item after it is unpicked, so a mistaken click can be
  // undone. The kept items reset when the value changes from outside the field.
  const offList = selected.filter((option) => !options.includes(option));
  const [held, setHeld] = useState({source: binding.value, offList});
  let kept = held.offList;
  if (held.source !== binding.value) {
    kept = offList;
    setHeld({source: binding.value, offList});
  }
  // Kept items are a snapshot, so one the options now hold, or one still selected, is
  // skipped here rather than listed twice.
  const current = withSelected(options, selected);
  const menu = [...current, ...kept.filter((option) => !findOption(current, option.value))];
  const write = (next: V[]) => {
    setHeld({source: next, offList: menu.filter((option) => !options.includes(option))});
    binding.setValue(next);
  };

  return (
    <Select<string[]>
      multiple
      labelId={binding.labelId}
      value={selected.map((option) => String(option.value))}
      onChange={(event) => {
        const raw = event.target.value;
        const values = typeof raw === 'string' ? raw.split(',') : raw;
        write(values.flatMap((value) => findOption(menu, value)?.value ?? []));
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
      {menu.map((option) => (
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
      options={withSelected(options, selected)}
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
