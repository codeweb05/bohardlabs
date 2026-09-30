import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {FieldHarness} from '../test/FieldHarness.js';
import {MultiSelectField} from './MultiSelectField.js';

const TAGS = [
  {value: 1, label: 'Urgent'},
  {value: 2, label: 'Billing'},
  {value: 3, label: 'Bug'},
];

const LETTERS = [
  {value: 'a', label: 'a'},
  {value: 'b', label: 'b'},
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

  it('keeps a stored value that is not in the options when another is toggled', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={['a', 'archived']}>
        <MultiSelectField label="Tags" options={LETTERS} />
      </FieldHarness>,
    );
    const combobox = screen.getByRole('combobox', {name: /Tags/});
    expect(within(combobox).getByText('archived')).toBeInTheDocument();
    await user.click(combobox);
    await user.click(within(screen.getByRole('listbox')).getByRole('option', {name: 'b'}));
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('["a","archived","b"]');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('keeps a stored value that is not in the options when searchable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={['a', 'archived']}>
        <MultiSelectField label="Tags" options={LETTERS} searchable />
      </FieldHarness>,
    );
    expect(screen.getByRole('button', {name: 'archived'})).toBeInTheDocument();
    await user.type(screen.getByRole('combobox', {name: 'Tags'}), 'b');
    await user.click(screen.getByRole('option', {name: 'b'}));

    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('["a","archived","b"]');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('wires the error to the combobox', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness
        defaultValue={[]}
        validate={(value) => (Array.isArray(value) && value.length === 0 ? 'Pick a tag' : undefined)}
      >
        <MultiSelectField label="Tags" options={TAGS} required />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    const combobox = screen.getByRole('combobox', {name: /Tags/});
    expect(combobox).toHaveAttribute('aria-invalid', 'true');
    expect(combobox).toBeRequired();
    expect(combobox).toHaveAccessibleDescription('Pick a tag');
  });
});
