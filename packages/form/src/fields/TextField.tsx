import MuiTextField from '@mui/material/TextField';
import {useEffect, useRef} from 'react';

import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import {STRING} from '../core/valueChecks';

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
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // A literal `autoFocus` JSX attribute trips jsx-a11y/no-autofocus regardless of whether
  // the value is conditional; focusing imperatively when the consumer opts in does not.
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

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
        inputRef={inputRef}
        value={binding.value ?? ''}
        onChange={(event) => binding.setValue(event.target.value)}
        onBlur={binding.onBlur}
        error={binding.error !== null}
        disabled={disabled}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        multiline={multiline}
        minRows={minRows}
        maxRows={maxRows}
        fullWidth
        slotProps={{htmlInput: {...binding.inputProps, maxLength, ...(multiline ? {rows: minRows} : {})}}}
      />
    </FieldShell>
  );
}
