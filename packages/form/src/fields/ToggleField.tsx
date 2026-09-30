import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';

import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import {BOOLEAN} from '../core/valueChecks';

export type ToggleFieldProps = CommonFieldProps;

interface ToggleFieldInternalProps extends ToggleFieldProps {
  readonly control: 'checkbox' | 'switch';
}

/** The label sits beside the control, so the shell renders only the helper row. */
export function ToggleField({
  control,
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
}: ToggleFieldInternalProps) {
  const binding = useFieldBinding<boolean>({required, expect: BOOLEAN});
  const Control = control === 'checkbox' ? Checkbox : Switch;

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
      <FormControlLabel
        label={label}
        required={required}
        disabled={disabled}
        control={
          <Control
            checked={binding.value === true}
            onChange={(event) => binding.setValue(event.target.checked)}
            onBlur={binding.onBlur}
            autoFocus={autoFocus}
            slotProps={{
              input: {
                id: binding.inputId,
                ...binding.inputProps,
                ...(control === 'switch' ? {role: 'switch'} : {}),
              },
            }}
          />
        }
      />
    </FieldShell>
  );
}
