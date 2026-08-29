/**
 * Coverage for `DataTableToolbar`, previously ~50%.
 *
 * The toolbar is almost entirely conditional rendering: nine independent `enable*`
 * flags, each gating a control and the divider in front of it. The uncovered half was
 * the mobile bulk-action menu, the reset-to-default button and the active-filter
 * indicator — the parts a consumer is most likely to switch on.
 *
 * The block at the bottom guards a bug that has since been fixed; it is kept as a
 * regression test.
 */
import type {RowSelectionState} from '@tanstack/react-table';
import {getCoreRowModel, getFilteredRowModel, useReactTable} from '@tanstack/react-table';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {DataTableProvider} from '../DataTableContext';
import {DEFAULT_LABELS} from '../i18n';
import {render} from '../test/test-utils';
import type {BulkAction, DataTableColumnDef} from '../types';
import {DataTableToolbar} from './DataTableToolbar';

interface Item {
  readonly id: string;
  readonly name: string;
  readonly [key: string]: unknown;
}

const data: Item[] = [
  {id: 'row-1', name: 'Detergent'},
  {id: 'row-2', name: 'Softener'},
];

const columns: DataTableColumnDef<Item>[] = [{id: 'name', accessorKey: 'name', header: 'Name'}];

const onGlobalFilterChange = vi.fn<(value: string) => void>();
const onFiltersReset = vi.fn();
const onResetToDefault = vi.fn();
const onDensityChange = vi.fn();
const bulkClick = vi.fn<(rows: Item[]) => Promise<void>>();

type ToolbarProps = Omit<React.ComponentProps<typeof DataTableToolbar<Item>>, 'table' | 'columns'>;

/**
 * Renders the toolbar over a real table. The current row selection is printed into the
 * DOM so tests can watch it change without reaching into the table instance.
 */
function renderToolbar(props: ToolbarProps = {}, selected: RowSelectionState = {}) {
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
    const selectedRows = table.getFilteredSelectedRowModel().rows.map((row) => row.original);
    // The provider is not optional: `ColumnVisibility` (rendered by the toolbar behind
    // `enableColumnVisibility`) reads `useTableUI()` and throws without it.
    return (
      <DataTableProvider<Item> table={table} density="comfortable" setDensity={onDensityChange}>
        <DataTableToolbar<Item> table={table} columns={columns} selectedRows={selectedRows} {...props} />
        <p>{`selection: ${Object.keys(rowSelection).join(',')}`}</p>
      </DataTableProvider>
    );
  }

  return render(<Harness />);
}

const bulkActions: readonly BulkAction<Item>[] = [{id: 'delete', label: 'Delete', onClick: bulkClick}];

beforeEach(() => {
  onGlobalFilterChange.mockReset();
  onFiltersReset.mockReset();
  onResetToDefault.mockReset();
  onDensityChange.mockReset();
  bulkClick.mockReset().mockResolvedValue(undefined);
});

describe('DataTableToolbar — global search', () => {
  it('renders the search box by default and reports typing', async () => {
    renderToolbar({onGlobalFilterChange});

    await userEvent.type(screen.getByPlaceholderText(DEFAULT_LABELS.globalSearch), 'a');

    // GlobalSearch debounces by 300ms, so the report lands after the keystroke.
    await waitFor(() => {
      expect(onGlobalFilterChange).toHaveBeenCalledWith('a');
    });
  });

  it('uses the caller placeholder and helper text', () => {
    renderToolbar({globalFilterPlaceholder: 'Search orders', globalFilterHelperText: 'Order number or customer'});

    expect(screen.getByPlaceholderText('Search orders')).toBeInTheDocument();
    expect(screen.getByText('Order number or customer')).toBeInTheDocument();
  });

  it('drops the search box when global filtering is off', () => {
    renderToolbar({enableGlobalFilter: false});

    expect(screen.queryByPlaceholderText(DEFAULT_LABELS.globalSearch)).not.toBeInTheDocument();
  });

  it('survives a missing change handler', async () => {
    // `onGlobalFilterChange` is optional, and the fallback no-op is what keeps an
    // uncontrolled toolbar from throwing on the first keystroke.
    renderToolbar();

    await userEvent.type(screen.getByPlaceholderText(DEFAULT_LABELS.globalSearch), 'a');

    expect(screen.getByPlaceholderText(DEFAULT_LABELS.globalSearch)).toBeInTheDocument();
  });
});

