import Box from '@mui/material/Box';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import type {ReactNode} from 'react';

import {useFormConfig} from '../config/FormConfigContext.js';
import {InfoTooltip} from './InfoTooltip.js';
import type {CommonFieldProps} from './types.js';
import type {FieldBinding} from './useFieldBinding.js';

export interface FieldShellProps extends Omit<CommonFieldProps, 'autoFocus'> {
  readonly binding: Pick<FieldBinding<unknown>, 'inputId' | 'labelId' | 'helperId' | 'error'>;
  /**
   * `label`: a `<label for>` above one input. `fieldset`: a `<legend>` over a group of
   * inputs (radio buttons, the two duration selects). `bare`: the child renders its own
   * label (checkbox, switch) and the shell adds only the helper row.
   */
  readonly as?: 'label' | 'fieldset' | 'bare';
  readonly children: ReactNode;
}

/**
 * The layout every field shares: label above, input, one helper row below that is always
 * there so the form does not jump when an error appears.
 */
export function FieldShell({
  binding,
  label,
  description,
  required,
  tooltip,
  disabled,
  as = 'label',
  children,
}: Readonly<FieldShellProps>) {
  const {labels} = useFormConfig();
  const hasError = binding.error !== null;
  const info = tooltip ? <InfoTooltip title={tooltip} label={labels.moreInfo} /> : null;

  const helper = (
    <FormHelperText id={binding.helperId} error={hasError} sx={{mx: 0}}>
      {binding.error ?? (description || '​')}
    </FormHelperText>
  );

  if (as === 'fieldset') {
    return (
      <Box component="fieldset" sx={{border: 0, m: 0, p: 0, minWidth: 0}}>
        <FormLabel
          id={binding.labelId}
          component="legend"
          required={required}
          disabled={disabled}
          error={hasError}
          sx={{mb: 0.5}}
        >
          {label}
          {info}
        </FormLabel>
        {children}
        {helper}
      </Box>
    );
  }

  if (as === 'bare') {
    return (
      <Box>
        <Box sx={{display: 'flex', alignItems: 'center'}}>
          {children}
          {info}
        </Box>
        {helper}
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5}}>
        <FormLabel
          id={binding.labelId}
          htmlFor={binding.inputId}
          required={required}
          disabled={disabled}
          error={hasError}
        >
          {label}
        </FormLabel>
        {info}
      </Box>
      {children}
      {helper}
    </Box>
  );
}
