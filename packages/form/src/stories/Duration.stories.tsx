import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, screen, userEvent, within} from 'storybook/test';

import {DurationField} from '../fields/DurationField.js';
import {FieldHarness} from '../test/FieldHarness.js';

const meta = {
  title: 'Form/Duration',
  component: DurationField,
  tags: ['autodocs'],
  args: {label: 'Estimate', description: 'How long the job takes', maxHours: 8, minuteStep: 15},
  render: (args) => (
    <FieldHarness defaultValue={null}>
      <DurationField {...args} />
    </FieldHarness>
  ),
} satisfies Meta<typeof DurationField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The form stores minutes; the user picks hours and minutes. */
export const Default: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('combobox', {name: /Hours/}));
    await userEvent.click(await screen.findByRole('option', {name: '1'}));
    await userEvent.click(canvas.getByRole('combobox', {name: /Minutes/}));
    await userEvent.click(await screen.findByRole('option', {name: '30'}));
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('90');
  },
};
