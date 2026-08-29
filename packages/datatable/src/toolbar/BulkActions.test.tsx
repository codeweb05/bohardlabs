/**
 * Coverage for `BulkActions`, previously ~63%.
 *
 * The uncovered half was everything that makes a bulk action safe to ship: the
 * confirmation dialog, the per-action disabled predicate, the in-flight state, and
 * the selection reset that has to follow a successful run.
 *
 * The block at the bottom guards a bug that has since been fixed; it is kept as a
 * regression test.
 */
import type {ColumnDef, RowSelectionState} from '@tanstack/react-table';
import {getCoreRowModel, getFilteredRowModel, useReactTable} from '@tanstack/react-table';
import {act, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {DEFAULT_LABELS} from '../i18n';
import {DataTableLabelsProvider} from '../i18n';
import type {DataTableLabels} from '../i18n';
import {render} from '../test/test-utils';
import type {BulkAction} from '../types';
import {BulkActions} from './BulkActions';

interface Item {
  readonly id: string;
  readonly name: string;
  readonly [key: string]: unknown;
}

const data: Item[] = [
  {id: 'row-1', name: 'Detergent'},
  {id: 'row-2', name: 'Softener'},
  {id: 'row-3', name: 'Bleach'},
];

const columns: ColumnDef<Item>[] = [{id: 'name', accessorKey: 'name'}];

const onClick = vi.fn<(rows: Item[]) => Promise<void>>();

function deleteAction(overrides: Partial<BulkAction<Item>> = {}): BulkAction<Item> {
  return {id: 'delete', label: 'Delete', onClick, ...overrides};
}

/** Renders the bar over a real table with the given rows pre-selected. */
function renderBulkActions(
  actions: readonly BulkAction<Item>[],
  selected: RowSelectionState = {'row-1': true},
  labels?: Partial<DataTableLabels>,
) {
  function Harness() {
    const [rowSelection, setRowSelection] = useState<RowSelectionState>(selected);
    const table = useReactTable({
      data,
      columns,
      state: {rowSelection},
      onRowSelectionChange: setRowSelection,
      enableRowSelection: true,
      getRowId: (row) => row.id,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
    });
    return (
      <DataTableLabelsProvider labels={labels}>
        <BulkActions table={table} actions={actions} />
      </DataTableLabelsProvider>
    );
  }

  return render(<Harness />);
}

beforeEach(() => {
  onClick.mockReset().mockResolvedValue(undefined);
});

describe('BulkActions', () => {
  it('renders nothing when no row is selected', () => {
    // The bar occupies a full row above the table; leaving it mounted and empty
    // would push the header down on every table that supports selection.
    renderBulkActions([deleteAction()], {});

    expect(screen.queryByRole('button', {name: 'Delete'})).not.toBeInTheDocument();
  });

  it('shows how many rows are selected', () => {
    renderBulkActions([deleteAction()], {'row-1': true, 'row-3': true});

    expect(screen.getByText(`2 ${DEFAULT_LABELS.selected}`)).toBeInTheDocument();
  });

  it('runs the action with the selected row data and clears the selection', async () => {
    // Leaving rows selected after a delete points the next action at rows that no
    // longer exist.
    renderBulkActions([deleteAction()], {'row-1': true, 'row-3': true});

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    expect(onClick).toHaveBeenCalledExactlyOnceWith([data[0], data[2]]);
    await waitFor(() => {
      expect(screen.queryByRole('button', {name: 'Delete'})).not.toBeInTheDocument();
    });
  });

  it('clears the selection from the close button without running anything', async () => {
    renderBulkActions([deleteAction()]);

    await userEvent.click(screen.getByRole('button', {name: /clear selection/i}));

    expect(onClick).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('button', {name: 'Delete'})).not.toBeInTheDocument();
    });
  });

  it('renders one button per action', () => {
    renderBulkActions([deleteAction(), {id: 'export', label: 'Export', onClick: vi.fn()}]);

    expect(screen.getByRole('button', {name: 'Delete'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Export'})).toBeInTheDocument();
  });

  it('honours a boolean disabled flag', () => {
    renderBulkActions([deleteAction({disabled: true})]);

    expect(screen.getByRole('button', {name: 'Delete'})).toBeDisabled();
  });

  it('honours a disabled predicate over the selected rows', () => {
    // This is how a caller blocks an action for rows in the wrong state — e.g. a
    // cancel that only applies to open orders.
    const disabled = vi.fn((rows: Item[]) => rows.some((row) => row.name === 'Detergent'));
    renderBulkActions([deleteAction({disabled})]);

    expect(disabled).toHaveBeenCalledWith([data[0]]);
    expect(screen.getByRole('button', {name: 'Delete'})).toBeDisabled();
  });
});

describe('BulkActions — confirmation', () => {
  it('asks before running an action that carries a confirm message', async () => {
    renderBulkActions([deleteAction({confirmMessage: 'Delete these rows?'})]);

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    expect(await screen.findByText('Delete these rows?')).toBeInTheDocument();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('builds the message from the selected count when it is a function', async () => {
    const confirmMessage = (count: number) => `Delete ${count} rows?`;
    renderBulkActions([deleteAction({confirmMessage})], {'row-1': true, 'row-2': true});

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    expect(await screen.findByText('Delete 2 rows?')).toBeInTheDocument();
  });

  it('runs the action once confirmed', async () => {
    renderBulkActions([deleteAction({confirmMessage: 'Delete these rows?'})]);

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));
    await userEvent.click(await screen.findByRole('button', {name: DEFAULT_LABELS.confirm}));

    await waitFor(() => {
      expect(onClick).toHaveBeenCalledExactlyOnceWith([data[0]]);
    });
  });

  it('does not run the action when the dialog is dismissed', async () => {
    renderBulkActions([deleteAction({confirmMessage: 'Delete these rows?'})]);

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));
    await userEvent.click(await screen.findByRole('button', {name: DEFAULT_LABELS.cancel}));

    await waitFor(() => {
      expect(screen.queryByText('Delete these rows?')).not.toBeInTheDocument();
    });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disables every action while one is running', async () => {
    // Two overlapping bulk mutations over the same selection is the classic
    // double-submit; the bar has to lock while the first is in flight.
    let release = () => {};
    onClick.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    renderBulkActions([deleteAction(), {id: 'export', label: 'Export', onClick: vi.fn()}]);

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Export'})).toBeDisabled();
    });
    expect(screen.getByRole('button', {name: 'Delete'})).toBeDisabled();

    // Settle the in-flight action inside act so the unmount does not race a state update.
    // Not awaited: `act` returns a thenable only when its callback does, and this one is
    // synchronous.
    act(() => {
      release();
    });
  });
});

// ===========================================================================
// REGRESSION — toolbar/BulkActions.tsx:100
//
//   <IconButton size="small" onClick={handleClearSelection} aria-label="Clear selection">
//
// The only label on the clear-selection button used to be a hardcoded English string.
// Every other control in the toolbar goes through `t()`, so on a non-English tenant this
// one button announced itself in English — and it is the only way out of the selection
// bar short of unticking each row.
//
// Failed when written; passes now that `dataTable.clearSelection` exists in
// `src/lib/i18n/locales/en.json` and the button reads its label from `t()`.
// ===========================================================================

describe('the clear-selection button is labelled from `labels`', () => {
  it('takes its label from the override', () => {
    renderBulkActions([deleteAction()], {'row-1': true}, {clearSelection: 'Effacer la selection'});

    expect(screen.getByRole('button', {name: 'Effacer la selection'})).toBeInTheDocument();
  });
});
