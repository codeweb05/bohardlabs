import Button from '@mui/material/Button';
import type {ButtonProps} from '@mui/material/Button';
import {useStore} from '@tanstack/react-form';
import type {ReactNode} from 'react';

import {useFormContext} from '../context';

export interface SubmitButtonProps {
  readonly children: ReactNode;
  /** Replaces the children while the submit runs. */
  readonly submittingLabel?: ReactNode;
  readonly variant?: ButtonProps['variant'];
  readonly fullWidth?: boolean;
}

/**
 * Never disabled for an invalid form: a disabled button tells nobody why, and pressing it
 * is how the user gets every error shown and focus moved to the first one.
 */
export function SubmitButton({
  children,
  submittingLabel,
  variant = 'contained',
  fullWidth,
}: Readonly<SubmitButtonProps>) {
  const form = useFormContext();
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <Button type="submit" variant={variant} fullWidth={fullWidth} disabled={isSubmitting} aria-busy={isSubmitting}>
      {isSubmitting && submittingLabel !== undefined ? submittingLabel : children}
    </Button>
  );
}
