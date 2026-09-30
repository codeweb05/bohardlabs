import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, userEvent, within} from 'storybook/test';

import {CheckboxField} from '../fields/CheckboxField.js';
import {SwitchField} from '../fields/SwitchField.js';
import {FieldHarness} from '../test/FieldHarness.js';

const meta = {
  title: 'Form/Checkbox and switch',
  component: CheckboxField,
  tags: ['autodocs'],
  args: {label: 'I accept the terms', required: true, tooltip: 'You can read them at any time'},
  render: (args) => (
    <FieldHarness defaultValue={false} validate={(value) => (value ? undefined : 'Accept the terms to continue')}>
      <CheckboxField {...args} />
    </FieldHarness>
  ),
} satisfies Meta<typeof CheckboxField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Checkbox: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByRole('checkbox')).toHaveAccessibleDescription('Accept the terms to continue');
    await userEvent.click(canvas.getByRole('checkbox'));
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('true');
  },
};

export const Switch: Story = {
  render: () => (
    <FieldHarness defaultValue={true}>
      <SwitchField label="Email notifications" description="Sent when someone mentions you" />
    </FieldHarness>
  ),
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('switch', {name: 'Email notifications'}));
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('false');
  },
};
