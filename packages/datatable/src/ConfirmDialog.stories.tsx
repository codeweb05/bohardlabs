import Button from '@mui/material/Button';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {useState} from 'react';
import {expect, fn, screen, userEvent, waitFor} from 'storybook/test';

import {ConfirmDialog} from './ConfirmDialog';
import type {DataTableConfirmProps} from './types';

/**
 * Every story renders the trigger the dialog would really hang off, and opens from there.
 * A story that mounted the dialog open would stack a modal over the docs page, and it would
 * also skip the part worth showing: `open` belongs to the caller, and so does closing it.
 *
 * `open` from args seeds the state and nothing more, so `meta.render` keys this component
 * on it. Flipping the control remounts rather than syncing through an effect.
 */
function DeleteOrder({open, onClose, onConfirm, ...props}: Readonly<DataTableConfirmProps>) {
  const [isOpen, setIsOpen] = useState(open);

  return (
    <>
      <Button variant="outlined" onClick={() => setIsOpen(true)}>
        Delete order
      </Button>
      <ConfirmDialog
        {...props}
        open={isOpen}
        onClose={() => {
          setIsOpen(false);
          onClose();
        }}
        onConfirm={async () => {
          await onConfirm();
          setIsOpen(false);
        }}
      />
    </>
  );
}

const meta = {
  title: 'DataTable/ConfirmDialog',
  component: ConfirmDialog,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: [
          'The confirmation the table shows before a destructive bulk action, exported on its own',
          'so an app can use the same one on a detail page instead of building a near-match.',
          '',
          'It needs no provider. The two button labels come from `DEFAULT_LABELS` when there is no',
          '`DataTable` above it, and `confirmLabel` / `cancelLabel` override either way.',
          '',
          'Its props are `DataTableConfirmProps`, which is also the `slots.confirmDialog` contract:',
          'anything that renders these props can replace it inside the table, including a wrapper',
          'around this component.',
        ].join(' '),
      },
    },
  },
  args: {
    open: false,
    title: 'Delete order',
    message: 'SW-1000 will be removed. This cannot be undone.',
    onClose: fn(),
    onConfirm: fn(),
  },
  render: (args) => <DeleteOrder key={String(args.open)} {...args} />,
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The baseline. Cancel dismisses; the dialog reports it and changes no state of its own. */
export const Default: Story = {
  play: async ({args}) => {
    await userEvent.click(screen.getByRole('button', {name: 'Delete order'}));

    const dialog = await screen.findByRole('dialog');
    await expect(dialog).toHaveTextContent('This cannot be undone.');

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    await expect(args.onClose).toHaveBeenCalled();
    await expect(args.onConfirm).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  },
};

/**
 * What a delete should look like: the verb on the button rather than "Confirm", and the
 * palette's error colour, so the destructive choice is not the one that reads as default.
 */
export const Destructive: Story = {
  args: {confirmLabel: 'Delete', cancelLabel: 'Keep it', confirmColor: 'error'},
  play: async ({args}) => {
    await userEvent.click(screen.getByRole('button', {name: 'Delete order'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Delete'}));

    await expect(args.onConfirm).toHaveBeenCalled();
  },
};

/**
 * `onConfirm` may return a promise. While it runs, the dialog disables both buttons and
 * swaps the confirm label for a spinner, so the action cannot be fired twice and cannot be
 * dismissed out from under itself. The button keeps its name through the swap.
 */
export const Running: Story = {
  args: {
    confirmLabel: 'Delete',
    confirmColor: 'error',
    onConfirm: fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    }),
  },
  play: async () => {
    await userEvent.click(screen.getByRole('button', {name: 'Delete order'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Delete'}));

    await waitFor(() => expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled());
    await expect(screen.getByRole('button', {name: 'Delete'})).toHaveAttribute('aria-busy', 'true');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), {timeout: 3000});
  },
};

/**
 * The same pending state, driven from outside. A caller that already knows the action is in
 * flight (a mutation's `isPending`) passes `isLoading` rather than letting the dialog track
 * it, and the two combine.
 */
export const Pending: Story = {
  args: {open: true, isLoading: true, confirmLabel: 'Delete', confirmColor: 'error'},
  play: async () => {
    await screen.findByRole('dialog');

    await expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
    await expect(screen.getByRole('button', {name: 'Delete'})).toBeDisabled();
  },
};
