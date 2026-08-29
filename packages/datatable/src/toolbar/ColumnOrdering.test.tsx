/**
 * Coverage for `ColumnOrdering`, previously 0%.
 *
 * Nothing renders this component. `DataTableToolbar`'s `enableColumnOrdering` prop
 * goes to the header's drag handles (via `useColumnOrdering`), not here, and the only
 * reference to this file in the repo is the barrel export in `index.ts`. It is a
 * second, independent implementation of column ordering that has drifted from the
 * hook the DataTable actually uses — the two KNOWN ISSUE blocks at the bottom are
 * both places where it disagrees with `useColumnOrdering`.
 *
 * It is tested here because it is exported from the package surface: either it gets
 * reconciled with the hook, or it gets deleted before this ships.
 */
import type {ColumnDef, ColumnOrderState, ColumnPinningState} from '@tanstack/react-table';
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {DEFAULT_LABELS} from '../i18n';
import {DataTableLabelsProvider} from '../i18n';
import type {DataTableLabels} from '../i18n';
import {render} from '../test/test-utils';
import {ColumnOrdering} from './ColumnOrdering';

interface Item {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly [key: string]: unknown;
}

const data: Item[] = [{id: 'row-1', name: 'Detergent', quantity: 2}];

const baseColumns: ColumnDef<Item>[] = [
  {id: 'select', header: () => <span>select</span>, cell: () => null},
  {id: 'name', accessorKey: 'name', header: 'Name'},
  {id: 'quantity', accessorKey: 'quantity', header: 'Quantity'},
  {id: 'actions', header: 'Actions', cell: () => null},
];

const onOrderChange = vi.fn();

interface HarnessOptions {
  readonly columns?: ColumnDef<Item>[];
  readonly initialOrder?: ColumnOrderState;
  readonly pinning?: ColumnPinningState;
  readonly labels?: Partial<DataTableLabels>;
}

/**
 * Renders the button plus its dialog over a real table, echoing the committed column
 * order into the DOM so the assertions read what the component did to the table
 * rather than what it passed to a spy.
 */
function renderColumnOrdering(options: HarnessOptions = {}) {
  function Harness() {
    const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(options.initialOrder ?? []);
    const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(options.pinning ?? {left: [], right: []});
    const table = useReactTable({
      data,
      columns: options.columns ?? baseColumns,
      state: {columnOrder, columnPinning},
      onColumnOrderChange: setColumnOrder,
      onColumnPinningChange: setColumnPinning,
      getRowId: (row) => row.id,
      getCoreRowModel: getCoreRowModel(),
    });
    return (
      <DataTableLabelsProvider labels={options.labels}>
        <ColumnOrdering table={table} onOrderChange={onOrderChange} />
        <p>{`order: ${columnOrder.join(',')}`}</p>
      </DataTableLabelsProvider>
    );
  }

  return render(<Harness />);
}

const REORDER_LABEL = DEFAULT_LABELS.dragToReorder;

/** Renders the default table and opens the reorder dialog. */
async function openDialog(options: HarnessOptions = {}) {
  renderColumnOrdering(options);
  await userEvent.click(screen.getByRole('button', {name: REORDER_LABEL}));
  return screen.getByRole('dialog');
}

/**
 * The labels currently listed in the dialog, top to bottom. Each row renders its
 * position number after the label, so that suffix is sliced off by length rather than
 * matched, which keeps a label that ends in a digit intact.
 */
function listedLabels(): string[] {
  return within(screen.getByRole('dialog'))
    .getAllByRole('listitem')
    .map((item, index) => {
      const text = item.textContent ?? '';
      return text.slice(0, text.length - String(index + 1).length);
    });
}

/** Drags the row at `from` onto the row at `to` using the component's own handlers. */
function dragRow(from: number, to: number) {
  const rows = within(screen.getByRole('dialog')).getAllByRole('listitem');
  fireEvent.dragStart(rows[from]);
  fireEvent.dragOver(rows[to]);
  fireEvent.dragEnd(rows[from]);
}

