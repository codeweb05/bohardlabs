import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {FieldHarness} from '../test/FieldHarness.js';
import {DurationField} from './DurationField.js';

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

  it('shows an off-step minute value and keeps it selectable', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={97}>
        <DurationField label="Estimate" />
      </FieldHarness>,
    );
    const minutes = screen.getByRole('combobox', {name: /Minutes/});
    expect(minutes).toHaveTextContent('37');

    await user.click(minutes);
    expect(within(screen.getByRole('listbox')).getByRole('option', {name: '37'})).toBeInTheDocument();
  });

  it('shows an hours value above maxHours and keeps it selectable', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={300}>
        <DurationField label="Estimate" maxHours={2} />
      </FieldHarness>,
    );
    const hours = screen.getByRole('combobox', {name: /Hours/});
    expect(hours).toHaveTextContent('5');

    await user.click(hours);
    expect(within(screen.getByRole('listbox')).getByRole('option', {name: '5'})).toBeInTheDocument();
  });

  it('clears back to null from the empty choice', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={90}>
        <DurationField label="Break" emptyLabel="None" />
      </FieldHarness>,
    );
    await pick(user, 'Hours', 'None');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent(/^null$/);
  });

  it('offers no empty choice when required', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={90}>
        <DurationField label="Break" emptyLabel="None" required />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('combobox', {name: /Hours/}));
    expect(within(screen.getByRole('listbox')).queryByRole('option', {name: 'None'})).not.toBeInTheDocument();
  });

  it('renders a stored NaN as empty, and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <FieldHarness defaultValue={Number.NaN}>
        <DurationField label="Estimate" />
      </FieldHarness>,
    );
    expect(screen.queryByText('NaN')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', {name: /Hours/})).not.toHaveTextContent(/\d/);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('holds NaN'));
  });

  it('renders without hanging when minuteStep is 0', () => {
    render(
      <FieldHarness defaultValue={null}>
        <DurationField label="Estimate" minuteStep={0} />
      </FieldHarness>,
    );
    expect(screen.getByRole('combobox', {name: /Minutes/})).toBeInTheDocument();
  });
});
