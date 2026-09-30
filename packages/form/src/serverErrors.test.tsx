import type {AnyFormApi} from '@tanstack/react-form';
import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createRef, useEffect} from 'react';
import type {RefObject} from 'react';

import {createAppForm} from './createAppForm';
import {TextField} from './fields/TextField';
import {FormError} from './form/FormError';
import {applyServerErrors} from './serverErrors';
import {FieldHarness} from './test/FieldHarness';

describe('applyServerErrors on a field', () => {
  function setup() {
    const user = userEvent.setup();
    const formRef = createRef<AnyFormApi>();
    const onSubmit = vi.fn();
    render(
      <FieldHarness defaultValue="ada@example.com" formRef={formRef} onSubmit={onSubmit}>
        <TextField label="Email" />
      </FieldHarness>,
    );
    act(() => applyServerErrors(formRef.current!, {fields: {value: 'Already invited'}}));
    return {user, onSubmit, input: screen.getByLabelText('Email')};
  }

  it('shows the message without the user touching the field', () => {
    const {input} = setup();
    expect(input).toHaveAccessibleDescription('Already invited');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('blocks a resubmit of the same value', async () => {
    const {user, onSubmit} = setup();
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears on the next edit, and the form submits again', async () => {
    const {user, onSubmit, input} = setup();
    await user.type(input, 'x');
    expect(screen.queryByText('Already invited')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(onSubmit).toHaveBeenCalledWith('ada@example.comx');
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
