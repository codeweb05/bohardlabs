import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type {Option} from '../core/types.js';
import {FieldHarness} from '../test/FieldHarness.js';
import {RadioGroupField} from './RadioGroupField.js';

const PLANS = [
  {value: 'free', label: 'Free'},
  {value: 'pro', label: 'Pro', description: 'Billed monthly'},
] as const;

describe('RadioGroupField', () => {
  it('is a group named by its legend, and stores the chosen value', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <RadioGroupField label="Plan" options={PLANS} />
      </FieldHarness>,
    );
    expect(screen.getByRole('group', {name: 'Plan'})).toBeInTheDocument();
    expect(screen.getByText('Billed monthly')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', {name: /Pro/}));
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('"pro"');
  });

  it('marks the radiogroup invalid, and an invalid submit focuses its first radio', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null} validate={(value) => (value === null ? 'Choose a plan' : undefined)}>
        <RadioGroupField label="Plan" options={PLANS} required />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('button', {name: 'Submit'}));

    const group = screen.getByRole('radiogroup');
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAccessibleDescription('Choose a plan');
    await waitFor(() => expect(screen.getByRole('radio', {name: 'Free'})).toHaveFocus());
  });

  it('puts autoFocus on the first radio only', () => {
    render(
      <FieldHarness defaultValue={null}>
        <RadioGroupField label="Plan" options={PLANS} autoFocus />
      </FieldHarness>,
    );
    expect(screen.getByRole('radio', {name: 'Free'})).toHaveFocus();
  });

  it('stores null, never undefined, for an option that arrived without a value', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    // What a consumer gets from an API row with a missing id: the compiler cannot see it.
    const partial = JSON.parse('[{"label": "Untitled"}]') as Option<string>[];
    render(
      <FieldHarness defaultValue="free" onSubmit={onSubmit}>
        <RadioGroupField label="Plan" options={[...PLANS, ...partial]} />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('radio', {name: 'Untitled'}));
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(onSubmit).toHaveBeenCalledWith(null);
  });
});
