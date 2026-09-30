import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, userEvent, within} from 'storybook/test';

import {PhoneField} from '../phone/PhoneField.js';
import {FieldHarness} from '../test/FieldHarness.js';

const meta = {
  title: 'Form/Phone',
  component: PhoneField,
  tags: ['autodocs'],
  args: {
    label: 'Phone',
    description: 'We text you when the job starts',
    defaultCountry: 'IN',
    preferredCountries: ['IN', 'DE', 'GB'],
  },
  render: (args) => (
    <FieldHarness defaultValue={null}>
      <PhoneField {...args} />
    </FieldHarness>
  ),
} satisfies Meta<typeof PhoneField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The form value is E.164; the input keeps the user's formatting. */
export const Default: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Phone');
    // `{End}` because this `userEvent` clicks synthetically, and in Chromium that leaves the
    // caret at 0, before the prefilled `+91`. A real click (checked through Playwright) lands
    // where the pointer is, as in a plain text field, so users do not hit this.
    await userEvent.click(input);
    await userEvent.keyboard('{End}9876543210');
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('"+919876543210"');
  },
};
