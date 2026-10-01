import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {createAppForm} from '../createAppForm.js';
import {TextField} from '../fields/TextField.js';
import {CancelButton} from './CancelButton.js';
import {SubmitButton} from './SubmitButton.js';

const {useAppForm} = createAppForm({fieldComponents: {TextField}, formComponents: {SubmitButton, CancelButton}});

interface EditorProps {
  readonly onSubmit?: () => Promise<void>;
  readonly onCancel?: () => void;
  readonly confirm?: () => Promise<boolean>;
  readonly required?: boolean;
}

function Editor({onSubmit = async () => {}, onCancel = () => {}, confirm, required}: EditorProps) {
  const form = useAppForm({defaultValues: {name: ''}, onSubmit});
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField
        name="name"
        validators={required ? {onSubmit: ({value}) => (value ? undefined : 'Required')} : undefined}
      >
        {(field) => <field.TextField label="Name" />}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton submittingLabel="Saving…">Save</form.SubmitButton>
        <form.CancelButton onCancel={onCancel} confirm={confirm} />
      </form.AppForm>
    </form>
  );
}

describe('SubmitButton', () => {
  it('stays enabled while the form is invalid', async () => {
    const user = userEvent.setup();
    render(<Editor required />);
    const button = screen.getByRole('button', {name: 'Save'});

    await user.click(button);

    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(button).toBeEnabled();
  });

  it('is disabled and busy while submitting, then returns', async () => {
    const user = userEvent.setup();
    let finish = () => {};
    const onSubmit = () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      });
    render(<Editor onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', {name: 'Save'}));
    const busy = screen.getByRole('button', {name: 'Saving…'});
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');

    finish();
    expect(await screen.findByRole('button', {name: 'Save'})).toBeEnabled();
  });
});

describe('CancelButton', () => {
  it('cancels a pristine form without asking', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const confirm = vi.fn(async () => false);
    render(<Editor onCancel={onCancel} confirm={confirm} />);

    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(confirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('cancels a dirty form at once when there is no confirm', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Editor onCancel={onCancel} />);

    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('asks before throwing away edits, and respects a no', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const confirm = vi.fn(async () => false);
    render(<Editor onCancel={onCancel} confirm={confirm} />);

    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.click(screen.getByRole('button', {name: 'Cancel'}));

    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels a dirty form once the user confirms', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Editor onCancel={onCancel} confirm={async () => true} />);

    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.click(screen.getByRole('button', {name: 'Cancel'}));

    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
  });

  it('stays put when the confirm rejects, without an unhandled rejection', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const confirm = vi.fn(() => Promise.reject(new Error('dialog unmounted')));
    render(<Editor onCancel={onCancel} confirm={confirm} />);

    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('asks once when Cancel is clicked again while the confirm is still open', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    let answer: (leave: boolean) => void = () => {};
    const confirm = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
        }),
    );
    render(<Editor onCancel={onCancel} confirm={confirm} />);

    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    await act(async () => answer(true));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);

    // A second cancel after the first one settled asks again.
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});
