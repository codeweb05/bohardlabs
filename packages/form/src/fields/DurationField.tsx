import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';

import {useFormConfig} from '../config/FormConfigContext';
import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import {NULLABLE_NUMBER} from '../core/valueChecks';

export interface DurationFieldProps extends CommonFieldProps {
  /** The largest hour offered. Capped at 24. */
  readonly maxHours?: number;
  /** The gap between minute options. */
  readonly minuteStep?: number;
}

function range(count: number, step = 1): number[] {
  return Array.from({length: count}, (_, index) => index * step);
}

/**
 * `options`, plus `value` in sorted position when it isn't already one of them. A
 * stored duration can land off the generated steps (an odd legacy value) or above a
 * narrowed `maxHours`; without this the select would show blank for a value it does
 * hold, and the value could not be picked back once cleared.
 */
function withCurrentValue(options: readonly number[], value: string): number[] {
  if (value === '') return [...options];
  const current = Number(value);
  return options.includes(current) ? [...options] : [...options, current].sort((a, b) => a - b);
}

/** A length of time in minutes, picked as hours and minutes. */
export function DurationField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  maxHours = 24,
  minuteStep = 15,
}: Readonly<DurationFieldProps>) {
  const binding = useFieldBinding<number | null>({required, expect: NULLABLE_NUMBER});
  const {labels} = useFormConfig();
  const total = typeof binding.value === 'number' ? binding.value : null;
  const hours = total === null ? '' : String(Math.floor(total / 60));
  const minutes = total === null ? '' : String(total % 60);

  const change = (part: 'hours' | 'minutes', raw: string) => {
    const nextHours = Number(part === 'hours' ? raw : hours || 0);
    const nextMinutes = Number(part === 'minutes' ? raw : minutes || 0);
    binding.setValue(nextHours * 60 + nextMinutes);
  };

  const cappedHours = Math.min(Math.max(maxHours, 0), 24);
  const step = Math.max(minuteStep, 1);

  const parts = [
    {part: 'hours', caption: labels.hours, value: hours, options: withCurrentValue(range(cappedHours + 1), hours)},
    {
      part: 'minutes',
      caption: labels.minutes,
      value: minutes,
      options: withCurrentValue(range(Math.ceil(60 / step), step), minutes),
    },
  ] as const;

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
      <Box sx={{display: 'flex', gap: 1}}>
        {parts.map(({part, caption, value, options}, index) => {
          const captionId = `${binding.inputId}-${part}-caption`;
          return (
            <Box key={part} sx={{flex: 1}}>
              <Typography id={captionId} variant="caption" sx={{color: 'text.secondary'}}>
                {caption}
              </Typography>
              <Select<string>
                labelId={captionId}
                value={value}
                onChange={(event) => change(part, event.target.value)}
                onBlur={binding.onBlur}
                error={binding.error !== null}
                disabled={disabled}
                autoFocus={autoFocus && index === 0}
                fullWidth
                SelectDisplayProps={{id: `${binding.inputId}-${part}`, ...binding.inputProps}}
              >
                {options.map((option) => (
                  <MenuItem key={option} value={String(option)}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </Box>
          );
        })}
      </Box>
    </FieldShell>
  );
}
