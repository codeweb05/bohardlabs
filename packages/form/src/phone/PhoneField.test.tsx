import type {AnyFormApi} from '@tanstack/react-form';
import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createRef} from 'react';

import {FormConfigProvider} from '../config/FormConfigContext';
import {FieldHarness} from '../test/FieldHarness';
import {PhoneField} from './PhoneField';

describe('PhoneField', () => {
  it('stores E.164 while showing the formatted number', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <PhoneField label="Phone" defaultCountry="DE" />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Phone');
    await user.type(input, '30123456');
    expect(input).toHaveValue('+49 30 123456');

    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('"+4930123456"');
  });

  it('stores null when only the calling code is left', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue="+4930123456">
        <PhoneField label="Phone" />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Phone');
    await user.clear(input);
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('null');
  });

  it('shows a stored number and follows a value set from outside', () => {
    const formRef = createRef<AnyFormApi>();
    render(
      <FieldHarness defaultValue="+14155552671" formRef={formRef}>
        <PhoneField label="Phone" />
      </FieldHarness>,
    );
    expect(screen.getByLabelText('Phone')).toHaveValue('+1 415 555 2671');

    act(() => formRef.current?.setFieldValue('value', '+4930123456'));
    expect(screen.getByLabelText('Phone')).toHaveValue('+49 30 123456');

    act(() => formRef.current?.reset());
    expect(screen.getByLabelText('Phone')).toHaveValue('+1 415 555 2671');
  });

  it('names the country button from the labels', () => {
    render(
      <FormConfigProvider labels={{selectCountry: 'Land wählen'}}>
        <FieldHarness defaultValue={null}>
          <PhoneField label="Telefon" defaultCountry="DE" />
        </FieldHarness>
      </FormConfigProvider>,
    );
    expect(screen.getByRole('button', {name: 'Land wählen'})).toBeInTheDocument();
  });

  it('shows country names in the language set by langOfCountryName', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <PhoneField label="Phone" defaultCountry="DE" langOfCountryName="de" />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('button', {name: 'Select country'}));
    expect(await screen.findByRole('option', {name: /Deutschland/})).toBeInTheDocument();
  });

  it('renders flags through a supplied getFlagElement instead of flagcdn.com', () => {
    render(
      <FieldHarness defaultValue={null}>
        <PhoneField
          label="Phone"
          defaultCountry="DE"
          getFlagElement={(isoCode) => <span data-testid={`custom-flag-${isoCode}`} />}
        />
      </FieldHarness>,
    );
    expect(screen.getByTestId('custom-flag-DE')).toBeInTheDocument();
  });

  it('wires the error onto the input', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null} validate={(value) => (value ? undefined : 'Enter a phone number')}>
        <PhoneField label="Phone" required />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    const input = screen.getByLabelText(/Phone/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a phone number');
  });
});
