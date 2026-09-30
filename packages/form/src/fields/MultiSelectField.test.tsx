import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {FieldHarness} from '../test/FieldHarness';
import {MultiSelectField} from './MultiSelectField';

const TAGS = [
  {value: 1, label: 'Urgent'},
  {value: 2, label: 'Billing'},
  {value: 3, label: 'Bug'},
];

describe('MultiSelectField', () => {
  it('stores an array of values, as chips, from a plain select', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={[]}>
        <MultiSelectField label="Tags" options={TAGS} />
      </FieldHarness>,
    );
    const combobox = screen.getByRole('combobox', {name: /Tags/});
    await user.click(combobox);
    const listbox = screen.getByRole('listbox');
    await user.click(within(listbox).getByRole('option', {name: 'Urgent'}));
    await user.click(within(listbox).getByRole('option', {name: 'Bug'}));
    await user.keyboard('{Escape}');

    // Scoped to the combobox itself (its rendered value), so this cannot match an option
    // still sitting in a portalled, open listbox.
    expect(within(combobox).getByText('Urgent')).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('[1,3]');
  });

  it('searches when searchable, and removes a chip', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={[2]}>
        <MultiSelectField label="Tags" options={TAGS} searchable />
      </FieldHarness>,
    );
    const input = screen.getByRole('combobox', {name: 'Tags'});
    await user.type(input, 'bu');
    await user.click(screen.getByRole('option', {name: 'Bug'}));

    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('[2,3]');

    await user.click(input);
    await user.keyboard('{Backspace}');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('[2]');
  });
});