describe('DataTableToolbar — active filters', () => {
  it('counts column filters and the global filter together', () => {
    // The chip is the only signal that a list is filtered once the filter drawer is
    // closed, so an undercount reads as "no filters" on a filtered table.
    renderToolbar({columnFilters: [{id: 'name', value: 'a'}], globalFilter: 'detergent'});

    expect(screen.getByText(DEFAULT_LABELS.activeFilters(2))).toBeInTheDocument();
  });

  it('shows nothing when no filter is active', () => {
    renderToolbar({onFiltersReset});

    expect(screen.queryByRole('button', {name: DEFAULT_LABELS.resetFilters})).not.toBeInTheDocument();
  });

  it('resets the filters from the toolbar button', async () => {
    renderToolbar({columnFilters: [{id: 'name', value: 'a'}], onFiltersReset});

    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.resetFilters}));

    expect(onFiltersReset).toHaveBeenCalledOnce();
  });

  it('hides the filter indicator entirely when filtering is off', () => {
    renderToolbar({enableFiltering: false, columnFilters: [{id: 'name', value: 'a'}], onFiltersReset});

    expect(screen.queryByText(DEFAULT_LABELS.activeFilters(1))).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: DEFAULT_LABELS.filters})).not.toBeInTheDocument();
  });
});

describe('DataTableToolbar — optional controls', () => {
  it('hides every optional control by default', () => {
    renderToolbar();

    expect(screen.queryByRole('button', {name: DEFAULT_LABELS.densityLabel})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: DEFAULT_LABELS.columns})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: DEFAULT_LABELS.exportLabel})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: DEFAULT_LABELS.resetToDefault})).not.toBeInTheDocument();
  });

  it('renders the density toggle only when a handler comes with the flag', () => {
    const view = renderToolbar({enableDensityToggle: true});
    expect(screen.queryByRole('button', {name: DEFAULT_LABELS.densityLabel})).not.toBeInTheDocument();

    view.unmount();
    renderToolbar({enableDensityToggle: true, onDensityChange});
    expect(screen.getByRole('button', {name: DEFAULT_LABELS.densityLabel})).toBeInTheDocument();
  });

  it('renders the column-visibility and export controls behind their flags', () => {
    renderToolbar({enableColumnVisibility: true, enableExport: true});

    expect(screen.getByRole('button', {name: DEFAULT_LABELS.columns})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: DEFAULT_LABELS.exportLabel})).toBeInTheDocument();
  });

  it('renders the reset-to-default button only when a handler is given', async () => {
    renderToolbar({onResetToDefault});

    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.resetToDefault}));

    expect(onResetToDefault).toHaveBeenCalledOnce();
  });
});

