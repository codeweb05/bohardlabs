import type {Meta, StoryObj} from '@storybook/react-vite';
import {useEffect, useState} from 'react';
import {expect, screen, userEvent, waitFor, within} from 'storybook/test';

import type {Option} from '../core/types';
import {SelectField} from '../fields/SelectField';
import {FieldHarness} from '../test/FieldHarness';

const TEAMS: Option<string>[] = [
  {value: 'design', label: 'Design'},
  {value: 'platform', label: 'Platform'},
  {value: 'support', label: 'Support'},
];

/**
 * Stands in for TanStack Query's `useQuery`, with the three fields the recipe reads. The
 * package does not depend on a query library; the consumer's hook goes here.
 */
function useFakeTeamsQuery(fail: boolean) {
  const [state, setState] = useState<{data?: Option<string>[]; isPending: boolean; isError: boolean}>({
    isPending: true,
    isError: false,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setState(fail ? {isPending: false, isError: true} : {data: TEAMS, isPending: false, isError: false});
    }, 400);
    return () => clearTimeout(timer);
  }, [fail]);

  return state;
}

interface TeamSelectProps {
  readonly fail: boolean;
}

/** The README recipe, with the fake hook in place of `useQuery`. */
function TeamSelect({fail}: TeamSelectProps) {
  const teams = useFakeTeamsQuery(fail);

  let description: string | undefined;
  if (teams.isPending) description = 'Loading teams…';
  else if (teams.isError) description = 'Could not load teams. Reload to try again.';

  return (
    <SelectField
      label="Team"
      options={teams.data ?? []}
      placeholder="Pick a team"
      disabled={teams.isPending || teams.isError}
      description={description}
    />
  );
}

function Demo({fail}: TeamSelectProps) {
  // An edit form: the saved value is in the form before its option has loaded.
  return (
    <FieldHarness defaultValue="platform">
      <TeamSelect fail={fail} />
    </FieldHarness>
  );
}

const meta = {
  title: 'Form/Recipes/Select fed by a query',
  component: Demo,
  args: {fail: false},
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Disabled with a loading line, then the saved choice shows once its option arrives. */
export const Loaded: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole('combobox', {name: /Team/});
    await expect(select).toHaveAttribute('aria-disabled', 'true');
    await expect(select).toHaveAccessibleDescription('Loading teams…');

    await waitFor(() => expect(select).not.toHaveAttribute('aria-disabled'));
    await expect(select).toHaveTextContent('Platform');
    await userEvent.click(select);
    // The menu is portalled to the body, outside the canvas.
    await expect(await screen.findByRole('option', {name: 'Design'})).toBeInTheDocument();
    await expect(screen.getByRole('option', {name: 'Support'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', {name: 'Support'}));
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('"support"');
  },
};

/** The query failed: the field stays disabled and says why. The form value is untouched. */
export const Failed: Story = {
  args: {fail: true},
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole('combobox', {name: /Team/});
    await expect(select).toHaveAccessibleDescription('Loading teams…');
    await waitFor(() => expect(select).toHaveAccessibleDescription('Could not load teams. Reload to try again.'));
    await expect(select).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('"platform"');
  },
};
