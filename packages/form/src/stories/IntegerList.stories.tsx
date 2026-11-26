import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, userEvent, within} from 'storybook/test';

import {IntegerListField} from '../fields/IntegerListField.js';
import {FieldHarness} from '../test/FieldHarness.js';

const meta = {
  title: 'Form/Integer list',
  component: IntegerListField,
  tags: ['autodocs'],
  args: {label: 'Reminder offsets', unit: 'min', min: 5, max: 1440, sorted: true},
  render: (args) => (
    <FieldHarness defaultValue={[15, 60]}>
      <IntegerListField {...args} />
    </FieldHarness>
  ),
} satisfies Meta<typeof IntegerListField>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Comma or `Enter` commits an entry as a chip, sorted on commit. A bad entry stays on screen
 * as an error chip, out of the value, and the form will not submit until it is removed.
 */
export const ReminderOffsets: Story = {
  name: 'Reminder offsets',
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Reminder offsets');

    await userEvent.type(input, '30,');
    await userEvent.type(input, '2{Enter}');
    const chips = canvas.getAllByRole('button', {name: /^Remove /});
    await expect(chips.map((chip) => chip.getAttribute('aria-label'))).toEqual([
      'Remove 15 min',
      'Remove 30 min',
      'Remove 60 min',
      'Remove 2',
    ]);
    await expect(canvas.getByText('2 is not between 5 and 1440')).toBeVisible();

    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toBeEmptyDOMElement();

    await userEvent.click(canvas.getByRole('button', {name: 'Remove 2'}));
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('[15,30,60]');
  },
};
