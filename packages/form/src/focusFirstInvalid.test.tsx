import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {createAppForm} from './createAppForm.js';
import {TextField} from './fields/TextField.js';
import {FieldHarness} from './test/FieldHarness.js';

const required = (value: unknown) => (value ? undefined : 'Required');

const {useAppForm} = createAppForm({fieldComponents: {TextField}, formComponents: {}});

/** The first field is locked (set elsewhere in the app) and both are required. */
function TwoFields() {
  const form = useAppForm({defaultValues: {account: '', reason: ''}});
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="account" validators={{onSubmit: ({value}) => required(value)}}>
        {(field) => <field.TextField label="Account" disabled />}
      </form.AppField>
      <form.AppField name="reason" validators={{onSubmit: ({value}) => required(value)}}>
        {(field) => <field.TextField label="Reason" />}
      </form.AppField>
      <button type="submit">Save</button>
    </form>
  );
}

describe('an invalid submit', () => {
  it('focuses the invalid field of the form that was submitted, not another form on the page', async () => {
    const user = userEvent.setup();
    render(
      <>
        <section aria-label="Form A">
          <FieldHarness defaultValue="" validate={required}>
            <TextField label="A name" />
          </FieldHarness>
        </section>
        <section aria-label="Form B">
          <FieldHarness defaultValue="" validate={required}>
            <TextField label="B name" />
          </FieldHarness>
        </section>
      </>,
    );

    // Make form A invalid and visible first, so a query that ignored the form id would pick it.
    await user.click(screen.getByLabelText('A name'));
    await user.tab();
    expect(screen.getByLabelText('A name')).toHaveAttribute('aria-invalid', 'true');

    const [, submitB] = screen.getAllByRole('button', {name: 'Submit'});
    await user.click(submitB!);

    await waitFor(() => expect(screen.getByLabelText('B name')).toHaveFocus());
  });

  it('leaves focus where it is when the invalid field of the submitted form is not on screen', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <>
        <section aria-label="Form A">
          <FieldHarness defaultValue="" validate={required}>
            <TextField label="A name" />
          </FieldHarness>
        </section>
        <section aria-label="Form B">
          {/* The invalid field has no input on this step, as in a wizard that hides it. */}
          <FieldHarness defaultValue="" validate={required} onSubmit={onSubmit}>
            <p>Step 2 of 2</p>
          </FieldHarness>
        </section>
      </>,
    );

    // Form A shows an error, so a search that fell back to any invalid field would land there.
    await user.click(screen.getByLabelText('A name'));
    await user.tab();
    expect(screen.getByLabelText('A name')).toHaveAttribute('aria-invalid', 'true');

    const [, submitB] = screen.getAllByRole('button', {name: 'Submit'});
    await user.click(submitB!);
    // The focus move waits a tick; give it time to have run.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(submitB).toHaveFocus();
  });

  it('skips an invalid field that cannot take focus and lands on the next one', async () => {
    const user = userEvent.setup();
    render(<TwoFields />);

    await user.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => expect(screen.getByLabelText('Reason')).toHaveFocus());
    expect(screen.getByLabelText('Account')).toHaveAttribute('aria-invalid', 'true');
  });
});
