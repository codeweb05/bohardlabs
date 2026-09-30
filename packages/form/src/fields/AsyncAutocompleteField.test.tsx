import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {FieldHarness} from '../test/FieldHarness';
import {AsyncAutocompleteField} from './AsyncAutocompleteField';

interface User {
  readonly id: number;
  readonly name: string;
}

const USERS: User[] = [
  {id: 1, name: 'Ada Lovelace'},
  {id: 2, name: 'Alan Turing'},
  {id: 3, name: 'Grace Hopper'},
];

const search = async (query: string) => USERS.filter((user) => user.name.toLowerCase().includes(query.toLowerCase()));

const common = {
  label: 'Owner',
  getOptionValue: (user: User) => user.id,
  getOptionLabel: (user: User) => user.name,
  debounceMs: 0,
};

describe('AsyncAutocompleteField', () => {
  it('searches, and stores the whole item', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <AsyncAutocompleteField {...common} loadOptions={search} />
      </FieldHarness>,
    );
    await user.type(screen.getByRole('combobox', {name: 'Owner'}), 'gra');
    await user.click(await screen.findByRole('option', {name: 'Grace Hopper'}));
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('{"id":3,"name":"Grace Hopper"}');
  });

  it('shows a saved item before any search', () => {
    render(
      <FieldHarness defaultValue={USERS[1]}>
        <AsyncAutocompleteField {...common} loadOptions={search} />
      </FieldHarness>,
    );
    expect(screen.getByRole('combobox', {name: 'Owner'})).toHaveValue('Alan Turing');
  });

  it('shows the load failure inside the list', async () => {
    const user = userEvent.setup();
    const failing = async (): Promise<User[]> => {
      throw new Error('500');
    };
    render(
      <FieldHarness defaultValue={null}>
        <AsyncAutocompleteField {...common} loadOptions={failing} />
      </FieldHarness>,
    );
    await user.type(screen.getByRole('combobox', {name: 'Owner'}), 'a');
    expect(await screen.findByText('Could not load options')).toBeInTheDocument();
  });

  it('stores an array with multiple', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={[USERS[0]]}>
        <AsyncAutocompleteField {...common} label="Reviewers" loadOptions={search} multiple />
      </FieldHarness>,
    );
    await user.type(screen.getByRole('combobox', {name: 'Reviewers'}), 'alan');
    await user.click(await screen.findByRole('option', {name: 'Alan Turing'}));
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    await waitFor(() => expect(screen.getByLabelText('Submitted value')).toHaveTextContent('[{"id":1,'));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('"Alan Turing"');
  });
});
