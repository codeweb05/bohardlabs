import Box from '@mui/material/Box';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';

import {LabelledByShell} from '../core/LabelledByShell.js';
import type {CommonFieldProps, Option} from '../core/types.js';
import {useFieldBinding} from '../core/useFieldBinding.js';
import {NULLABLE_SCALAR} from '../core/valueChecks.js';
import {findOption} from './optionLookup.js';

export interface SelectFieldProps<V extends string | number> extends CommonFieldProps {
  readonly options: readonly Option<V>[];
  /** Shown while nothing is chosen. */
  readonly placeholder?: string;
  /** When set, the first item clears the choice back to null and reads this. */
  readonly emptyLabel?: string;
}

/** MUI's own "nothing chosen" value, the only one it does not warn about. */
const EMPTY = '';
/** Stands in the DOM for an option whose value is `''`, which would otherwise read as nothing chosen. */
const EMPTY_STRING_OPTION = '__vt-labs-form-empty-string__';

function toDom(value: string | number): string {
  return value === '' ? EMPTY_STRING_OPTION : String(value);
}

/** The layout is `LabelledByShell`: see its comment for why this doesn't go through `FieldShell` directly. */
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
    <LabelledByShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <Select<string>
        labelId={binding.labelId}
        value={selected ? toDom(selected.value) : EMPTY}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === EMPTY) binding.setValue(null);
          else binding.setValue(findOption(options, raw === EMPTY_STRING_OPTION ? '' : raw)?.value ?? null);
        }}
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
          <MenuItem key={String(option.value)} value={toDom(option.value)} disabled={option.disabled}>
            <ListItemText primary={option.label} secondary={option.description} />
          </MenuItem>
        ))}
      </Select>
    </LabelledByShell>
  );
}
