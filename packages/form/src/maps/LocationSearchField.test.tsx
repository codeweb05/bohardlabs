import type {AnyFormApi} from '@tanstack/react-form';
import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createRef} from 'react';

import {BERLIN, PUNE, createFakePlaces} from '../test/fakePlaces.js';
import {FieldHarness} from '../test/FieldHarness.js';
import {LocationSearchField} from './LocationSearchField.js';
import type {PlacesProvider, ResolvedPlace} from './types.js';

const FAILED = 'Could not look up that place';

/** A fake whose lookups always reject. */
function failingPlaces(places: readonly ResolvedPlace[]): PlacesProvider {
  const {provider} = createFakePlaces(places);
  return {...provider, resolve: () => Promise.reject(new Error('no location'))};
}

/** Types a query and picks the option with this name. */
async function pickPlace(user: ReturnType<typeof userEvent.setup>, query: string, option: string) {
  const input = screen.getByRole('combobox', {name: 'Pickup'});
  await user.type(input, query);
  await user.click(await screen.findByRole('option', {name: option}));
  return input;
}

describe('LocationSearchField', () => {
  it('stores the resolved place', async () => {
    const user = userEvent.setup();
    const {provider} = createFakePlaces([BERLIN, PUNE]);
    render(
      <FieldHarness defaultValue={null}>
        <LocationSearchField label="Pickup" provider={provider} debounceMs={0} />
      </FieldHarness>,
    );
    await user.type(screen.getByRole('combobox', {name: 'Pickup'}), 'pune');
    await user.click(await screen.findByRole('option', {name: 'FC Road, Pune'}));
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent(
      '{"id":"pune","label":"FC Road, Pune","lat":18.52,"lng":73.84}',
    );
  });

  it('asks nothing below three characters', async () => {
    const user = userEvent.setup();
    const {provider, log} = createFakePlaces([BERLIN]);
    render(
      <FieldHarness defaultValue={null}>
        <LocationSearchField label="Pickup" provider={provider} debounceMs={0} />
      </FieldHarness>,
    );
    await user.type(screen.getByRole('combobox', {name: 'Pickup'}), 'be');
    expect(log.suggestSessions).toHaveLength(0);
  });

  it('uses one session per search-and-pick, and a new one for the next search', async () => {
    const user = userEvent.setup();
    const {provider, log} = createFakePlaces([BERLIN, PUNE]);
    render(
      <FieldHarness defaultValue={null}>
        <LocationSearchField label="Pickup" provider={provider} debounceMs={0} />
      </FieldHarness>,
    );
    const input = screen.getByRole('combobox', {name: 'Pickup'});
    await user.type(input, 'unter');
    await user.click(await screen.findByRole('option', {name: 'Unter den Linden 1, Berlin'}));
    expect(log.sessions).toHaveLength(1);
    expect(new Set([...log.suggestSessions, ...log.resolveSessions]).size).toBe(1);

    await user.clear(input);
    await user.type(input, 'pune');
    await screen.findByRole('option', {name: 'FC Road, Pune'});
    expect(log.sessions).toHaveLength(2);
  });

  it('shows a failed lookup and stores nothing', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <LocationSearchField label="Pickup" provider={failingPlaces([PUNE])} debounceMs={0} />
      </FieldHarness>,
    );
    const input = await pickPlace(user, 'pune', 'FC Road, Pune');

    expect(await screen.findByText(FAILED)).toBeInTheDocument();
    expect(input).toHaveAccessibleDescription(FAILED);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('null');
  });

  it('shows a validation error in place of a failed lookup', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null} validate={(value) => (value ? undefined : 'Pick a pickup point')}>
        <LocationSearchField label="Pickup" provider={failingPlaces([PUNE])} debounceMs={0} />
      </FieldHarness>,
    );
    const input = await pickPlace(user, 'pune', 'FC Road, Pune');
    await screen.findByText(FAILED);

    await user.click(screen.getByRole('button', {name: 'Submit'}));

    expect(await screen.findByText('Pick a pickup point')).toBeInTheDocument();
    expect(screen.queryByText(FAILED)).not.toBeInTheDocument();
    expect(input).toHaveAccessibleDescription('Pick a pickup point');
  });

  it('drops a failed lookup when the form is reset', async () => {
    const user = userEvent.setup();
    const formRef = createRef<AnyFormApi>();
    render(
      <FieldHarness defaultValue={null} formRef={formRef}>
        <LocationSearchField label="Pickup" provider={failingPlaces([PUNE])} debounceMs={0} />
      </FieldHarness>,
    );
    const input = await pickPlace(user, 'pune', 'FC Road, Pune');
    await screen.findByText(FAILED);

    act(() => formRef.current?.reset());

    expect(screen.queryByText(FAILED)).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  it('drops a failed lookup when the user clears the search', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <LocationSearchField label="Pickup" provider={failingPlaces([PUNE])} debounceMs={0} />
      </FieldHarness>,
    );
    const input = await pickPlace(user, 'pune', 'FC Road, Pune');
    await screen.findByText(FAILED);

    await user.clear(input);

    expect(screen.queryByText(FAILED)).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  it('keeps only the latest pick when an earlier lookup answers last', async () => {
    const user = userEvent.setup();
    const {provider} = createFakePlaces([BERLIN, PUNE]);
    const pending = new Map<string, () => void>();
    const slow: PlacesProvider = {
      ...provider,
      resolve: (id, options) =>
        new Promise((resolve, reject) => {
          pending.set(id, () => {
            provider.resolve(id, options).then(resolve, reject);
          });
        }),
    };
    render(
      <FieldHarness defaultValue={null}>
        <LocationSearchField label="Pickup" provider={slow} debounceMs={0} />
      </FieldHarness>,
    );
    const input = await pickPlace(user, 'unter', 'Unter den Linden 1, Berlin');
    await user.clear(input);
    await pickPlace(user, 'pune', 'FC Road, Pune');

    await act(async () => pending.get('pune')?.());
    await act(async () => pending.get('berlin')?.());

    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('"id":"pune"');
  });

  it('keeps what the user is typing when the field re-renders', async () => {
    const user = userEvent.setup();
    const {provider} = createFakePlaces([BERLIN, PUNE]);
    const field = (description: string) => (
      <FieldHarness defaultValue={BERLIN}>
        <LocationSearchField label="Pickup" description={description} provider={provider} debounceMs={0} />
      </FieldHarness>
    );
    const {rerender} = render(field('Where we collect'));
    const input = screen.getByRole('combobox', {name: 'Pickup'});
    await user.tripleClick(input);
    await user.keyboard('pun');

    rerender(field('Where we collect it'));

    expect(input).toHaveValue('pun');
  });

  it('shows a stored place', () => {
    const {provider} = createFakePlaces([]);
    render(
      <FieldHarness defaultValue={{id: 'berlin', label: 'Unter den Linden 1, Berlin', lat: 52.5, lng: 13.4}}>
        <LocationSearchField label="Pickup" provider={provider} />
      </FieldHarness>,
    );
    expect(screen.getByRole('combobox', {name: 'Pickup'})).toHaveValue('Unter den Linden 1, Berlin');
  });
});
