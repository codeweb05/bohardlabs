import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';

import {FieldShell} from '../core/FieldShell.js';
import type {CommonFieldProps, Option} from '../core/types.js';
import {useFieldBinding} from '../core/useFieldBinding.js';
import {NULLABLE_SCALAR} from '../core/valueChecks.js';
import {findOption} from './optionLookup.js';

export interface RadioGroupFieldProps<V extends string | number> extends CommonFieldProps {
  readonly options: readonly Option<V>[];
  readonly row?: boolean;
}

export function RadioGroupField<V extends string | number>({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  options,
  row,
}: Readonly<RadioGroupFieldProps<V>>) {
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
      as="fieldset"
    >
      <RadioGroup
        row={row}
        value={selected ? String(selected.value) : null}
        onChange={(_event, raw) => binding.setValue(findOption(options, raw)?.value ?? null)}
        onBlur={binding.onBlur}
        aria-labelledby={binding.labelId}
        {...binding.inputProps}
      >
        {options.map((option, index) => (
          <FormControlLabel
            key={String(option.value)}
            value={String(option.value)}
            disabled={disabled || option.disabled}
            control={<Radio autoFocus={autoFocus && index === 0} />}
            label={
              option.description ? (
                <Box>
                  {option.label}
                  <Typography variant="body2" sx={{color: 'text.secondary'}}>
                    {option.description}
                  </Typography>
                </Box>
              ) : (
                option.label
              )
            }
          />
        ))}
      </RadioGroup>
    </FieldShell>
  );
}
