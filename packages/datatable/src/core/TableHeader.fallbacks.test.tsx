/**
 * The header's less-travelled paths: a sticky header over the select, expand and actions
 * columns, a column the provider marks hidden, a grouped column's placeholder, and a sort
 * label that changes after mount.
 *
 * Rendered directly for the first three. Through `DataTable` the select and expand headers
 * are always frozen, and the frozen styles are appended after the sticky ones, so what the
 * sticky header itself contributes is only visible on a bare `TableHeader`. `DataTable`
 * also hides a column in the table instance and in the provider at once, and its column
 * type has no `columns` key, so neither a visibility mismatch nor a header group can be
 * produced from there.
 */
import type {ColumnDef} from '@tanstack/react-table';
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {DataTable} from '../DataTable';
import {DataTableProvider} from '../DataTableContext';
import type {TestRole} from '../test/test-utils';
import {generateTestRoles, render, screen} from '../test/test-utils';
import type {DataTableColumnDef, RowData} from '../types';
import {TableHeader} from './TableHeader';

interface Item extends RowData {
  readonly id: number;
  readonly name: string;
  readonly email: string;
}

const data: Item[] = [{id: 1, name: 'Detergent', email: 'ada@example.com'}];

const nameColumn: ColumnDef<Item> = {id: 'name', accessorKey: 'name', header: 'Name'};
const emailColumn: ColumnDef<Item> = {id: 'email', accessorKey: 'email', header: 'Email'};

interface HarnessProps {
  readonly columns: ColumnDef<Item>[];
  readonly stickyHeader?: boolean;
  readonly columnVisibility?: Record<string, boolean>;
}

function Harness({columns, stickyHeader, columnVisibility}: Readonly<HarnessProps>) {
  'use no memo';
  const table = useReactTable({data, columns, getCoreRowModel: getCoreRowModel()});

  return (
    <DataTableProvider table={table} density="comfortable" setDensity={() => {}} columnVisibility={columnVisibility}>
      <table>
        <TableHeader table={table} stickyHeader={stickyHeader} />
      </table>
    </DataTableProvider>
  );
}

/** The select and expand headers have no name of their own, so they are found by what they hold. */
function chromeHeaders(): {selectHeader: HTMLElement; expandHeader: HTMLElement} {
  const [selectHeader, expandHeader] = screen.getAllByRole('columnheader');
  expect(within(selectHeader).getByRole('checkbox', {name: 'Select all rows'})).toBeInTheDocument();
  expect(within(expandHeader).getByRole('button', {name: 'Expand All'})).toBeInTheDocument();
  return {selectHeader, expandHeader};
}

describe('TableHeader, sticky header over the chrome columns', () => {
  const chrome = (id: string): ColumnDef<Item> => ({id, header: () => null, cell: () => null});

  it('keeps the select, expand and actions headers above the rows scrolling under them', () => {
    render(<Harness columns={[chrome('select'), chrome('expand'), nameColumn, chrome('actions')]} stickyHeader />);

    const {selectHeader, expandHeader} = chromeHeaders();

    expect(selectHeader).toHaveStyle({position: 'sticky', zIndex: '10'});
    // The expand column sits after the 48px select column.
    expect(expandHeader).toHaveStyle({position: 'sticky', zIndex: '10', left: '48px'});
    expect(screen.getByRole('columnheader', {name: 'Actions'})).toHaveStyle({position: 'sticky', zIndex: '10'});
  });

  it('leaves them in the normal flow when the header is not sticky', () => {
    render(<Harness columns={[chrome('select'), chrome('expand'), nameColumn, chrome('actions')]} />);

    const {selectHeader, expandHeader} = chromeHeaders();

    expect(selectHeader).not.toHaveStyle({position: 'sticky'});
    expect(expandHeader).not.toHaveStyle({position: 'sticky'});
    expect(screen.getByRole('columnheader', {name: 'Actions'})).not.toHaveStyle({position: 'sticky'});
  });
});

describe('TableHeader, visibility from the provider', () => {
  it('renders no header for a column the provider marks hidden', () => {
    // The table instance still lists the column here. The provider is the source the
    // compiler can see changing, so it is the one the header obeys.
    render(<Harness columns={[nameColumn, emailColumn]} columnVisibility={{email: false}} />);

    expect(screen.getByRole('columnheader', {name: 'Name'})).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', {name: 'Email'})).not.toBeInTheDocument();
  });
});

describe('TableHeader, grouped columns', () => {
  it('leaves the placeholder above an ungrouped column empty', () => {
    // TanStack pads the group row with a placeholder for every column that has no group.
    // Rendering the column's own header there would print "Name" twice.
    const columns: ColumnDef<Item>[] = [nameColumn, {id: 'contact', header: 'Contact', columns: [emailColumn]}];
    render(<Harness columns={columns} />);

    const [groupRow, leafRow] = screen.getAllByRole('row');

    expect(within(groupRow).getByRole('columnheader', {name: 'Contact'})).toBeInTheDocument();
    expect(within(groupRow).queryByText('Name')).not.toBeInTheDocument();
    expect(within(leafRow).getByRole('columnheader', {name: 'Name'})).toBeInTheDocument();
    expect(within(leafRow).getByRole('columnheader', {name: 'Email'})).toBeInTheDocument();
  });
});

describe('TableHeader, sort labels', () => {
  const roleColumns: DataTableColumnDef<TestRole>[] = [
    {id: 'name', accessorKey: 'name', header: 'Name', enableSorting: true},
  ];
  const roles = generateTestRoles(2);

  it('picks up a sort label translated after mount', () => {
    // Only the one label changes, which is what a lazily loaded locale bundle does.
    const table = (sortDesc: string) => (
      <DataTable columns={roleColumns} data={roles} initialSorting={[{id: 'name', desc: false}]} labels={{sortDesc}} />
    );
    const {rerender} = render(table('Sort Z to A'));
    expect(screen.getByRole('button', {name: 'Sort Z to A'})).toBeInTheDocument();

    rerender(table('Trier de Z à A'));

    expect(screen.getByRole('button', {name: 'Trier de Z à A'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Sort Z to A'})).not.toBeInTheDocument();
  });
});
