import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {FormConfigProvider} from '../config/FormConfigContext.js';
import {FieldHarness} from '../test/FieldHarness.js';
import {SearchableSelectField} from './SearchableSelectField.js';

const COUNTRIES = [
  {value: 'de', label: 'Germany'},
  {value: 'fr', label: 'France'},
  {value: 'in', label: 'India'},
];

describe('SearchableSelectField', () => {
  it('filters as the user types and stores the chosen value', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <SearchableSelectField label="Country" options={COUNTRIES} />
      </FieldHarness>,
    );
    await user.type(screen.getByRole('combobox', {name: 'Country'}), 'fra');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await user.click(screen.getByRole('option', {name: 'France'}));

    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('"fr"');
  });

  it('shows the label of a value set before render', () => {
    render(
      <FieldHarness defaultValue="in">
        <SearchableSelectField label="Country" options={COUNTRIES} />
      </FieldHarness>,
    );
    expect(screen.getByRole('combobox', {name: 'Country'})).toHaveValue('India');
  });

  it('takes the empty-list text from the labels', async () => {
    const user = userEvent.setup();
    render(
      <FormConfigProvider labels={{noOptions: 'Keine Treffer'}}>
        <FieldHarness defaultValue={null}>
          <SearchableSelectField label="Land" options={COUNTRIES} />
        </FieldHarness>
      </FormConfigProvider>,
    );
    await user.type(screen.getByRole('combobox', {name: 'Land'}), 'zzz');
    expect(screen.getByText('Keine Treffer')).toBeInTheDocument();
  });

  it('wires aria-describedby and aria-invalid onto the combobox input', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null} validate={(value) => (value === null ? 'Pick a country' : undefined)}>
        <SearchableSelectField label="Country" options={COUNTRIES} />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    const input = screen.getByRole('combobox', {name: 'Country'});
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Pick a country');
  });
});
