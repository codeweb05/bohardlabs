import MuiTextField from '@mui/material/TextField';

import {FieldShell} from '../core/FieldShell.js';
import type {CommonFieldProps} from '../core/types.js';
import {useFieldBinding} from '../core/useFieldBinding.js';
import {STRING} from '../core/valueChecks.js';

export interface TextFieldProps extends CommonFieldProps {
  readonly type?: 'text' | 'email' | 'url' | 'tel' | 'search';
  readonly placeholder?: string;
  readonly autoComplete?: string;
  readonly maxLength?: number;
  readonly multiline?: boolean;
  readonly minRows?: number;
  readonly maxRows?: number;
}

export function TextField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  type = 'text',
  placeholder,
  autoComplete,
  maxLength,
  multiline,
  minRows,
  maxRows,
}: Readonly<TextFieldProps>) {
  const binding = useFieldBinding<string>({required, expect: STRING});

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
        value={binding.value ?? ''}
        onChange={(event) => binding.setValue(event.target.value)}
        onBlur={binding.onBlur}
        error={binding.error !== null}
        disabled={disabled}
        autoFocus={autoFocus}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        multiline={multiline}
        minRows={minRows}
        maxRows={maxRows}
        fullWidth
        // MUI 9's InputBase merges its own `rows: undefined` (from the top-level `rows`
        // prop, which this field never sets) into inputProps ahead of slotProps.htmlInput,
        // and that clobbers TextareaAutosize's `rows={minRows}` default. Setting `rows`
        // here, inside slotProps.htmlInput, survives that merge and reaches the DOM.
        slotProps={{htmlInput: {...binding.inputProps, maxLength, ...(multiline ? {rows: minRows} : {})}}}
      />
    </FieldShell>
  );
}
