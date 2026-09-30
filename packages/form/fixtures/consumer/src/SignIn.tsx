import Stack from '@mui/material/Stack';
import {applyServerErrors, createAppForm, FormError, PasswordField, SubmitButton, TextField} from '@vt-labs/form';
import {z} from 'zod';

const {useAppForm} = createAppForm({
  fieldComponents: {TextField, PasswordField},
  formComponents: {SubmitButton, FormError},
});

const signInSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

type Credentials = z.infer<typeof signInSchema>;

export function SignIn({signIn}: {readonly signIn: (credentials: Credentials) => Promise<void>}) {
  const form = useAppForm({
    defaultValues: {email: '', password: ''},
    validators: {onSubmit: signInSchema},
    onSubmit: async ({value, formApi}) => {
      try {
        await signIn(value);
      } catch {
        applyServerErrors(formApi, {form: 'That email and password do not match.'});
      }
    },
  });

  return (
    <Stack
      component="form"
      spacing={1}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="email">
        {(field) => <field.TextField label="Email" type="email" autoComplete="email" required />}
      </form.AppField>
      <form.AppField name="password">{(field) => <field.PasswordField label="Password" required />}</form.AppField>
      <form.AppForm>
        <form.FormError />
        <form.SubmitButton submittingLabel="Signing in…">Sign in</form.SubmitButton>
      </form.AppForm>
    </Stack>
  );
}
