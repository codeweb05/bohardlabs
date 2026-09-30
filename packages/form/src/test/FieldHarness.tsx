import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import type {AnyFormApi} from '@tanstack/react-form';
import {useEffect, useState} from 'react';
import type {ReactNode, RefObject} from 'react';

import {createAppForm} from '../createAppForm.js';

const {useAppForm} = createAppForm({fieldComponents: {}, formComponents: {}});

export interface FieldHarnessProps {
  readonly defaultValue: unknown;
  /** Runs on blur and on submit. Return a message to fail. */
  readonly validate?: (value: unknown) => string | undefined;
  readonly onSubmit?: (value: unknown) => void;
  /** Receives the form API, for tests that call `applyServerErrors` or `reset`. */
  readonly formRef?: RefObject<AnyFormApi | null>;
  readonly children: ReactNode;
}

/**
 * One field named `value` in a real TanStack form, a submit button, and the last
 * submitted value printed as JSON. The tests and the stories both render through it, so a
 * story shows exactly what the tests assert.
 */
export function FieldHarness({defaultValue, validate, onSubmit, formRef, children}: Readonly<FieldHarnessProps>) {
  const [submitted, setSubmitted] = useState('');
  const form = useAppForm({
    defaultValues: {value: defaultValue},
    onSubmit: ({value}) => {
      setSubmitted(JSON.stringify(value.value));
      onSubmit?.(value.value);
    },
  });

  useEffect(() => {
    if (formRef) formRef.current = form;
  }, [form, formRef]);

  return (
    <Box
      component="form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      sx={{maxWidth: 420}}
    >
      <Stack spacing={1}>
        <form.AppField
          name="value"
          validators={{onBlur: ({value}) => validate?.(value), onSubmit: ({value}) => validate?.(value)}}
        >
          {() => children}
        </form.AppField>
        <Box>
          <Button type="submit" variant="contained">
            Submit
          </Button>
        </Box>
        <output aria-label="Submitted value">{submitted}</output>
      </Stack>
    </Box>
  );
}
