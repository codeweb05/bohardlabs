import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {BERLIN, PUNE, createFakePlaces} from '../test/fakePlaces';
import {FieldHarness} from '../test/FieldHarness';
import {LocationSearchField} from './LocationSearchField';

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
    const {provider} = createFakePlaces([PUNE]);
    const failing = {...provider, resolve: () => Promise.reject(new Error('no location'))};
    render(
      <FieldHarness defaultValue={null}>
        <LocationSearchField label="Pickup" provider={failing} debounceMs={0} />
      </FieldHarness>,
    );
    const input = screen.getByRole('combobox', {name: 'Pickup'});
    await user.type(input, 'pune');
    await user.click(await screen.findByRole('option', {name: 'FC Road, Pune'}));

    expect(await screen.findByText('Could not look up that place')).toBeInTheDocument();
    expect(input).toHaveAccessibleDescription('Could not look up that place');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('null');
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
