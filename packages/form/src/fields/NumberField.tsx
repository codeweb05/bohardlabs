import MuiTextField from '@mui/material/TextField';
import {useState} from 'react';

import {FieldShell} from '../core/FieldShell.js';
import type {CommonFieldProps} from '../core/types.js';
import {useFieldBinding} from '../core/useFieldBinding.js';
import {NULLABLE_NUMBER} from '../core/valueChecks.js';

export interface NumberFieldProps extends CommonFieldProps {
  /** The character the user types and sees. The form value is always a plain number. */
  readonly decimalSeparator?: '.' | ',';
  readonly allowDecimals?: boolean;
  readonly placeholder?: string;
}

function toText(value: number | null, separator: string): string {
  return value === null || !Number.isFinite(value) ? '' : String(value).replace('.', separator);
}

/** The value the text stands for, or null while it is empty or not yet a number (`-`, `.`). */
function toNumber(text: string, separator: string): number | null {
  const normalised = text.replace(separator, '.');
  if (normalised === '' || normalised === '-' || normalised === '.' || normalised === '-.') return null;
  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : null;
}

export function NumberField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  decimalSeparator = '.',
  allowDecimals = true,
  placeholder,
}: Readonly<NumberFieldProps>) {
  const binding = useFieldBinding<number | null>({required, expect: NULLABLE_NUMBER});
  // NaN and Infinity count as empty: NaN never equals itself, so the resync below would loop.
  const value = Number.isFinite(binding.value) ? binding.value : null;

  // What the user typed, kept apart from the form value so `4.` and `-` survive a render.
  // When the form value changes from outside (reset, a loaded record), the text follows it.
  const [text, setText] = useState(() => toText(value, decimalSeparator));
  const [shownValue, setShownValue] = useState(value);
  if (value !== shownValue) {
    setShownValue(value);
    setText(toText(value, decimalSeparator));
  }

  const escaped = decimalSeparator === '.' ? '\\.' : ',';
  const accepted = new RegExp(allowDecimals ? `^-?\\d*(${escaped}\\d*)?$` : '^-?\\d*$');

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <MuiTextField
        id={binding.inputId}
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          if (!accepted.test(next)) return;
          const parsed = toNumber(next, decimalSeparator);
          setText(next);
          setShownValue(parsed);
          binding.setValue(parsed);
        }}
        onBlur={binding.onBlur}
        error={binding.error !== null}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        fullWidth
        slotProps={{htmlInput: {...binding.inputProps, inputMode: allowDecimals ? 'decimal' : 'numeric'}}}
      />
    </FieldShell>
  );
}