beforeEach(() => {
  onOrderChange.mockReset();
});

describe('ColumnOrdering', () => {
  it('renders only the trigger until it is opened', () => {
    renderColumnOrdering();

    expect(screen.getByRole('button', {name: REORDER_LABEL})).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lists the orderable columns by their header labels', async () => {
    await openDialog();

    expect(listedLabels()).toEqual(['Name', 'Quantity']);
  });

  it('leaves the select and actions columns out of the list', async () => {
    // Neither has a meaningful position for a user to choose: select belongs at the
    // start of the row and actions at the end.
    await openDialog();

    expect(within(screen.getByRole('dialog')).queryByText('Actions')).not.toBeInTheDocument();
    expect(listedLabels()).toHaveLength(2);
  });

  it('numbers the rows from one', async () => {
    await openDialog();

    const rows = within(screen.getByRole('dialog')).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('1');
    expect(rows[1]).toHaveTextContent('2');
  });

  it('falls back to the column id when the header is not a plain string', async () => {
    // A `header: () => <Foo/>` column would otherwise render as an empty row the user
    // cannot identify.
    await openDialog({
      columns: [
        {id: 'name', accessorKey: 'name', header: 'Name'},
        {id: 'quantity', accessorKey: 'quantity', header: () => <span>Qty</span>},
      ],
    });

    expect(listedLabels()).toEqual(['Name', 'quantity']);
  });

  it('seeds the list from the order already applied to the table', async () => {
    // Reopening the dialog has to show what the table is doing now, not the order the
    // columns were declared in.
    await openDialog({initialOrder: ['select', 'quantity', 'name', 'actions']});

    expect(listedLabels()).toEqual(['Quantity', 'Name']);
  });

  it('reorders the list when a row is dragged onto another', async () => {
    await openDialog();

    dragRow(0, 1);

    expect(listedLabels()).toEqual(['Quantity', 'Name']);
  });

  it('ignores a drag that ends on the row it started from', async () => {
    await openDialog();

    dragRow(1, 1);

    expect(listedLabels()).toEqual(['Name', 'Quantity']);
  });

  it('does not touch the table until the order is applied', async () => {
    // The dialog is a staging area; dragging inside it must be undoable by cancelling.
    await openDialog();

    dragRow(0, 1);

    expect(screen.getByText('order:')).toBeInTheDocument();
    expect(onOrderChange).not.toHaveBeenCalled();
  });

  it('commits the order with select first and actions last', async () => {
    await openDialog();
    dragRow(0, 1);

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    expect(screen.getByText('order: select,quantity,name,actions')).toBeInTheDocument();
  });

  it('reports the committed order to the caller', async () => {
    await openDialog();
    dragRow(0, 1);

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    expect(onOrderChange).toHaveBeenCalledExactlyOnceWith(['select', 'quantity', 'name', 'actions']);
  });

  it('closes after applying', async () => {
    await openDialog();

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    // The dialog fades out, so it is still mounted for the length of the transition.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('discards the staged order on cancel', async () => {
    await openDialog();
    dragRow(0, 1);

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(screen.getByText('order:')).toBeInTheDocument();
    expect(onOrderChange).not.toHaveBeenCalled();
  });

  it('restores the declared order on reset without closing', async () => {
    await openDialog();
    dragRow(0, 1);

    await userEvent.click(screen.getByRole('button', {name: 'Reset'}));

    expect(listedLabels()).toEqual(['Name', 'Quantity']);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('omits select and actions from the committed order when the table has neither', async () => {
    await openDialog({
      columns: [
        {id: 'name', accessorKey: 'name', header: 'Name'},
        {id: 'quantity', accessorKey: 'quantity', header: 'Quantity'},
      ],
    });

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    expect(screen.getByText('order: name,quantity')).toBeInTheDocument();
  });
});

// ===========================================================================
// KNOWN ISSUE — toolbar/ColumnOrdering.tsx:141, :208 and :215
//
//   <Typography …>Drag columns to reorder them</Typography>
//   <Button onClick={handleReset} …>Reset</Button>
//   <Button onClick={handleApply} …>Apply</Button>
//
// Three user-facing strings are hardcoded English in a component that already calls
// `t()` for its title and its cancel button, so this dialog renders half-translated in
// any other locale. `dataTable.reorderHint` ("Drag to reorder columns") already exists
// in en.json and covers the first one; "Reset" and "Apply" need keys adding (there is
// no `common.reset` or `common.apply` yet).
//
// The assertion deliberately does not name the keys: it empties the translation bundle,
// which turns every translated string into its own key, and then checks the English
// literals are gone. Any correct fix passes it whichever key names are chosen.
//
// EXPECTED TO FAIL until all three strings come from `t()`.
// ===========================================================================

describe('every string in the reorder dialog comes from `labels`', () => {
  it('renders overrides instead of the defaults', async () => {
    renderColumnOrdering({
      labels: {
        dragToReorder: 'Reordonner',
        reorderHint: 'Glissez pour reordonner',
        reset: 'Reinitialiser',
        apply: 'Appliquer',
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Reordonner'}));
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText('Glissez pour reordonner')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', {name: 'Reinitialiser'})).toBeInTheDocument();
    expect(within(dialog).getByRole('button', {name: 'Appliquer'})).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', {name: DEFAULT_LABELS.apply})).not.toBeInTheDocument();
  });
});

// ===========================================================================
// KNOWN ISSUE — toolbar/ColumnOrdering.tsx:37 and :84-94
//
//   const columns = table.getAllLeafColumns().filter((col) => col.id !== 'select' && col.id !== 'actions');
//   const fullOrder = [...select, ...localOrder, ...actions];
//   table.setColumnOrder(fullOrder);
//
// `handleApply` writes the order straight to the table, skipping the two guards the
// DataTable's own `useColumnOrdering` applies to every drag (hooks/useColumnOrdering.ts:41-51):
//
//   1. `expand` is a system column everywhere else — `useColumnVisibility`'s
//      SYSTEM_COLUMN_IDS lists it next to select and actions — but this filter omits it,
//      so the row-expansion chevron shows up as a draggable entry and can be parked in
//      the middle of the table, between two data columns.
//   2. `orderWithPinned` is never called, so applying any order drops frozen columns out
//      of the pinned block at the front of the row. The header keeps painting them from
//      `columnPinning.left`, so the frozen header cells end up over the wrong body cells.
//
// EXPECTED TO FAIL until this component reuses `useColumnOrdering`/`orderWithPinned`
// (the straightforward fix, since that hook already handles both) or repeats both guards.
// ===========================================================================
describe('KNOWN ISSUE — applying an order must respect system columns and pinning', () => {
  const withExpand: ColumnDef<Item>[] = [
    {id: 'select', header: () => <span>select</span>, cell: () => null},
    {id: 'expand', header: () => <span>expand</span>, cell: () => null},
    {id: 'name', accessorKey: 'name', header: 'Name'},
    {id: 'quantity', accessorKey: 'quantity', header: 'Quantity'},
  ];

  it('keeps the expand column out of the reorderable list', async () => {
    await openDialog({columns: withExpand});

    expect(listedLabels()).toEqual(['Name', 'Quantity']);
  });

  it('never places a data column ahead of the expand column', async () => {
    await openDialog({columns: withExpand});
    // Drag the first data column above whatever sits at the top of the list.
    dragRow(1, 0);

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    expect(screen.getByText(/^order: select,expand,/)).toBeInTheDocument();
  });

  it('keeps a pinned column inside the frozen block', async () => {
    await openDialog({pinning: {left: ['quantity'], right: []}});

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    // What `orderWithPinned` produces: leading system columns, then the frozen block,
    // then everything else, then the trailing actions column.
    expect(screen.getByText('order: select,quantity,name,actions')).toBeInTheDocument();
  });
});
