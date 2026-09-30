import Box from '@mui/material/Box';
import FormLabel from '@mui/material/FormLabel';
import type {ReactNode} from 'react';

import {useFormConfig} from '../config/FormConfigContext';
import {FieldShell} from './FieldShell';
import {InfoTooltip} from './InfoTooltip';
import type {CommonFieldProps} from './types';
import type {FieldBinding} from './useFieldBinding';

export interface SelectFieldShellProps extends Omit<CommonFieldProps, 'autoFocus'> {
  readonly binding: Pick<FieldBinding<unknown>, 'inputId' | 'labelId' | 'helperId' | 'error'>;
  readonly children: ReactNode;
}

/**
 * The layout a field built on a native MUI `Select` needs. Select's `id` lands on the
 * display `div` it renders, not a labelable element, so `FieldShell`'s default `as="label"`
 * layout (a `<label for>` pointing at that `id`) can't activate it on click. This renders
 * the label itself, with no `htmlFor`, through `FieldShell`'s `as="bare"` instead; the
 * accessible name still comes from `aria-labelledby`, wired through the Select's own
 * `labelId` prop. Shared by `SelectField` and `MultiSelectField`'s plain (non-searchable)
 * variant, the two built-in fields that render a native `Select`.
 */
export function SelectFieldShell({
  binding,
  label,
  description,
  required,
  tooltip,
  disabled,
  children,
}: Readonly<SelectFieldShellProps>) {
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
