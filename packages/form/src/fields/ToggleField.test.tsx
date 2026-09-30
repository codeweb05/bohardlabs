import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {FieldHarness} from '../test/FieldHarness';
import {CheckboxField} from './CheckboxField';
import {SwitchField} from './SwitchField';

describe.each([
  ['CheckboxField', CheckboxField, 'checkbox'],
  ['SwitchField', SwitchField, 'switch'],
] as const)('%s', (_name, Field, role) => {
  it('toggles a boolean and labels the control with the field label', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={false}>
        <Field label="Send me updates" description="About once a month" />
      </FieldHarness>,
    );
    const control = screen.getByRole(role, {name: 'Send me updates'});
    expect(control).toHaveAccessibleDescription('About once a month');

    await user.click(control);
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('true');
  });

  it('shows an error after an invalid submit and marks the control invalid', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={false} validate={(value) => (value ? undefined : 'Accept the terms')}>
        <Field label="I accept the terms" required />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    const control = screen.getByRole(role, {name: /I accept the terms/});
    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control).toBeRequired();
    expect(control).toHaveAccessibleDescription('Accept the terms');
  });

  it('warns in development when the value is not a boolean', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <FieldHarness defaultValue="yes">
        <Field label="Flag" />
      </FieldHarness>,
    );
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
