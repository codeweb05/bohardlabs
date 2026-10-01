import type {AnyFormApi} from '@tanstack/react-form';
import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createRef} from 'react';

import {applyServerErrors} from '../serverErrors.js';
import {BERLIN, createFakePlaces} from '../test/fakePlaces.js';
import {FieldHarness} from '../test/FieldHarness.js';
import {AddressField} from './AddressField.js';
import {EMPTY_ADDRESS} from './types.js';
import type {PlacesProvider} from './types.js';

describe('AddressField', () => {
  it('fills every part from a search, and keeps a manual edit', async () => {
    const user = userEvent.setup();
    const {provider} = createFakePlaces([BERLIN]);
    render(
      <FieldHarness defaultValue={EMPTY_ADDRESS}>
        <AddressField label="Billing address" provider={provider} debounceMs={0} />
      </FieldHarness>,
    );
    expect(screen.getByRole('group', {name: 'Billing address'})).toBeInTheDocument();

    await user.type(screen.getByRole('combobox', {name: 'Search for an address'}), 'unter');
    await user.click(await screen.findByRole('option', {name: 'Unter den Linden 1, Berlin'}));
    expect(screen.getByLabelText('City')).toHaveValue('Berlin');

    await user.type(screen.getByLabelText('Address line 2'), 'Floor 3');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(JSON.parse(screen.getByLabelText('Submitted value').textContent ?? '')).toEqual({
      ...BERLIN.address,
      line2: 'Floor 3',
    });
  });

  it('shows a failed lookup, keeps the parts, and drops it on a manual edit', async () => {
    const user = userEvent.setup();
    const {provider} = createFakePlaces([BERLIN]);
    const failing: PlacesProvider = {...provider, resolve: () => Promise.reject(new Error('no location'))};
    render(
      <FieldHarness defaultValue={{...EMPTY_ADDRESS, city: 'Pune'}}>
        <AddressField label="Billing address" provider={failing} debounceMs={0} />
      </FieldHarness>,
    );
    const search = screen.getByRole('combobox', {name: 'Search for an address'});
    await user.type(search, 'unter');
    await user.click(await screen.findByRole('option', {name: 'Unter den Linden 1, Berlin'}));

    expect(await screen.findByText('Could not look up that place')).toBeInTheDocument();
    expect(search).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('City')).toHaveValue('Pune');

    await user.type(screen.getByLabelText('Postal code'), '411004');

    expect(screen.queryByText('Could not look up that place')).not.toBeInTheDocument();
    expect(search).toHaveAttribute('aria-invalid', 'false');
  });

  it('marks line 1, city, postal code and country as required', () => {
    const {provider} = createFakePlaces([]);
    render(
      <FieldHarness defaultValue={EMPTY_ADDRESS}>
        <AddressField label="Address" provider={provider} required />
      </FieldHarness>,
    );
    expect(screen.getByLabelText(/Address line 1/)).toBeRequired();
    expect(screen.getByLabelText(/City/)).toBeRequired();
    expect(screen.getByLabelText(/Address line 2/)).not.toBeRequired();
    expect(screen.getByLabelText(/State or region/)).not.toBeRequired();
  });

  it('shows a server error on the part it names', () => {
    const formRef = createRef<AnyFormApi>();
    const {provider} = createFakePlaces([]);
    render(
      <FieldHarness defaultValue={EMPTY_ADDRESS} formRef={formRef}>
        <AddressField label="Address" provider={provider} />
      </FieldHarness>,
    );
    act(() => {
      if (formRef.current)
        applyServerErrors(formRef.current, {fields: {'value.postalCode': 'We do not deliver there'}});
    });
    expect(screen.getByLabelText('Postal code')).toHaveAccessibleDescription('We do not deliver there');
  });

  it("drops a part's server error once a pick replaces that part", async () => {
    const user = userEvent.setup();
    const formRef = createRef<AnyFormApi>();
    const {provider} = createFakePlaces([BERLIN]);
    render(
      <FieldHarness defaultValue={EMPTY_ADDRESS} formRef={formRef}>
        <AddressField label="Address" provider={provider} debounceMs={0} />
      </FieldHarness>,
    );
    act(() => {
      if (formRef.current)
        applyServerErrors(formRef.current, {fields: {'value.postalCode': 'We do not deliver there'}});
    });
    expect(screen.getByText('We do not deliver there')).toBeInTheDocument();

    await user.type(screen.getByRole('combobox', {name: 'Search for an address'}), 'unter');
    await user.click(await screen.findByRole('option', {name: 'Unter den Linden 1, Berlin'}));

    await waitFor(() => expect(screen.getByLabelText('City')).toHaveValue('Berlin'));
    expect(screen.queryByText('We do not deliver there')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Postal code')).toHaveAttribute('aria-invalid', 'false');
  });

  it('drops a server error on the address itself once the user corrects a part', async () => {
    const user = userEvent.setup();
    const formRef = createRef<AnyFormApi>();
    const onSubmit = vi.fn();
    const {provider} = createFakePlaces([]);
    render(
      <FieldHarness defaultValue={BERLIN.address} formRef={formRef} onSubmit={onSubmit}>
        <AddressField label="Address" provider={provider} />
      </FieldHarness>,
    );
    act(() => {
      if (formRef.current) applyServerErrors(formRef.current, {fields: {value: 'We cannot deliver to this address'}});
    });
    expect(screen.getByText('We cannot deliver to this address')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Postal code'), '9');

    expect(screen.queryByText('We cannot deliver to this address')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });
});
