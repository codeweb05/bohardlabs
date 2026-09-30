import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {FormConfigProvider} from '../config/FormConfigContext';
import {FieldHarness} from '../test/FieldHarness';
import {PasswordField} from './PasswordField';

describe('PasswordField', () => {
  it('hides the value until the toggle is pressed, and the toggle names what it will do', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue="">
        <PasswordField label="Password" />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'current-password');

    await user.click(screen.getByRole('button', {name: 'Show password'}));
    expect(input).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', {name: 'Hide password'}));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('takes the toggle text from the labels', () => {
    render(
      <FormConfigProvider labels={{showPassword: 'Passwort anzeigen'}}>
        <FieldHarness defaultValue="">
          <PasswordField label="Passwort" />
        </FieldHarness>
      </FormConfigProvider>,
    );
    expect(screen.getByRole('button', {name: 'Passwort anzeigen'})).toBeInTheDocument();
  });

  it('submits what was typed', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue="">
        <PasswordField label="Password" autoComplete="new-password" />
      </FieldHarness>,
    );
    await user.type(screen.getByLabelText('Password'), 's3cret!');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('"s3cret!"');
  });
});
