import InputAdornment from '@mui/material/InputAdornment';
import MuiTextField from '@mui/material/TextField';
import {useStore} from '@tanstack/react-form';
import {useState} from 'react';

import {useFormConfig, useFieldSize} from '../config/FormConfigContext.js';
import type {FormLabels} from '../config/labels.js';
import {useFieldContext} from '../context.js';
import {FieldShell} from '../core/FieldShell.js';
import type {CommonFieldProps} from '../core/types.js';
import {useFieldBinding} from '../core/useFieldBinding.js';
import {NULLABLE_NUMBER} from '../core/valueChecks.js';

export interface NumberFieldProps extends CommonFieldProps {
  /** The character the user types and sees. The form value is always a plain number. */
  readonly decimalSeparator?: '.' | ',';
  readonly allowDecimals?: boolean;
  readonly placeholder?: string;
  /** Shown at the end of the input, such as `minutes` or `%`. Pass it translated. */
  readonly unit?: string;
  /**
   * The lowest value the arrow keys reach. Announced through `aria-valuemin` and shown in the
   * helper line when there is no `description`. Typing below it is allowed: reject it in the
   * schema, as for any other rule.
   */
  readonly min?: number;
  /** The highest value the arrow keys reach. Like `min`, it does not stop typing. */
  readonly max?: number;
  /**
   * How far `ArrowUp` and `ArrowDown` move the value. Default 1. It does not limit the
   * decimals a user may type; the schema does that if it matters.
   */
  readonly step?: number;
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

function decimalsOf(value: number): number {
  return Math.min(String(value).split('.')[1]?.length ?? 0, 20);
}

/** One arrow-key step from `value`, held inside the bounds and free of float noise (0.1 + 0.2). */
function stepFrom(value: number | null, delta: number, min: number | undefined, max: number | undefined): number {
  const raw = value === null ? (min ?? 0) : value + delta;
  const rounded = Number(raw.toFixed(Math.max(decimalsOf(value ?? 0), decimalsOf(delta))));
  return Math.min(Math.max(rounded, min ?? -Infinity), max ?? Infinity);
}

/** The helper line for a field with bounds and no description. IntegerListField shares it. */
export function rangeText(labels: FormLabels, min: number | undefined, max: number | undefined): string | undefined {
  if (min !== undefined && max !== undefined) return labels.numberRange(min, max);
  if (min !== undefined) return labels.numberMin(min);
  if (max !== undefined) return labels.numberMax(max);
  return undefined;
}

export function NumberField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  size,
  decimalSeparator = '.',
  allowDecimals = true,
  placeholder,
  unit,
  min,
  max,
  step,
}: Readonly<NumberFieldProps>) {
  const {labels} = useFormConfig();
  const binding = useFieldBinding<number | null>({required, expect: NULLABLE_NUMBER});
  const fieldSize = useFieldSize(size);
  // NaN and Infinity count as empty: NaN never equals itself, so the resync below would loop.
  const value = Number.isFinite(binding.value) ? binding.value : null;
  const field = useFieldContext<unknown>();
  const isTouched = useStore(field.store, (state) => state.meta.isTouched);

  // What the user typed, kept apart from the form value so `4.` and `-` survive a render.
  // When the form value changes from outside (a loaded record), or a reset untouches the
  // field, the text is rebuilt from the value.
  const [text, setText] = useState(() => toText(value, decimalSeparator));
  const [shownValue, setShownValue] = useState(value);
  const [wasTouched, setWasTouched] = useState(isTouched);
  if (value !== shownValue || (wasTouched && !isTouched)) {
    setShownValue(value);
    setText(toText(value, decimalSeparator));
  }
  if (isTouched !== wasTouched) setWasTouched(isTouched);

  const escaped = decimalSeparator === '.' ? '\\.' : ',';
  const accepted = new RegExp(allowDecimals ? `^-?\\d*(${escaped}\\d*)?$` : '^-?\\d*$');

  const write = (nextText: string, parsed: number | null) => {
    setText(nextText);
    setShownValue(parsed);
    binding.setValue(parsed);
  };
  // A spinbutton only when there is a range or step to announce, so a plain number field keeps
  // the textbox role a consumer's tests may already query by.
  const isSpinbutton = min !== undefined || max !== undefined || step !== undefined;

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description ?? rangeText(labels, min, max)}
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
          write(next, toNumber(next, decimalSeparator));
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          event.preventDefault();
          const delta = (step ?? 1) * (event.key === 'ArrowUp' ? 1 : -1);
          const next = stepFrom(value, delta, min, max);
          write(toText(next, decimalSeparator), next);
        }}
        onBlur={binding.onBlur}
        error={binding.error !== null}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        size={fieldSize}
        fullWidth
        slotProps={{
          input: unit ? {endAdornment: <InputAdornment position="end">{unit}</InputAdornment>} : undefined,
          htmlInput: {
            ...binding.inputProps,
            inputMode: allowDecimals ? 'decimal' : 'numeric',
            ...(isSpinbutton && {
              role: 'spinbutton',
              'aria-valuemin': min,
              'aria-valuemax': max,
              'aria-valuenow': value ?? undefined,
            }),
          },
        }}
      />
    </FieldShell>
  );
}
