import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, screen, userEvent, within} from 'storybook/test';

import {RadioGroupField} from '../fields/RadioGroupField.js';
import {SelectField} from '../fields/SelectField.js';
import {FieldHarness} from '../test/FieldHarness.js';

const ROLES = [
  {value: 'admin', label: 'Admin', description: 'Manages users and billing'},
  {value: 'editor', label: 'Editor'},
  {value: 'viewer', label: 'Viewer'},
];

const meta = {
  title: 'Form/Select and radio',
  component: SelectField<string>,
  tags: ['autodocs'],
  args: {
    label: 'Role',
    options: ROLES,
    placeholder: 'Pick a role',
    emptyLabel: 'No role',
    tooltip: 'You can change this later',
  },
  render: (args) => (
    <FieldHarness defaultValue={null}>
      <SelectField {...args} />
    </FieldHarness>
  ),
} satisfies Meta<typeof SelectField<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Select: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {name: 'More information'})).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('combobox', {name: /Role/}));
    // The menu is portalled to the body, outside the canvas.
    await userEvent.click(await screen.findByRole('option', {name: /Editor/}));
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('"editor"');
  },
};

export const Radio: Story = {
  render: () => (
    <FieldHarness defaultValue={null}>
      <RadioGroupField label="Role" options={ROLES} tooltip="You can change this later" />
    </FieldHarness>
  ),
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', {name: /Admin/}));
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('"admin"');
  },
};
