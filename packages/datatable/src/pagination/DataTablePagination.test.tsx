/**
 * `DataTablePagination` on its own.
 *
 * `DataTable` passes it a page-size list and a provider that always carries the pagination
 * state, and it never mounts the footer for an empty table. So three things were only ever
 * seen in one form: the switches that hide parts of the footer, the fallback to the table's
 * own state when the provider has none, and a page-size change with no rows to re-slice.
 *
 * The harness is a bare TanStack table with none of the manual flags `DataTable` sets, which
 * is the arrangement a consumer composing the pieces by hand ends up with.
 */
import type {PaginationState} from '@tanstack/react-table';
import {getCoreRowModel, getFilteredRowModel, getPaginationRowModel, useReactTable} from '@tanstack/react-table';
import userEvent from '@testing-library/user-event';
import type {ComponentProps} from 'react';
import {useState} from 'react';
import {describe, expect, it} from 'vitest';

import {DataTableProvider} from '../DataTableContext';
import type {TestRole} from '../test/test-utils';
import {generateTestRoles, render, screen} from '../test/test-utils';
import type {DataTableColumnDef} from '../types';
import {DataTablePagination} from './DataTablePagination';

const columns: DataTableColumnDef<TestRole>[] = [{id: 'name', accessorKey: 'name', header: 'Name'}];

interface HarnessProps extends Omit<ComponentProps<typeof DataTablePagination<TestRole>>, 'table'> {
  readonly data?: TestRole[];
  /** Off for the one test that reads the page off the table instead of the provider. */
  readonly provideState?: boolean;
}

const thirtyRoles = generateTestRoles(30);
const noRoles: TestRole[] = [];

function Harness({data = thirtyRoles, provideState = true, ...paginationProps}: Readonly<HarnessProps>) {
  'use no memo';
  const [pagination, setPagination] = useState<PaginationState>({pageIndex: 0, pageSize: 10});
  const table = useReactTable({
    data,
    columns,
    state: {pagination},
    onPaginationChange: setPagination,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <DataTableProvider
      table={table}
      density="comfortable"
      setDensity={() => {}}
      pagination={provideState ? pagination : undefined}
    >
      <DataTablePagination table={table} {...paginationProps} />
    </DataTableProvider>
  );
}

describe('DataTablePagination with only a table', () => {
  it('reads the page off the table when the provider carries none', () => {
    render(<Harness provideState={false} />);

    expect(screen.getByText('30 row(s) total.')).toBeInTheDocument();
    expect(screen.getByText('1-10 of 30')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'First page'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Last page'})).toBeEnabled();
  });

  it('moves with the table when the next page is asked for', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', {name: 'Next page'}));

    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(screen.getByText('11-20 of 30')).toBeInTheDocument();
  });

  it('offers the default page sizes', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('combobox', {name: 'Rows per page'}));

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['10', '25', '50', '100']);
  });

  it('ignores a total passed in when the table pages its own rows', () => {
    // `totalRows` is the server's count. A table that filters and pages locally knows better.
    render(<Harness totalRows={999} />);

    expect(screen.getByText('30 row(s) total.')).toBeInTheDocument();
  });

  it('stays on page one of one when the page size changes with no rows', async () => {
    const user = userEvent.setup();
    render(<Harness data={noRoles} />);
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', {name: 'Rows per page'}));
    await user.click(screen.getByRole('option', {name: '25'}));

    expect(screen.getByRole('combobox', {name: 'Rows per page'})).toHaveTextContent('25');
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    expect(screen.getByText('0 row(s) total.')).toBeInTheDocument();
  });
});

describe('DataTablePagination, hiding parts of the footer', () => {
  it('drops the page-size selector', () => {
    render(<Harness showRowsPerPage={false} />);

    expect(screen.queryByRole('combobox', {name: 'Rows per page'})).not.toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('drops the row range', () => {
    render(<Harness showPageInfo={false} />);

    expect(screen.queryByText('1-10 of 30')).not.toBeInTheDocument();
    expect(screen.getByText('30 row(s) total.')).toBeInTheDocument();
  });

  it('drops the first and last buttons and keeps previous and next', () => {
    render(<Harness showFirstLastButtons={false} />);

    expect(screen.queryByRole('button', {name: 'First page'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Last page'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Previous page'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next page'})).toBeInTheDocument();
  });
});
