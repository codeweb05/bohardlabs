import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, screen, userEvent, within} from 'storybook/test';

import {AsyncAutocompleteField} from '../fields/AsyncAutocompleteField';
import {FieldHarness} from '../test/FieldHarness';

interface Member {
  readonly id: string;
  readonly name: string;
}

const MEMBERS: Member[] = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Katherine Johnson', 'Margaret Hamilton'].map(
  (name) => ({
    id: name.toLowerCase().replace(' ', '-'),
    name,
  }),
);

/** A fake server: 400 ms, and it honours the abort signal. */
function searchMembers(query: string, {signal}: {signal: AbortSignal}): Promise<Member[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => resolve(MEMBERS.filter((member) => member.name.toLowerCase().includes(query.toLowerCase()))),
      400,
    );
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

function Demo() {
  return (
    <FieldHarness defaultValue={null}>
      <AsyncAutocompleteField<Member>
        label="Owner"
        placeholder="Search people"
        loadOptions={searchMembers}
        getOptionValue={(member) => member.id}
        getOptionLabel={(member) => member.name}
        minQueryLength={1}
      />
    </FieldHarness>
  );
}

const meta = {
  title: 'Form/Async autocomplete',
  component: Demo,
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Typing shows a loading row, then the matches; the form stores the whole member. */
export const Default: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('combobox', {name: 'Owner'}), 'hop');
    await userEvent.click(await screen.findByRole('option', {name: 'Grace Hopper'}, {timeout: 3000}));
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('"grace-hopper"');
  },
};
