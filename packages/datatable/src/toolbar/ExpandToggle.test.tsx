/**
 * Coverage for `ExpandToggle`, previously 0%.
 *
 * Nothing in the DataTable renders this component — `DataTableToolbar` never imports
 * it, and it is not in the package barrel's toolbar exports either (see the note at
 * the bottom). It is tested here because it is still shipped source: either it gets
 * wired up, in which case this is its contract, or it gets deleted.
 */
import type {ColumnDef, ExpandedState} from '@tanstack/react-table';
import {getCoreRowModel, getExpandedRowModel, useReactTable} from '@tanstack/react-table';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';

import {DataTableProvider} from '../DataTableContext';
import {DEFAULT_LABELS} from '../i18n';
import {render} from '../test/test-utils';
import {ExpandToggle} from './ExpandToggle';

interface Item {
  readonly id: string;
  readonly name: string;
  readonly [key: string]: unknown;
}

const data: Item[] = [
  {id: 'row-1', name: 'Detergent'},
  {id: 'row-2', name: 'Softener'},
];

const columns: ColumnDef<Item>[] = [{id: 'name', accessorKey: 'name'}];

const EXPAND_ALL = DEFAULT_LABELS.expandAll;
const COLLAPSE_ALL = DEFAULT_LABELS.collapseAll;

/**
 * Renders the toggle over a real table. Expansion state is echoed into the DOM so the
 * tests can read what the button actually did to the table.
 */
function renderExpandToggle(initial: ExpandedState = {}, rows: Item[] = data) {
  function Harness() {
    const [expanded, setExpanded] = useState<ExpandedState>(initial);
    const table = useReactTable({
      data: rows,
      columns,
      state: {expanded},
      onExpandedChange: setExpanded,
      getRowId: (row) => row.id,
      getRowCanExpand: () => true,
      getCoreRowModel: getCoreRowModel(),
      getExpandedRowModel: getExpandedRowModel(),
    });
    return (
      <DataTableProvider<Item> table={table} density="comfortable" setDensity={vi.fn()} expanded={expanded as never}>
        <ExpandToggle table={table} />
        <p>{`expanded: ${JSON.stringify(expanded)}`}</p>
        <p>{`all rows expanded: ${String(table.getRowModel().rows.every((row) => row.getIsExpanded()))}`}</p>
      </DataTableProvider>
    );
  }

  return render(<Harness />);
}

describe('ExpandToggle', () => {
  it('offers "expand all" while the rows are collapsed', () => {
    expect.hasAssertions();
    renderExpandToggle();

    expect(screen.getByRole('button', {name: EXPAND_ALL})).toBeInTheDocument();
  });

  it('expands every row on the first click', async () => {
    // `toggleAllRowsExpanded(true)` sets the state to the boolean `true` rather than a
    // per-row map, so the rows themselves are what to assert on.
    renderExpandToggle();

    await userEvent.click(screen.getByRole('button', {name: EXPAND_ALL}));

    expect(screen.getByText('all rows expanded: true')).toBeInTheDocument();
  });

  it('flips to "collapse all" once every row is expanded', () => {
    // The label is the only affordance telling the user which way the next click goes.
    renderExpandToggle({'row-1': true, 'row-2': true});

    expect(screen.getByRole('button', {name: COLLAPSE_ALL})).toBeInTheDocument();
  });

  it('collapses every row from the expanded state', async () => {
    renderExpandToggle({'row-1': true, 'row-2': true});

    await userEvent.click(screen.getByRole('button', {name: COLLAPSE_ALL}));

    expect(screen.getByText('expanded: {}')).toBeInTheDocument();
    expect(screen.getByText('all rows expanded: false')).toBeInTheDocument();
  });

  it('still offers "expand all" when only some rows are expanded', async () => {
    // A partial expansion has to expand the rest, not collapse what is already open —
    // otherwise one click after expanding a single row undoes the user's work.
    renderExpandToggle({'row-1': true});

    await userEvent.click(screen.getByRole('button', {name: EXPAND_ALL}));

    expect(screen.getByText('all rows expanded: true')).toBeInTheDocument();
  });

  it('does not claim everything is expanded on an empty table', () => {
    // `rows.every(...)` is true for an empty array, so the guard on `rows.length` is
    // what stops an empty table from rendering a "collapse all" button.
    renderExpandToggle({}, []);

    expect(screen.getByRole('button', {name: EXPAND_ALL})).toBeInTheDocument();
  });

  it('throws a clear error outside a provider', () => {
    function Bare() {
      const table = useReactTable({data, columns, getCoreRowModel: getCoreRowModel()});
      return <ExpandToggle table={table} />;
    }

    expect(() => render(<Bare />)).toThrow(/DataTableProvider/);
  });
});
