import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, screen, userEvent, within} from 'storybook/test';

import {MultiSelectField} from '../fields/MultiSelectField.js';
import {SearchableSelectField} from '../fields/SearchableSelectField.js';
import {FieldHarness} from '../test/FieldHarness.js';

const TIMEZONES = ['Asia/Kolkata', 'Europe/Berlin', 'Europe/London', 'America/New_York', 'America/Los_Angeles'].map(
  (zone) => ({
    value: zone,
    label: zone.replace('_', ' '),
  }),
);

const meta = {
  title: 'Form/Searchable and multi select',
  component: SearchableSelectField<string>,
  tags: ['autodocs'],
  args: {label: 'Timezone', options: TIMEZONES, placeholder: 'Search timezones'},
  render: (args) => (
    <FieldHarness defaultValue={null}>
      <SearchableSelectField {...args} />
    </FieldHarness>
  ),
} satisfies Meta<typeof SearchableSelectField<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Searchable: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('combobox', {name: 'Timezone'}), 'berl');
    await userEvent.click(await screen.findByRole('option', {name: 'Europe/Berlin'}));
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('"Europe/Berlin"');
  },
};

export const Multi: Story = {
  render: () => (
    <FieldHarness defaultValue={['Europe/London']}>
      <MultiSelectField label="Timezones" options={TIMEZONES} searchable description="Shown on the team page" />
    </FieldHarness>
  ),
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('combobox', {name: 'Timezones'}), 'kol');
    await userEvent.click(await screen.findByRole('option', {name: 'Asia/Kolkata'}));
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('["Europe/London","Asia/Kolkata"]');
  },
};
