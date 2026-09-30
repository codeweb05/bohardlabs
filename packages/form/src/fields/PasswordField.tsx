import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MuiTextField from '@mui/material/TextField';
import {useState} from 'react';

import {useFormConfig} from '../config/FormConfigContext';
import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import {STRING} from '../core/valueChecks';

export interface PasswordFieldProps extends CommonFieldProps {
  /** `new-password` on sign-up and reset screens, so the browser offers to generate one. */
  readonly autoComplete?: 'current-password' | 'new-password';
  readonly placeholder?: string;
}

export function PasswordField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  autoComplete = 'current-password',
  placeholder,
}: Readonly<PasswordFieldProps>) {
  const binding = useFieldBinding<string>({required, expect: STRING});
  const {labels} = useFormConfig();
  const [visible, setVisible] = useState(false);

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
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        fullWidth
        slotProps={{
          htmlInput: binding.inputProps,
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  edge="end"
                  disabled={disabled}
                  aria-label={visible ? labels.hidePassword : labels.showPassword}
                  onClick={() => setVisible((current) => !current)}
                >
                  {visible ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
    </FieldShell>
  );
}
