import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {FieldHarness} from '../test/FieldHarness';
import {DurationField} from './DurationField';

async function pick(user: ReturnType<typeof userEvent.setup>, name: string, option: string) {
  await user.click(screen.getByRole('combobox', {name: new RegExp(name)}));
  await user.click(within(screen.getByRole('listbox')).getByRole('option', {name: option}));
}

describe('DurationField', () => {
  it('stores minutes, and treats an unset part as zero', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <DurationField label="Estimate" />
      </FieldHarness>,
    );
    expect(screen.getByRole('group', {name: 'Estimate'})).toBeInTheDocument();

    await pick(user, 'Hours', '2');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent(/^120$/);

    await pick(user, 'Minutes', '45');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent(/^165$/);
  });

  it('splits a stored value into its two parts', () => {
    render(
      <FieldHarness defaultValue={90}>
        <DurationField label="Estimate" />
      </FieldHarness>,
    );
    expect(screen.getByRole('combobox', {name: /Hours/})).toHaveTextContent('1');
    expect(screen.getByRole('combobox', {name: /Minutes/})).toHaveTextContent('30');
  });

  it('offers minutes in steps and hours up to maxHours', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <DurationField label="Break" maxHours={2} minuteStep={20} />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('combobox', {name: /Minutes/}));
    expect(
      within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['0', '20', '40']);
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('combobox', {name: /Hours/}));
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(3);
  });

  it('an invalid submit focuses the hours combobox', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null} validate={(value) => (value === null ? 'Pick a duration' : undefined)}>
        <DurationField label="Estimate" required />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    const hours = screen.getByRole('combobox', {name: /Hours/});
    expect(hours).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(hours).toHaveFocus());
  });
});
