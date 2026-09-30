import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {FieldHarness} from '../test/FieldHarness.js';
import {SelectField} from './SelectField.js';

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

  it("stores an option whose value is '', apart from the empty item", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <SelectField
          label="Region"
          options={[
            {value: '', label: 'Any region'},
            {value: 'eu', label: 'Europe'},
          ]}
          emptyLabel="Not set"
        />
      </FieldHarness>,
    );
    await choose(user, /Region/, 'Any region');
    expect(screen.getByRole('combobox', {name: /Region/})).toHaveTextContent('Any region');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent(/^""$/);

    await choose(user, /Region/, 'Not set');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent(/^null$/);
    expect(warn).not.toHaveBeenCalled();
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

  it('an invalid submit focuses the combobox', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null} validate={(value) => (value === null ? 'Pick a role' : undefined)}>
        <SelectField label="Role" options={ROLES} required />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    await waitFor(() => expect(screen.getByRole('combobox', {name: /Role/})).toHaveFocus());
  });

  it('puts the tooltip behind a focusable button beside the label, before the combobox in tab order', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <SelectField label="Role" options={ROLES} tooltip="Pick carefully" />
      </FieldHarness>,
    );
    await user.tab();
    expect(screen.getByRole('button', {name: 'More information'})).toHaveFocus();
  });
});
