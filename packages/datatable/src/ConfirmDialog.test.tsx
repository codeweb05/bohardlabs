/**
 * `ConfirmDialog` is exported, so these are the promises a consumer gets to rely on rather
 * than incidental behaviour. `ConfigContext.test.tsx` covers the other direction: the table
 * rendering this one, or the consumer's replacement, through `slots.confirmDialog`.
 *
 * Nothing here mounts a provider. That is the point: the dialog has to work on a detail
 * page with no `DataTable` anywhere above it.
 */
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {ConfirmDialog} from './ConfirmDialog';
import {DEFAULT_LABELS} from './i18n';
import {render, screen, waitFor} from './test/test-utils';

const BASE = {
  open: true,
  title: 'Delete order',
  message: 'This cannot be undone.',
} as const;

/** A promise the test settles by hand, so the in-flight state can be asserted on. */
function deferred() {
  let settle!: (failWith?: Error) => void;
  const promise = new Promise<void>((resolve, reject) => {
    settle = (failWith) => (failWith ? reject(failWith) : resolve());
  });
  return {promise, settle};
}

describe('ConfirmDialog', () => {
  it('renders the title, the message and English buttons with no provider above it', () => {
    render(<ConfirmDialog {...BASE} onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByText('Delete order')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: DEFAULT_LABELS.cancel})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: DEFAULT_LABELS.confirm})).toBeInTheDocument();
  });

  it('renders nothing while closed', () => {
    render(<ConfirmDialog {...BASE} open={false} onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('takes a verb for the action in place of the default confirm label', () => {
    render(
      <ConfirmDialog {...BASE} confirmLabel="Delete" cancelLabel="Keep it" onClose={vi.fn()} onConfirm={vi.fn()} />,
    );

    expect(screen.getByRole('button', {name: 'Delete'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Keep it'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: DEFAULT_LABELS.confirm})).not.toBeInTheDocument();
  });

  it('cancels without running the action', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...BASE} onClose={onClose} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.cancel}));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('runs the action on confirm, and leaves closing to the caller', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...BASE} onClose={onClose} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.confirm}));

    expect(onConfirm).toHaveBeenCalledOnce();
    // `open` is the caller's state. A dialog that closed itself would flicker back open.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('disables both buttons while an async onConfirm is in flight, and re-enables after', async () => {
    const {promise, settle} = deferred();
    render(<ConfirmDialog {...BASE} onClose={vi.fn()} onConfirm={() => promise} />);

    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.confirm}));

    const cancel = screen.getByRole('button', {name: DEFAULT_LABELS.cancel});
    const confirm = screen.getByRole('button', {name: DEFAULT_LABELS.confirm});
    await waitFor(() => expect(cancel).toBeDisabled());
    expect(confirm).toBeDisabled();
    expect(screen.getByRole('progressbar', {hidden: true})).toBeInTheDocument();

    settle();
    await waitFor(() => expect(cancel).toBeEnabled());
    expect(confirm).toBeEnabled();
    expect(screen.queryByRole('progressbar', {hidden: true})).not.toBeInTheDocument();
  });

  it('re-enables after a failed action instead of leaving the dialog stuck', async () => {
    const {promise, settle} = deferred();
    render(<ConfirmDialog {...BASE} onClose={vi.fn()} onConfirm={() => promise} />);

    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.confirm}));
    settle(new Error('server said no'));

    // The rejection is swallowed on purpose: reporting it is the caller's job, and an
    // unhandled rejection here would surface in their app. The user can retry or cancel.
    await waitFor(() => expect(screen.getByRole('button', {name: DEFAULT_LABELS.cancel})).toBeEnabled());
    expect(screen.getByRole('button', {name: DEFAULT_LABELS.confirm})).toBeEnabled();
  });

  it('shows the caller-reported pending state the same way as its own', () => {
    render(<ConfirmDialog {...BASE} isLoading onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByRole('button', {name: DEFAULT_LABELS.cancel})).toBeDisabled();
    expect(screen.getByRole('button', {name: DEFAULT_LABELS.confirm})).toBeDisabled();
    expect(screen.getByRole('progressbar', {hidden: true})).toBeInTheDocument();
  });

  /**
   * The spinner replaces the label, so without an explicit name the button loses its
   * accessible name mid-action. axe reports it as `button-name`, and a consumer's
   * `getByRole('button', {name: 'Delete'})` stops matching halfway through a test.
   */
  it('keeps the confirm button findable by its label while the action runs', async () => {
    const {promise, settle} = deferred();
    render(<ConfirmDialog {...BASE} confirmLabel="Delete" onClose={vi.fn()} onConfirm={() => promise} />);

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    const confirm = screen.getByRole('button', {name: 'Delete'});
    await waitFor(() => expect(confirm).toHaveAttribute('aria-busy', 'true'));
    expect(confirm).toHaveTextContent('');

    settle();
    await waitFor(() => expect(confirm).toHaveAttribute('aria-busy', 'false'));
    expect(confirm).toHaveTextContent('Delete');
  });

  it('escape does not dismiss a dialog whose action is still running', async () => {
    const onClose = vi.fn();
    render(<ConfirmDialog {...BASE} isLoading onClose={onClose} onConfirm={vi.fn()} />);

    await userEvent.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
  });

  it('escape dismisses an idle dialog', async () => {
    const onClose = vi.fn();
    render(<ConfirmDialog {...BASE} onClose={onClose} onConfirm={vi.fn()} />);

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
  });
});
