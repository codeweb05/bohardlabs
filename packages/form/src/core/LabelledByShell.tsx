import Box from '@mui/material/Box';
import FormLabel from '@mui/material/FormLabel';
import type {ReactNode} from 'react';

import {useFormConfig} from '../config/FormConfigContext';
import {FieldShell} from './FieldShell';
import {InfoTooltip} from './InfoTooltip';
import type {CommonFieldProps} from './types';
import type {FieldBinding} from './useFieldBinding';

export interface LabelledByShellProps extends Omit<CommonFieldProps, 'autoFocus'> {
  readonly binding: Pick<FieldBinding<unknown>, 'inputId' | 'labelId' | 'helperId' | 'error'>;
  readonly children: ReactNode;
}

/**
 * The layout for a field whose control is not a labelable element, so `FieldShell`'s
 * default `as="label"` layout (a `<label for>` pointing at the control's `id`) can't name
 * it or activate it on click. This renders the label itself, with no `htmlFor`, through
 * `FieldShell`'s `as="bare"` instead; the control takes its accessible name from
 * `aria-labelledby` pointing at `binding.labelId`. Used by the fields built on a native MUI
 * `Select` (its `id` lands on a display `div`, and its `labelId` prop wires the name) and
 * by the date and time pickers (a `role="group"` of spinbutton sections).
 */
export function LabelledByShell({
  binding,
  label,
  description,
  required,
  tooltip,
  disabled,
  children,
}: Readonly<LabelledByShellProps>) {
  const {labels} = useFormConfig();
  const info = tooltip ? <InfoTooltip title={tooltip} label={labels.moreInfo} /> : null;

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      disabled={disabled}
      as="bare"
    >
      <Box sx={{width: '100%'}}>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5}}>
          <FormLabel id={binding.labelId} required={required} disabled={disabled} error={binding.error !== null}>
            {label}
          </FormLabel>
          {info}
        </Box>
        {children}
      </Box>
    </FieldShell>
  );
}
