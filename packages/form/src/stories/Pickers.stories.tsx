import Stack from '@mui/material/Stack';
import {AdapterDateFns} from '@mui/x-date-pickers/AdapterDateFns';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, userEvent, within} from 'storybook/test';

import {DateField} from '../pickers/DateField.js';
import {DateRangeField} from '../pickers/DateRangeField.js';
import {TimePickerField} from '../pickers/TimePickerField.js';
import {FieldHarness} from '../test/FieldHarness.js';

/** A picker is a group of sections; the formatted value sits in a hidden input inside it. */
function hiddenInput(group: HTMLElement): HTMLElement {
  return within(group).getByRole('textbox', {hidden: true});
}

const meta = {
  title: 'Form/Pickers',
  component: DateField,
  tags: ['autodocs'],
  args: {label: 'Start date', description: 'The first working day', required: true},
  // The preview mounts no LocalizationProvider; a consumer's app does. date-fns here
  // because that is what promptiva runs.
  decorators: [
    (Story) => (
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Story />
      </LocalizationProvider>
    ),
  ],
  render: (args) => (
    <FieldHarness defaultValue="2026-03-09">
      <DateField {...args} />
    </FieldHarness>
  ),
} satisfies Meta<typeof DateField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The form value is a plain `'YYYY-MM-DD'` string. */
export const SingleDate: Story = {
  name: 'Date',
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await expect(hiddenInput(canvas.getByRole('group', {name: /Start date/}))).toHaveValue('03/09/2026');
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('"2026-03-09"');
  },
};

/** `'HH:mm'` for a time, and `{start, end}` for a range of two linked date pickers. */
export const TimeAndRange: Story = {
  render: () => (
    <Stack spacing={2}>
      <FieldHarness defaultValue="09:00">
        <TimePickerField label="Opens at" ampm={false} />
      </FieldHarness>
      <FieldHarness defaultValue={{start: '2026-05-01', end: '2026-05-04'}}>
        <DateRangeField label="Stay" />
      </FieldHarness>
    </Stack>
  ),
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await expect(hiddenInput(canvas.getByRole('group', {name: 'Opens at'}))).toHaveValue('09:00');
    const stay = within(canvas.getByRole('group', {name: 'Stay'}));
    await expect(hiddenInput(stay.getByRole('group', {name: 'End'}))).toHaveValue('05/04/2026');
  },
};
