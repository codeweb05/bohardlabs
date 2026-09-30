// The heavy-field half of the fixture. SignIn.tsx is the README's example as printed; this
// form registers a date field through lazyField, which must land in a chunk of its own.
import {createAppForm, lazyField, SubmitButton, TextField} from '@vt-labs/form';

const BirthdayField = lazyField(() => import('./BirthdayField').then((module) => module.BirthdayField));

const {useAppForm} = createAppForm({
  fieldComponents: {TextField, BirthdayField},
  formComponents: {SubmitButton},
});

interface SignUpValues {
  name: string;
  birthday: string | null;
}

const DEFAULTS: SignUpValues = {name: '', birthday: null};

export function SignUp() {
  const form = useAppForm({defaultValues: DEFAULTS, onSubmit: async () => {}});

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="name">{(field) => <field.TextField label="Name" />}</form.AppField>
      <form.AppField name="birthday">{(field) => <field.BirthdayField label="Birthday" />}</form.AppField>
      <form.AppForm>
        <form.SubmitButton>Sign up</form.SubmitButton>
      </form.AppForm>
    </form>
  );
}
