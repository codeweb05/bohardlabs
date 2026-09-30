import Stack from '@mui/material/Stack';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, fn, userEvent, waitFor, within} from 'storybook/test';

import {createAppForm} from '../createAppForm.js';
import {TextField} from '../fields/TextField.js';
import {CancelButton} from '../form/CancelButton.js';
import {FormError} from '../form/FormError.js';
import {SubmitButton} from '../form/SubmitButton.js';
import {applyServerErrors} from '../serverErrors.js';

const {useAppForm} = createAppForm({
  fieldComponents: {TextField},
  formComponents: {SubmitButton, CancelButton, FormError},
});

interface InviteProps {
  readonly onCancel: () => void;
}

/** Submitting shows the server's answer: one field error and one form error. */
function Invite({onCancel}: InviteProps) {
  const form = useAppForm({
    defaultValues: {email: ''},
    validators: {onSubmit: ({value}) => (value.email ? undefined : {fields: {email: 'Enter an email address'}})},
    onSubmit: async ({formApi}) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      applyServerErrors(formApi, {fields: {email: 'Already invited'}, form: 'Nothing was sent.'});
    },
  });

  return (
    <Stack
      component="form"
      spacing={1}
      noValidate
      sx={{maxWidth: 420}}
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="email">{(field) => <field.TextField label="Email" required />}</form.AppField>
      <form.AppForm>
        <form.FormError />
        <Stack direction="row" spacing={1}>
          <form.SubmitButton submittingLabel="Sending…">Send invite</form.SubmitButton>
          <form.CancelButton onCancel={onCancel} />
        </Stack>
      </form.AppForm>
    </Stack>
  );
}

const meta = {
  title: 'Form/Actions and server errors',
  component: Invite,
  args: {onCancel: fn()},
} satisfies Meta<typeof Invite>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An empty submit focuses the field; a filled one shows the server's two messages. */
export const Default: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {name: 'Send invite'}));
    await waitFor(() => expect(canvas.getByLabelText(/Email/)).toHaveFocus());

    await userEvent.type(canvas.getByLabelText(/Email/), 'ada@example.com');
    await userEvent.click(canvas.getByRole('button', {name: 'Send invite'}));
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Nothing was sent.');
    await expect(canvas.getByLabelText(/Email/)).toHaveAccessibleDescription('Already invited');
  },
};
