import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, userEvent, within} from 'storybook/test';

import {TextArea} from '../fields/TextArea.js';
import {TextField} from '../fields/TextField.js';
import {FieldHarness} from '../test/FieldHarness.js';

const meta = {
  title: 'Form/Text fields',
  component: TextField,
  tags: ['autodocs'],
  args: {label: 'Email', description: 'We only use it to sign you in', required: true, tooltip: 'Your work address'},
  render: (args) => (
    <FieldHarness defaultValue="" validate={(value) => (value ? undefined : 'Enter your email')}>
      <TextField {...args} type="email" />
    </FieldHarness>
  ),
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Blur an empty required field and the description gives way to the error. */
export const Default: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText(/Email/);
    await userEvent.click(input);
    await userEvent.tab();
    await expect(input).toHaveAccessibleDescription('Enter your email');
    await userEvent.type(input, 'ada@example.com');
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('"ada@example.com"');
  },
};

/** `TextArea` is `TextField` with `multiline` and three rows to start. */
export const Area: Story = {
  render: () => (
    <FieldHarness defaultValue="">
      <TextArea label="Notes" />
    </FieldHarness>
  ),
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Notes'), 'Line one{enter}Line two');
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('"Line one\\nLine two"');
  },
};
