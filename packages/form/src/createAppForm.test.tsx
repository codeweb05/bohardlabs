import {render, screen} from '@testing-library/react';

import {useFieldContext} from './context.js';
import {createAppForm} from './createAppForm.js';

function EchoField({label}: {readonly label: string}) {
  const field = useFieldContext<string>();
  return <p>{`${label}: ${field.state.value}`}</p>;
}

const {useAppForm} = createAppForm({fieldComponents: {EchoField}, formComponents: {}});

function SignIn() {
  const form = useAppForm({defaultValues: {email: 'a@b.co'}});
  return <form.AppField name="email">{(field) => <field.EchoField label="Email" />}</form.AppField>;
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
});
