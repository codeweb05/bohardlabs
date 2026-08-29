/**
 * The two escape hatches that let the table stop looking like a guest in the host app:
 * `slots.confirmDialog` and `dateFormats`.
 *
 * Both matter because the alternative is visible to a user. A second confirmation dialog
 * that does not match the app's own is the tell that a component was dropped in rather
 * than fitted, and a date filter showing `08/28/2026` in an app that writes `28/08/2026`
 * everywhere else is a date read wrong.
 */
import {LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import type {Column, ColumnDef, RowSelectionState} from '@tanstack/react-table';
import {getCoreRowModel, getFilteredRowModel, useReactTable} from '@tanstack/react-table';
import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';

import {DateFilter} from '../filters/DateFilter';
import {render} from '../test/test-utils';
import {BulkActions} from '../toolbar/BulkActions';
import type {BulkAction, DataTableConfirmProps} from '../types';
import {DataTableConfigProvider} from './ConfigContext';

interface Item {
  readonly id: string;
  readonly name: string;
  readonly placedAt: string;
  readonly [key: string]: unknown;
}

const data: Item[] = [
  {id: 'row-1', name: 'Detergent', placedAt: '2026-08-28'},
  {id: 'row-2', name: 'Softener', placedAt: '2026-08-29'},
];

const columns: ColumnDef<Item>[] = [
  {id: 'name', accessorKey: 'name'},
  {id: 'placedAt', accessorKey: 'placedAt'},
];

/** Stands in for the host app's own dialog. Deliberately nothing like the built-in one. */
function AppConfirmDialog({open, onClose, onConfirm, title}: Readonly<DataTableConfirmProps>) {
  if (!open) return null;
  return (
    <div role="dialog" aria-label="app confirm">
      <p>{`App says: ${title}`}</p>
      <button type="button" onClick={onClose}>
        Not now
      </button>
      <button
        type="button"
        onClick={() => {
          void onConfirm();
        }}
      >
        Yes, do it
      </button>
    </div>
  );
}

function renderBulkActions(action: BulkAction<Item>, slots?: {confirmDialog: typeof AppConfirmDialog}) {
  function Harness() {
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({'row-1': true});
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
      <DataTableConfigProvider slots={slots}>
        <BulkActions table={table} actions={[action]} />
      </DataTableConfigProvider>
    );
  }

  return render(<Harness />);
}

describe('slots.confirmDialog', () => {
  const onClick = vi.fn<(rows: Item[]) => Promise<void>>();
  const action: BulkAction<Item> = {
    id: 'delete',
    label: 'Delete',
    confirmMessage: 'Delete the selected rows?',
    onClick,
  };

  it('renders the built-in dialog when no slot is passed', async () => {
    renderBulkActions(action);

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    expect(screen.queryByRole('dialog', {name: 'app confirm'})).not.toBeInTheDocument();
    expect(screen.getByText('Delete the selected rows?')).toBeInTheDocument();
  });

  it("renders the consumer's dialog instead, and never both", async () => {
    renderBulkActions(action, {confirmDialog: AppConfirmDialog});

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    expect(screen.getByRole('dialog', {name: 'app confirm'})).toBeInTheDocument();
    // The built-in one renders the message; the replacement renders the title.
    expect(screen.queryByText('Delete the selected rows?')).not.toBeInTheDocument();
    expect(screen.getByText('App says: Delete')).toBeInTheDocument();
  });

  it('runs the action through the replacement, so the slot is wired and not just shown', async () => {
    onClick.mockResolvedValue();
    renderBulkActions(action, {confirmDialog: AppConfirmDialog});

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));
    await userEvent.click(screen.getByRole('button', {name: 'Yes, do it'}));

    expect(onClick).toHaveBeenCalledWith([data[0]]);
  });

  it('cancels through the replacement without running the action', async () => {
    onClick.mockClear();
    renderBulkActions(action, {confirmDialog: AppConfirmDialog});

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));
    await userEvent.click(screen.getByRole('button', {name: 'Not now'}));

    expect(screen.queryByRole('dialog', {name: 'app confirm'})).not.toBeInTheDocument();
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('dateFormats', () => {
  /**
   * A column stub rather than a real table: this is about what the filter writes and
   * shows, and `setFilterValue` is the only part of the column that matters here.
   */
  function mockColumn(value?: string) {
    return {
      id: 'placedAt',
      getFilterValue: () => value,
      setFilterValue: vi.fn(),
    } as unknown as Column<Item>;
  }

  function renderDateFilter(column: Column<Item>, dateFormats?: {display?: string; value?: string}) {
    return render(
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DataTableConfigProvider dateFormats={dateFormats}>
          <DateFilter column={column} showRange={false} debounceMs={0} />
        </DataTableConfigProvider>
      </LocalizationProvider>,
    );
  }

  /** The picker renders one spinbutton per section, in the order the format asks for. */
  function sectionOrder() {
    return screen.getAllByRole('spinbutton').map((section) => section.getAttribute('aria-label'));
  }

  it('shows day before month by default', () => {
    renderDateFilter(mockColumn());
    expect(sectionOrder()).toEqual(['Day', 'Month', 'Year']);
  });

  it('shows month before day when the consumer asks for it', () => {
    renderDateFilter(mockColumn(), {display: 'MM/DD/YYYY'});
    expect(sectionOrder()).toEqual(['Month', 'Day', 'Year']);
  });

  it('leaves the wire format alone when only the display format changes', async () => {
    const column = mockColumn();
    renderDateFilter(column, {display: 'MM/DD/YYYY'});

    await userEvent.click(screen.getByRole('button', {name: /choose date/i}));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('gridcell', {name: '15'}));

    await waitFor(() => {
      // ISO, whatever the picker is showing: this is what reaches the server.
      expect(column.setFilterValue).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-15$/));
    });
  });

  it('writes the wire format the consumer asked for', async () => {
    const column = mockColumn();
    renderDateFilter(column, {value: 'DD-MM-YYYY'});

    await userEvent.click(screen.getByRole('button', {name: /choose date/i}));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('gridcell', {name: '15'}));

    await waitFor(() => {
      expect(column.setFilterValue).toHaveBeenCalledWith(expect.stringMatching(/^15-\d{2}-\d{4}$/));
    });
  });
});
