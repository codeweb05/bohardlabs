/**
 * `RowActionsMenu` in isolation. The table and the card view both mount it per row, and
 * most of it is covered through them; what is pinned here is what those callers cannot
 * produce: an empty action list, and a `rowActions` array that is a new reference on a
 * later render (the usual case, since consumers declare it inline).
 */
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {RowActionsMenu} from './RowActionsMenu';
import {render, screen} from './test/test-utils';
import type {RowAction} from './types';

interface Item {
  readonly id: string;
  readonly name: string;
  readonly [key: string]: unknown;
}

const row: Item = {id: 'row-1', name: 'Detergent'};

function anchor(): HTMLElement {
  const element = document.createElement('button');
  document.body.append(element);
  return element;
}

describe('RowActionsMenu', () => {
  it('renders nothing for an empty action list', () => {
    // An empty menu would still open a popover: a blank paper with nothing to pick.
    render(<RowActionsMenu<Item> actions={[]} row={row} anchorEl={anchor()} onClose={() => {}} />);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('keeps the open menu in place through a re-render that changes nothing', () => {
    const actions: RowAction<Item>[] = [{id: 'edit', label: 'Edit', onClick: () => {}}];
    const anchorEl = anchor();
    const onClose = vi.fn();
    const {rerender} = render(
      <RowActionsMenu<Item> actions={actions} row={row} anchorEl={anchorEl} onClose={onClose} />,
    );
    const item = screen.getByRole('menuitem', {name: 'Edit'});

    rerender(<RowActionsMenu<Item> actions={actions} row={row} anchorEl={anchorEl} onClose={onClose} />);

    expect(screen.getByRole('menuitem', {name: 'Edit'})).toBe(item);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('picks up a new action list and still hands the row to the handler', async () => {
    const user = userEvent.setup();
    const anchorEl = anchor();
    const onClose = vi.fn();
    const onArchive = vi.fn<(item: Item) => void>();
    const {rerender} = render(
      <RowActionsMenu<Item>
        actions={[{id: 'edit', label: 'Edit', onClick: () => {}}]}
        row={row}
        anchorEl={anchorEl}
        onClose={onClose}
      />,
    );

    rerender(
      <RowActionsMenu<Item>
        actions={[
          {id: 'edit', label: 'Edit', onClick: () => {}},
          {id: 'archive', label: 'Archive', onClick: onArchive},
        ]}
        row={row}
        anchorEl={anchorEl}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole('menuitem', {name: 'Archive'}));

    expect(onArchive).toHaveBeenCalledWith(row);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
