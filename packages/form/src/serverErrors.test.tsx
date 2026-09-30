import type {AnyFormApi} from '@tanstack/react-form';
import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createRef, useEffect} from 'react';
import type {RefObject} from 'react';

import {createAppForm} from './createAppForm.js';
import {TextField} from './fields/TextField.js';
import {FormError} from './form/FormError.js';
import {applyServerErrors} from './serverErrors.js';
import {FieldHarness} from './test/FieldHarness.js';

// FieldHarness always gives the field its own validators, which changes how a server error clears.
describe('applyServerErrors on a field with its own validators', () => {
  // The normal flow: the user submits, the server rejects the first save, and the submit
  // handler puts the rejection on screen. Later saves succeed.
  async function setup() {
    const user = userEvent.setup();
    const formRef = createRef<AnyFormApi>();
    const save = vi.fn<(value: unknown) => Promise<void>>().mockRejectedValueOnce(new Error('409')).mockResolvedValue();
    const onSubmit = vi.fn(async (value: unknown) => {
      try {
        await save(value);
      } catch {
        applyServerErrors(formRef.current!, {fields: {value: 'Already invited'}});
      }
    });
    render(
      <FieldHarness defaultValue="ada@example.com" formRef={formRef} onSubmit={onSubmit}>
        <TextField label="Email" />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Email');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    await waitFor(() => expect(input).toHaveAccessibleDescription('Already invited'));
    return {user, save, input};
  }

  it('shows the message without the user touching the field', async () => {
    const {input} = await setup();
    expect(input).toHaveAccessibleDescription('Already invited');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not block a resubmit: the next submit sends the same value and clears the message', async () => {
    const {user, save, input} = await setup();
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith('ada@example.com');
    expect(screen.queryByText('Already invited')).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  it('clears on the next edit, and the form submits again', async () => {
    const {user, save, input} = await setup();
    await user.type(input, 'x');
    expect(screen.queryByText('Already invited')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    await waitFor(() => expect(save).toHaveBeenLastCalledWith('ada@example.comx'));
  });
});

const {useAppForm} = createAppForm({fieldComponents: {TextField}, formComponents: {FormError}});

function Profile({formRef}: {readonly formRef: RefObject<AnyFormApi | null>}) {
  const form = useAppForm({defaultValues: {name: 'Ada', address: {zip: ''}}});
  useEffect(() => {
    formRef.current = form;
  }, [form, formRef]);
  return (
    <form.AppForm>
      <form.AppField name="name">{(field) => <field.TextField label="Name" />}</form.AppField>
      <form.FormError />
    </form.AppForm>
  );
}

function Invite({save}: {readonly save: (value: unknown) => Promise<void>}) {
  const form = useAppForm({
    defaultValues: {email: 'ada@example.com'},
    validators: {onSubmit: ({value}) => (value.email ? undefined : 'Enter an email')},
    onSubmit: async ({value, formApi}) => {
      try {
        await save(value.email);
      } catch {
        applyServerErrors(formApi, {fields: {email: 'Already invited'}});
      }
    },
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="email">{(field) => <field.TextField label="Email" />}</form.AppField>
      <button type="submit">Submit</button>
    </form>
  );
}

describe('applyServerErrors on a field validated only at form level', () => {
  it('blocks a resubmit of the same value and keeps the message until the field is edited', async () => {
    const user = userEvent.setup();
    const save = vi.fn<(value: unknown) => Promise<void>>().mockRejectedValue(new Error('409'));
    render(<Invite save={save} />);
    const input = screen.getByLabelText('Email');
    const submit = screen.getByRole('button', {name: 'Submit'});

    await user.click(submit);
    await waitFor(() => expect(input).toHaveAccessibleDescription('Already invited'));

    await user.click(submit);
    await user.click(submit);
    expect(save).toHaveBeenCalledTimes(1);
    expect(input).toHaveAccessibleDescription('Already invited');

    await user.type(input, 'x');
    expect(screen.queryByText('Already invited')).not.toBeInTheDocument();
  });
});

describe('applyServerErrors on the form', () => {
  it('shows the form message in FormError, and clears it on the next edit', async () => {
    const user = userEvent.setup();
    const formRef = createRef<AnyFormApi>();
    render(<Profile formRef={formRef} />);

    act(() => applyServerErrors(formRef.current!, {form: 'Could not save'}));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');

    await user.type(screen.getByLabelText('Name'), 'x');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps a message for a field that is not on screen by adding it to the form message', () => {
    const formRef = createRef<AnyFormApi>();
    render(<Profile formRef={formRef} />);

    act(() =>
      applyServerErrors(formRef.current!, {form: 'Could not save.', fields: {'address.zip': 'Unknown postcode.'}}),
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Could not save. Unknown postcode.');
  });
});
