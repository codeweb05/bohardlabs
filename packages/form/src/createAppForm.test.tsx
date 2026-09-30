import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {useFieldContext} from './context.js';
import {createAppForm} from './createAppForm.js';
import {TextField} from './fields/TextField.js';

function EchoField({label}: {readonly label: string}) {
  const field = useFieldContext<string>();
  return <p>{`${label}: ${field.state.value}`}</p>;
}

const {useAppForm} = createAppForm({fieldComponents: {EchoField}, formComponents: {}});

function SignIn() {
  const form = useAppForm({defaultValues: {email: 'a@b.co'}});
  return <form.AppField name="email">{(field) => <field.EchoField label="Email" />}</form.AppField>;
}

const {useAppForm: useTextForm} = createAppForm({fieldComponents: {TextField}, formComponents: {}});

function OwnInvalidHandler({onSubmitInvalid}: {readonly onSubmitInvalid: () => void}) {
  const form = useTextForm({defaultValues: {name: ''}, onSubmitInvalid});
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="name" validators={{onSubmit: ({value}) => (value ? undefined : 'Required')}}>
        {(field) => <field.TextField label="Name" />}
      </form.AppField>
      <button type="submit">Save</button>
    </form>
  );
}

function Unregistered() {
  const form = useAppForm({defaultValues: {email: 'x@y.co'}});
  return <form.AppField name="email">{() => <EchoField label="Plain" />}</form.AppField>;
}

describe('createAppForm', () => {
  it('renders a registered field through the package context', () => {
    render(<SignIn />);
    expect(screen.getByText('Email: a@b.co')).toBeInTheDocument();
  });

  it('lets an unregistered field render as a plain child of AppField', () => {
    render(<Unregistered />);
    expect(screen.getByText('Plain: x@y.co')).toBeInTheDocument();
  });

  it("runs a form's own onSubmitInvalid in place of focusing the first invalid field", async () => {
    const user = userEvent.setup();
    const onSubmitInvalid = vi.fn();
    render(<OwnInvalidHandler onSubmitInvalid={onSubmitInvalid} />);

    const save = screen.getByRole('button', {name: 'Save'});
    await user.click(save);
    await waitFor(() => expect(onSubmitInvalid).toHaveBeenCalledTimes(1));
    // The default moves focus after a tick; give it one before checking it did not.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(save).toHaveFocus();
  });
});
