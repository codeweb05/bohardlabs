/**
 * `TableContainer` on its own, with only the props it requires.
 *
 * `DataTable` always hands it every flag and a provider carrying every piece of UI state,
 * so the defaults on this component, and the fallbacks the header, body and rows take when
 * the provider has no selection, pagination, visibility, order or expansion to offer, were
 * never run. They matter for the same reason the provider props are optional: the pieces
 * are composed in other arrangements (the header and row tests in this folder do it), and
 * a missing piece of state has to read as "nothing selected, everything visible" instead of
 * throwing.
 *
 * The table instance keeps its own state here, so the assertions are on what the first
 * paint shows for a given initial state.
 */
import type {InitialTableState} from '@tanstack/react-table';
import {getCoreRowModel, getExpandedRowModel, useReactTable} from '@tanstack/react-table';
import type {ComponentProps} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {DataTableProvider} from '../DataTableContext';
import {render, screen} from '../test/test-utils';
import type {CellOverflowMode, DataTableColumnDef, RowData} from '../types';
import {TableContainer} from './TableContainer';

interface Item extends RowData {
  readonly id: number;
  readonly name: string;
  readonly email: string;
}

const data: Item[] = [
  {id: 1, name: 'Detergent', email: 'ada@example.com'},
  {id: 2, name: 'Softener', email: 'grace@example.com'},
];

const dataColumns: DataTableColumnDef<Item>[] = [
  {id: 'name', accessorKey: 'name', header: 'Name'},
  {id: 'email', accessorKey: 'email', header: 'Email'},
];

const selectColumn: DataTableColumnDef<Item> = {id: 'select', header: () => null, cell: () => null};
const expandColumn: DataTableColumnDef<Item> = {id: 'expand', header: () => null, cell: () => null};

interface HarnessProps extends Omit<ComponentProps<typeof TableContainer<Item>>, 'table'> {
  readonly columns?: DataTableColumnDef<Item>[];
  readonly initialState?: InitialTableState;
}

function Harness({columns = dataColumns, initialState, ...containerProps}: Readonly<HarnessProps>) {
  'use no memo';
  const table = useReactTable({
    data,
    columns,
    initialState,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <DataTableProvider table={table} density="comfortable" setDensity={() => {}}>
      <TableContainer table={table} {...containerProps} />
    </DataTableProvider>
  );
}

describe('TableContainer with only a table', () => {
  it('renders every column and row, with no resize handles and no expand toggles', () => {
    render(<Harness />);

    expect(screen.getByRole('columnheader', {name: 'Name'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Email'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Detergent'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'grace@example.com'})).toBeInTheDocument();
    // Header row plus the two data rows: no expansion rows are reserved.
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Expand row'})).not.toBeInTheDocument();
  });

  it('lets the table size itself when resizing is off', () => {
    render(<Harness ariaLabel="Products" />);

    expect(screen.getByRole('table', {name: 'Products'})).toHaveStyle({tableLayout: 'auto', width: '100%'});
  });

  it('reads the selection off the table when the provider carries none', () => {
    render(<Harness columns={[selectColumn, ...dataColumns]} initialState={{rowSelection: {'1': true}}} />);

    expect(screen.getByRole('checkbox', {name: 'Select row 0'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select row 1'})).toBeChecked();
    // One of two rows: the header box is neither ticked nor claims the whole page.
    expect(screen.getByRole('checkbox', {name: 'Select all rows'})).not.toBeChecked();
  });

  it('reads the open rows off the table when the provider carries none', () => {
    render(
      <Harness
        columns={[expandColumn, ...dataColumns]}
        initialState={{expanded: {'0': true}}}
        enableExpanding
        renderExpandedRow={(row) => <p>Details for {row.original.name}</p>}
      />,
    );

    expect(screen.getByText('Details for Detergent')).toBeInTheDocument();
    expect(screen.queryByText('Details for Softener')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Collapse row'})).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', {name: 'Expand row'})).toHaveAttribute('aria-expanded', 'false');
    // Not every row is open, so the header still offers to open the rest.
    expect(screen.getByRole('button', {name: 'Expand All'})).toBeInTheDocument();
  });

  it('keeps the select column frozen when pinning is on and nothing else is pinned', () => {
    render(<Harness columns={[selectColumn, ...dataColumns]} enableColumnPinning />);

    expect(screen.getByRole('checkbox', {name: 'Select all rows'}).closest('th')).toHaveStyle({position: 'sticky'});
    expect(screen.getByRole('columnheader', {name: 'Name'})).not.toHaveStyle({position: 'sticky'});
  });

  it('falls back to the default size limits for a column that declares none', () => {
    // TanStack fills `minSize` and `maxSize` in, but an explicit `undefined` overrides its
    // defaults, which is what a column spread from a partial object ends up with.
    const columns: DataTableColumnDef<Item>[] = [
      {id: 'name', accessorKey: 'name', header: 'Name', minSize: undefined, maxSize: undefined, maxWidth: 120},
    ];
    render(<Harness columns={columns} />);

    expect(screen.getByRole('columnheader', {name: 'Name'})).toHaveStyle({minWidth: '50px', maxWidth: '500px'});
    expect(screen.getByRole('cell', {name: 'Detergent'})).toHaveStyle({maxWidth: '120px'});
  });
});

describe('TableContainer, measuring where a frozen column sits', () => {
  // jsdom lays nothing out, so every header reports a width of 0 unless one is stubbed in.
  function stubHeaderWidth(width: number) {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {configurable: true, value: width});
  }

  afterEach(() => {
    stubHeaderWidth(0);
    vi.unstubAllGlobals();
  });

  function Pinned({pinned, overflow}: Readonly<{pinned: string[]; overflow?: CellOverflowMode}>) {
    'use no memo';
    const table = useReactTable({data, columns: dataColumns, getCoreRowModel: getCoreRowModel()});

    return (
      <DataTableProvider table={table} density="comfortable" setDensity={() => {}} columnPinning={{left: pinned}}>
        <TableContainer table={table} enableColumnPinning ariaLabel="Products" defaultOverflow={overflow} />
      </DataTableProvider>
    );
  }

  it('offsets a frozen column by the width of every column painted before it', () => {
    // The provider says `email` is frozen while the table still paints `name` first, which
    // is the frame between a pin and the reorder that follows it. The offset has to be the
    // real distance from the left edge, or the frozen cell jumps on top of its neighbour.
    stubHeaderWidth(120);
    render(<Pinned pinned={['email']} />);

    expect(screen.getByRole('table', {name: 'Products'}).style.getPropertyValue('--dt-pin-email')).toBe('120px');
  });

  it('still places the frozen columns in a browser with no ResizeObserver', () => {
    // An embedded webview or an old Safari: the offsets are measured once per render and
    // simply do not follow a window resize. The headers truncate, which is the default, so
    // the observer each of them keeps for its tooltip has to be optional as well.
    vi.stubGlobal('ResizeObserver', undefined);
    stubHeaderWidth(120);
    render(<Pinned pinned={['name', 'email']} />);
    const table = screen.getByRole('table', {name: 'Products'});

    expect(table.style.getPropertyValue('--dt-pin-name')).toBe('0px');
    expect(table.style.getPropertyValue('--dt-pin-email')).toBe('120px');
  });
});
