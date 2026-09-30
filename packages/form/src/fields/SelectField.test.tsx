import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {FieldHarness} from '../test/FieldHarness';
import {SelectField} from './SelectField';

const ROLES = [
  {value: 1, label: 'Admin', description: 'Everything'},
  {value: 2, label: 'Editor'},
  {value: 3, label: 'Viewer', disabled: true},
] as const;

async function choose(user: ReturnType<typeof userEvent.setup>, name: RegExp, option: string) {
  await user.click(screen.getByRole('combobox', {name}));
  await user.click(within(screen.getByRole('listbox')).getByRole('option', {name: new RegExp(option)}));
}

describe('SelectField', () => {
  it('stores the option value with its type, and null before a choice', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <SelectField label="Role" options={ROLES} placeholder="Pick a role" />
      </FieldHarness>,
    );
    expect(screen.getByRole('combobox', {name: /Role/})).toHaveTextContent('Pick a role');

    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('null');

    await choose(user, /Role/, 'Editor');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent(/^2$/);
  });

  it('offers an empty item that sets null when emptyLabel is given', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={1}>
        <SelectField label="Role" options={ROLES} emptyLabel="No role" />
      </FieldHarness>,
    );
    await choose(user, /Role/, 'No role');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('null');
  });

  it('disables a disabled option and shows a description', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <SelectField label="Role" options={ROLES} />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('combobox', {name: /Role/}));
    expect(screen.getByRole('option', {name: /Viewer/})).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('option', {name: /Admin/})).toHaveTextContent('Everything');
  });

  it('wires the error to the combobox', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null} validate={(value) => (value === null ? 'Pick a role' : undefined)}>
        <SelectField label="Role" options={ROLES} required />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    const combobox = screen.getByRole('combobox', {name: /Role/});
    expect(combobox).toHaveAttribute('aria-invalid', 'true');
    expect(combobox).toBeRequired();
    expect(combobox).toHaveAccessibleDescription('Pick a role');
  });
});
