import {AdapterDateFns} from '@mui/x-date-pickers/AdapterDateFns';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import type {MuiPickersAdapter} from '@mui/x-date-pickers/models';
import type {AnyFormApi} from '@tanstack/react-form';
import {act, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createRef} from 'react';
import type {ReactNode} from 'react';

import {FieldHarness} from '../test/FieldHarness.js';
import type {FieldHarnessProps} from '../test/FieldHarness.js';
import {DateField} from './DateField.js';
import {DateRangeField} from './DateRangeField.js';
import {TimePickerField} from './TimePickerField.js';

// A MUI X 9 field is a `role="group"` of `role="spinbutton"` sections, with the formatted
// value in a hidden `<input>` inside the group. The tests read that input and type into the
// sections, the way a keyboard user edits the field.
function hiddenInput(group: HTMLElement): HTMLElement {
  return within(group).getByRole('textbox', {hidden: true});
}

function firstSection(group: HTMLElement): HTMLElement {
  const [section] = within(group).getAllByRole('spinbutton');
  if (!section) throw new Error('The picker group has no sections');
  return section;
}

// Each adapter's locale type differs; the provider only needs a class that builds an adapter.
const ADAPTERS: [string, new () => MuiPickersAdapter][] = [
  ['date-fns', AdapterDateFns],
  ['dayjs', AdapterDayjs],
];

