import Box from '@mui/material/Box';
import FormLabel from '@mui/material/FormLabel';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';

import {FieldShell} from '../core/FieldShell';
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

/**
 * Renders its own label with `id={binding.labelId}` and hands that id to MUI's Select
 * `labelId` prop instead of going through the shell's `as="label"` layout: that layout
 * also wires a `<label for>` to the input, and having both a native label association and
 * `aria-labelledby` on the same combobox names it twice.
 */
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
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
      as="bare"
    >
      <Box sx={{width: '100%'}}>
        <FormLabel
          id={binding.labelId}
          required={required}
          disabled={disabled}
          error={binding.error !== null}
          sx={{display: 'block', mb: 0.5}}
        >
          {label}
        </FormLabel>
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
      </Box>
    </FieldShell>
  );
}
