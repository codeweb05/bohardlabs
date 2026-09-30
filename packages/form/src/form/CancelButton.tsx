import Button from '@mui/material/Button';
import type {ButtonProps} from '@mui/material/Button';
import {useStore} from '@tanstack/react-form';
import type {ReactNode} from 'react';

import {useFormConfig} from '../config/FormConfigContext.js';
import {useFormContext} from '../context.js';

export interface CancelButtonProps {
  /** Leave the screen, close the dialog. Called after `confirm` says yes, or at once on a pristine form. */
  readonly onCancel: () => void;
  /** Asked only when the form has edits. Bring your own dialog; the package renders none. */
  readonly confirm?: () => Promise<boolean>;
  /** Defaults to the `cancel` label. */
  readonly children?: ReactNode;
  readonly variant?: ButtonProps['variant'];
}

export function CancelButton({onCancel, confirm, children, variant = 'text'}: Readonly<CancelButtonProps>) {
  const form = useFormContext();
  const {labels} = useFormConfig();
  const isDirty = useStore(form.store, (state) => state.isDirty);

  const handleClick = async () => {
    if (isDirty && confirm && !(await confirm())) return;
    onCancel();
  };

  return (
    <Button type="button" variant={variant} onClick={() => void handleClick()}>
      {children ?? labels.cancel}
    </Button>
  );
}
