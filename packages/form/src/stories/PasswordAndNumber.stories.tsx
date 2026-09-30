import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, userEvent, within} from 'storybook/test';

import {NumberField} from '../fields/NumberField.js';
import {PasswordField} from '../fields/PasswordField.js';
import {FieldHarness} from '../test/FieldHarness.js';

const meta = {
  title: 'Form/Password and number',
  component: PasswordField,
  tags: ['autodocs'],
  args: {label: 'Password', required: true},
  render: (args) => (
    <FieldHarness defaultValue="">
      <PasswordField {...args} />
    </FieldHarness>
  ),
} satisfies Meta<typeof PasswordField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The toggle's name says what pressing it will do. */
export const Password: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText(/Password/);
    await userEvent.type(input, 'hunter2');
    await userEvent.click(canvas.getByRole('button', {name: 'Show password'}));
    await expect(input).toHaveAttribute('type', 'text');
  },
};

/** A comma separator on screen, a plain number in the form. */
export const NumberStory: Story = {
  name: 'Number',
  render: () => (
    <FieldHarness defaultValue={null}>
      <NumberField label="Price" decimalSeparator="," description="In euros" />
    </FieldHarness>
  ),
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Price'), '19,99');
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('19.99');
  },
};
