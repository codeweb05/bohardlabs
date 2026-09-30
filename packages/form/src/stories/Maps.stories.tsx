import Stack from '@mui/material/Stack';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, screen, userEvent, within} from 'storybook/test';

import {AddressField} from '../maps/AddressField';
import {LocationSearchField} from '../maps/LocationSearchField';
import {EMPTY_ADDRESS} from '../maps/types';
import {BERLIN, PUNE, createFakePlaces} from '../test/fakePlaces';
import {FieldHarness} from '../test/FieldHarness';

const {provider} = createFakePlaces([BERLIN, PUNE]);

function Demo() {
  return (
    <Stack spacing={3}>
      <FieldHarness defaultValue={null}>
        <LocationSearchField label="Pickup point" provider={provider} placeholder="Type three letters" />
      </FieldHarness>
      <FieldHarness defaultValue={EMPTY_ADDRESS}>
        <AddressField label="Billing address" provider={provider} required />
      </FieldHarness>
    </Stack>
  );
}

const meta = {
  title: 'Form/Maps',
  component: Demo,
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Runs on a fake provider, so it needs no API key. In an app, load the Places library with
 * `importLibrary('places')` and pass it to `createGooglePlacesProvider`.
 */
export const Default: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('combobox', {name: 'Pickup point'}), 'unter');
    await userEvent.click(await screen.findByRole('option', {name: 'Unter den Linden 1, Berlin'}));
    await expect(canvas.getByRole('combobox', {name: 'Pickup point'})).toHaveValue('Unter den Linden 1, Berlin');

    await userEvent.type(canvas.getByRole('combobox', {name: 'Search for an address'}), 'pune');
    await userEvent.click(await screen.findByRole('option', {name: 'FC Road, Pune'}));
    await expect(canvas.getByLabelText(/City/)).toHaveValue('Pune');
    await expect(canvas.getByLabelText(/Postal code/)).toHaveValue('411004');
  },
};
