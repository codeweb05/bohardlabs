import {waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {DataTable} from './DataTable';
import {getTableStateStorageKey} from './storage/storageKey';
import type {TestRole} from './test/test-utils';
import {generateTestRoles, render} from './test/test-utils';
import type {DataTableColumnDef, ServerTableState} from './types';

const testData = generateTestRoles(3);

const testColumns: DataTableColumnDef<TestRole>[] = [
  {id: 'name', accessorKey: 'name', header: 'Name'},
  {id: 'roleType', accessorKey: 'roleType', header: 'Type'},
];

const TABLE_ID = 'server-state-test';

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('DataTable onServerStateChange (DataTable-owns-state model)', () => {
  it('emits the DEFAULT page size on mount when nothing is persisted', async () => {
    const onServerStateChange = vi.fn<(state: ServerTableState) => void>();

    render(
      <DataTable
        tableId={TABLE_ID}
        columns={testColumns}
        data={testData}
        manualPagination
        pageSize={50}
        onServerStateChange={onServerStateChange}
      />,
    );

    await waitFor(() => expect(onServerStateChange).toHaveBeenCalled());
    expect(onServerStateChange.mock.calls.every(([s]) => s.pagination.pageSize === 50)).toBe(true);
  });

  it('emits the PERSISTED page size on mount — never the default — so the parent fires one request at the right size', async () => {
    // Simulate a prior session where the user set rows-per-page to 100.
    localStorage.setItem(getTableStateStorageKey(TABLE_ID), JSON.stringify({pageSize: 100, pageIndex: 0}));

    const onServerStateChange = vi.fn<(state: ServerTableState) => void>();

    render(
      <DataTable
        tableId={TABLE_ID}
        columns={testColumns}
        data={testData}
        manualPagination
        pageSize={50} // default differs from persisted 100
        onServerStateChange={onServerStateChange}
      />,
    );

    await waitFor(() => expect(onServerStateChange).toHaveBeenCalled());

    // The regression: the parent must never observe the default (50) page size,
    // which previously caused a limit=50 request before the persisted limit=100 one.
    const emittedPageSizes = onServerStateChange.mock.calls.map(([s]) => s.pagination.pageSize);
    expect(emittedPageSizes).not.toContain(50);
    expect(emittedPageSizes.every((size) => size === 100)).toBe(true);
  });
});