describe('DataTableToolbar — mobile bulk actions', () => {
  const mobileProps: ToolbarProps = {isMobile: true, bulkActions};

  it('stays hidden on desktop even with rows selected', () => {
    // The desktop layout has its own `BulkActions` bar; showing both would give the
    // same action two places to fire from.
    renderToolbar({bulkActions}, {'row-1': true});

    expect(screen.queryByRole('button', {name: DEFAULT_LABELS.actions})).not.toBeInTheDocument();
  });

  it('stays hidden on mobile while nothing is selected', () => {
    renderToolbar(mobileProps);

    expect(screen.queryByRole('button', {name: DEFAULT_LABELS.actions})).not.toBeInTheDocument();
  });

  it('shows the selected count and the action menu', async () => {
    renderToolbar(mobileProps, {'row-1': true, 'row-2': true});

    expect(screen.getByText(`2 ${DEFAULT_LABELS.selected}`)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.actions}));

    expect(await screen.findByRole('menuitem', {name: 'Delete'})).toBeInTheDocument();
  });

  it('runs the action with the selected rows', async () => {
    renderToolbar(mobileProps, {'row-2': true});

    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.actions}));
    await userEvent.click(await screen.findByRole('menuitem', {name: 'Delete'}));

    await waitFor(() => {
      expect(bulkClick).toHaveBeenCalledExactlyOnceWith([data[1]]);
    });
  });

  it('closes the menu on Escape without running an action', async () => {
    // The menu's `onClose` (DataTableToolbar.tsx:201) had no coverage: the other tests
    // all close it by picking an item. On a phone the menu is the only thing on screen,
    // so a dismiss that leaves it open blocks the whole toolbar.
    renderToolbar(mobileProps, {'row-1': true});
    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.actions}));
    await screen.findByRole('menuitem', {name: 'Delete'});

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('menuitem', {name: 'Delete'})).not.toBeInTheDocument();
    });
    expect(bulkClick).not.toHaveBeenCalled();
  });

  it('disables an action whose predicate rejects the selection', async () => {
    const disabled = vi.fn((rows: Item[]) => rows.length > 1);
    renderToolbar(
      {isMobile: true, bulkActions: [{id: 'delete', label: 'Delete', onClick: bulkClick, disabled}]},
      {
        'row-1': true,
        'row-2': true,
      },
    );

    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.actions}));

    expect(await screen.findByRole('menuitem', {name: 'Delete'})).toHaveAttribute('aria-disabled', 'true');
    expect(disabled).toHaveBeenCalledWith([data[0], data[1]]);
  });

  it('locks the trigger while an action is in flight', async () => {
    let release = () => {};
    bulkClick.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    renderToolbar(mobileProps, {'row-1': true});

    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.actions}));
    await userEvent.click(await screen.findByRole('menuitem', {name: 'Delete'}));

    await waitFor(() => {
      expect(screen.getByRole('button', {name: DEFAULT_LABELS.actions})).toBeDisabled();
    });

    release();
    // A successful action clears the selection (same as the desktop bar), so the trigger
    // unmounts with the selection bar rather than coming back enabled. Either way the
    // lock is gone, which is what the loading flag exists to do.
    await waitFor(() => {
      expect(screen.queryByRole('button', {name: DEFAULT_LABELS.actions})).not.toBeInTheDocument();
    });
  });
});

// ===========================================================================
// REGRESSION — toolbar/DataTableToolbar.tsx:216
//
//   onClick={async () => {
//     setBulkMenuAnchor(null);
//     setIsBulkActionLoading(true);
//     try { await action.onClick(selectedRows as TData[]); }
//     finally { setIsBulkActionLoading(false); }
//   }}
//
// The desktop bar (`BulkActions.tsx:43`) calls `table.resetRowSelection()` after a
// successful action. This mobile copy never did, so the same bulk delete left every
// deleted row ticked: the count chip kept claiming a selection, and the next action
// fired against rows that were gone. Two implementations of one behaviour, and only one
// of them cleared up.
//
// Failed when written; passes now that the mobile menu resets the selection on success
// too. Keep both paths covered: they are still two separate implementations.
// ===========================================================================
describe('Regression — the mobile bulk menu must clear the rows it acted on', () => {
  it('clears the selection after the action succeeds', async () => {
    renderToolbar({isMobile: true, bulkActions}, {'row-1': true});

    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.actions}));
    await userEvent.click(await screen.findByRole('menuitem', {name: 'Delete'}));

    await waitFor(() => {
      expect(bulkClick).toHaveBeenCalledOnce();
    });
    await waitFor(() => {
      expect(screen.getByText('selection:')).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// The search box's handler is optional (DataTableToolbar.tsx:142):
//
//   onChange={onGlobalFilterChange ?? (() => {})}
//
// `enableGlobalFilter` and `onGlobalFilterChange` are separate props, so a consumer can
// switch the box on and forget the handler. `<DataTable>` always passes one, which is
// why nothing reached the fallback, but a standalone package cannot assume that.
//
// The fallback keeps a typo from crashing the page. It also means the search box
// silently does nothing, which is worth knowing about: this pins the behaviour so a
// later change to throw or warn instead is a deliberate one.
// ===========================================================================
describe('DataTableToolbar — search with no handler', () => {
  it('accepts typing without a change handler', async () => {
    renderToolbar({enableGlobalFilter: true});

    await userEvent.type(screen.getByRole('textbox'), 'det');

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});
