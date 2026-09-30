import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {TextField} from './fields/TextField.js';
import {FieldHarness} from './test/FieldHarness.js';

const required = (value: unknown) => (value ? undefined : 'Required');

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
});