describe.each(ADAPTERS)('pickers under %s', (_name, Adapter) => {
  function renderPicker(field: ReactNode, harness: Omit<FieldHarnessProps, 'children'>) {
    return render(
      <LocalizationProvider dateAdapter={Adapter}>
        <FieldHarness {...harness}>{field}</FieldHarness>
      </LocalizationProvider>,
    );
  }

  async function submitted(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    return screen.getByLabelText('Submitted value').textContent;
  }

  describe('DateField', () => {
    it('shows a stored date on the same day it was stored', () => {
      renderPicker(<DateField label="Start" />, {defaultValue: '2026-03-09'});
      expect(hiddenInput(screen.getByRole('group', {name: 'Start'}))).toHaveValue('03/09/2026');
    });

    it('stores what the user types as YYYY-MM-DD', async () => {
      const user = userEvent.setup();
      renderPicker(<DateField label="Start" />, {defaultValue: null});
      await user.click(firstSection(screen.getByRole('group', {name: 'Start'})));
      await user.keyboard('01152026');
      expect(await submitted(user)).toBe('"2026-01-15"');
    });

    it('keeps a half-typed date on screen while the form holds null', async () => {
      const user = userEvent.setup();
      renderPicker(<DateField label="Start" />, {defaultValue: null});
      const group = screen.getByRole('group', {name: 'Start'});
      await user.click(firstSection(group));
      await user.keyboard('04');
      expect(hiddenInput(group)).toHaveValue('04/DD/YYYY');
      expect(await submitted(user)).toBe('null');
      expect(hiddenInput(group)).toHaveValue('04/DD/YYYY');
    });

    it('renders an unusable stored value as empty and warns once, naming the field', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderPicker(<DateField label="Start" />, {defaultValue: '2026-13-40'});
      expect(hiddenInput(screen.getByRole('group', {name: 'Start'}))).toHaveValue('');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain('"value"');
    });

    it('follows a value set from outside', () => {
      const formRef = createRef<AnyFormApi>();
      renderPicker(<DateField label="Start" />, {defaultValue: null, formRef});
      act(() => formRef.current?.setFieldValue('value', '2026-07-04'));
      expect(hiddenInput(screen.getByRole('group', {name: 'Start'}))).toHaveValue('07/04/2026');
    });

    it('wires the error and the form id onto the group', async () => {
      const user = userEvent.setup();
      renderPicker(<DateField label="Start" required />, {
        defaultValue: null,
        validate: (value) => (value ? undefined : 'Pick a date'),
      });
      await user.click(screen.getByRole('button', {name: 'Submit'}));
      const group = screen.getByRole('group', {name: /Start/});
      expect(group).toHaveAttribute('aria-invalid', 'true');
      for (const section of within(group).getAllByRole('spinbutton')) expect(section).toBeRequired();
      expect(group).toHaveAttribute('data-form-id');
      expect(group).toHaveAccessibleDescription('Pick a date');
    });

    it('keeps a date outside minDate out of the value and shows the field invalid', async () => {
      const user = userEvent.setup();
      renderPicker(<DateField label="Start" minDate="2026-01-01" />, {defaultValue: null});
      const group = screen.getByRole('group', {name: 'Start'});
      await user.click(firstSection(group));
      await user.keyboard('12312025');
      expect(hiddenInput(group)).toHaveValue('12/31/2025');
      expect(group).toHaveAttribute('aria-invalid', 'true');
      expect(await submitted(user)).toBe('null');
    });

    it('does not store the year a user is still typing', async () => {
      const user = userEvent.setup();
      renderPicker(<DateField label="Start" />, {defaultValue: null});
      await user.click(firstSection(screen.getByRole('group', {name: 'Start'})));
      await user.keyboard('05042');
      expect(await submitted(user)).toBe('null');
    });

    it('moves focus to its first section on an invalid submit', async () => {
      const user = userEvent.setup();
      renderPicker(<DateField label="Start" />, {
        defaultValue: null,
        validate: (value) => (value ? undefined : 'Pick a date'),
      });
      await user.click(screen.getByRole('button', {name: 'Submit'}));
      await waitFor(() => expect(firstSection(screen.getByRole('group', {name: 'Start'}))).toHaveFocus());
    });
  });

  describe('TimePickerField', () => {
    it('stores HH:mm and shows a stored time', async () => {
      const user = userEvent.setup();
      renderPicker(<TimePickerField label="Opens at" ampm={false} />, {defaultValue: '09:30'});
      const group = screen.getByRole('group', {name: 'Opens at'});
      expect(hiddenInput(group)).toHaveValue('09:30');

      await user.click(firstSection(group));
      await user.keyboard('1745');
      expect(await submitted(user)).toBe('"17:45"');
    });
  });

  describe('DateRangeField', () => {
    it('stores both ends and labels each picker', async () => {
      const user = userEvent.setup();
      renderPicker(<DateRangeField label="Stay" />, {defaultValue: {start: '2026-05-01', end: null}});
      const stay = screen.getByRole('group', {name: 'Stay'});
      expect(hiddenInput(within(stay).getByRole('group', {name: 'Start'}))).toHaveValue('05/01/2026');

      await user.click(firstSection(within(stay).getByRole('group', {name: 'End'})));
      await user.keyboard('05042026');
      expect(await submitted(user)).toBe('{"start":"2026-05-01","end":"2026-05-04"}');
    });

    it('keeps an end typed before the start out of the value', async () => {
      const user = userEvent.setup();
      renderPicker(<DateRangeField label="Stay" />, {defaultValue: {start: '2026-05-01', end: null}});
      const end = within(screen.getByRole('group', {name: 'Stay'})).getByRole('group', {name: 'End'});
      await user.click(firstSection(end));
      await user.keyboard('04202026');
      expect(hiddenInput(end)).toHaveValue('04/20/2026');
      expect(end).toHaveAttribute('aria-invalid', 'true');
      expect(await submitted(user)).toBe('{"start":"2026-05-01","end":null}');
    });

    it('holds the end to the start the user just picked', async () => {
      const user = userEvent.setup();
      renderPicker(<DateRangeField label="Stay" />, {defaultValue: {start: null, end: null}});
      const stay = screen.getByRole('group', {name: 'Stay'});
      await user.click(firstSection(within(stay).getByRole('group', {name: 'Start'})));
      await user.keyboard('05012026');
      await user.click(firstSection(within(stay).getByRole('group', {name: 'End'})));
      await user.keyboard('04202026');
      expect(await submitted(user)).toBe('{"start":"2026-05-01","end":null}');
    });
  });
});
