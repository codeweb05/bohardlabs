import Alert from '@mui/material/Alert';
import {useStore} from '@tanstack/react-form';

import {useFormConfig} from '../config/FormConfigContext';
import {useFormContext} from '../context';
import {firstIssue} from '../core/issues';

/** The form-level message from `applyServerErrors`, or nothing. */
export function FormError() {
  const form = useFormContext();
  const {formatError} = useFormConfig();
  const serverError = useStore(form.store, (state) => state.errorMap.onServer);
  const issue = firstIssue([serverError]);
  if (!issue) return null;

  return (
    <Alert severity="error" role="alert">
      {formatError(issue)}
    </Alert>
  );
}
