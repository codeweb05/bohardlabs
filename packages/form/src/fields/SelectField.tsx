import Box from '@mui/material/Box';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';

import {SelectFieldShell} from '../core/SelectFieldShell';
import type {CommonFieldProps, Option} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import {NULLABLE_SCALAR} from '../core/valueChecks';
import {findOption} from './optionLookup';

export interface SelectFieldProps<V extends string | number> extends CommonFieldProps {
  readonly options: readonly Option<V>[];
  /** Shown while nothing is chosen. */
  readonly placeholder?: string;
  /** When set, the first item clears the choice back to null and reads this. */
  readonly emptyLabel?: string;
}

const EMPTY = '';

/** The layout is `SelectFieldShell`: see its comment for why this doesn't go through `FieldShell` directly. */
export function SelectField<V extends string | number>({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  options,
  placeholder,
  emptyLabel,
}: Readonly<SelectFieldProps<V>>) {
  const binding = useFieldBinding<V | null>({required, expect: NULLABLE_SCALAR});
  const selected = findOption(options, binding.value);

  return (
    <SelectFieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <Select<string>
        labelId={binding.labelId}
        value={selected ? String(selected.value) : EMPTY}
        onChange={(event) => binding.setValue(findOption(options, event.target.value)?.value ?? null)}
        onBlur={binding.onBlur}
        error={binding.error !== null}
        disabled={disabled}
        autoFocus={autoFocus}
        fullWidth
        displayEmpty
        renderValue={() =>
          selected ? (
            selected.label
          ) : (
            <Box component="span" sx={{color: 'text.secondary'}}>
              {placeholder ?? '​'}
            </Box>
          )
        }
        SelectDisplayProps={{id: binding.inputId, ...binding.inputProps}}
      >
        {emptyLabel === undefined ? null : (
          <MenuItem value={EMPTY}>
            <em>{emptyLabel}</em>
          </MenuItem>
        )}
        {options.map((option) => (
          <MenuItem key={String(option.value)} value={String(option.value)} disabled={option.disabled}>
            <ListItemText primary={option.label} secondary={option.description} />
          </MenuItem>
        ))}
      </Select>
    </SelectFieldShell>
  );
}
