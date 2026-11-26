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

const gracePeriod = (value: unknown) =>
  typeof value === 'number' && (value < 5 || value > 120) ? 'Must be between 5 and 120' : undefined;

/**
 * The unit sits at the end of the input and the range shows under it while the user types.
 * The arrow keys step by `step` and stop at the bounds. A typed value past them stays on
 * screen and the validator rejects it, so the schema is still the one place a value fails.
 */
export const NumberWithUnitAndRange: Story = {
  name: 'Number with unit and range',
  render: () => (
    <FieldHarness defaultValue={110} validate={gracePeriod}>
      <NumberField label="Grace period" unit="minutes" min={5} max={120} step={5} allowDecimals={false} />
    </FieldHarness>
  ),
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('spinbutton', {name: 'Grace period'});
    await expect(canvas.getByText('Between 5 and 120')).toBeVisible();

    await userEvent.click(input);
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    await expect(input).toHaveValue('120');
    await expect(input).toHaveAttribute('aria-valuenow', '120');

    await userEvent.clear(input);
    await userEvent.type(input, '500');
    await userEvent.tab();
    await expect(input).toHaveValue('500');
    await expect(await canvas.findByText('Must be between 5 and 120')).toBeVisible();
  },
};
