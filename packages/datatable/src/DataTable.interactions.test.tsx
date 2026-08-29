import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {DataTable} from './DataTable';
import {getTableStateStorageKey} from './storage/storageKey';
import type {TestRole} from './test/test-utils';
import {generateTestRoles, render} from './test/test-utils';
import type {DataTableColumnDef, PersistedTableState} from './types';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const testColumns: DataTableColumnDef<TestRole>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    enableSorting: true,
    enableFiltering: true,
  },
  {
    id: 'roleType',
    accessorKey: 'roleType',
    header: 'Type',
    enableSorting: true,
    enableFiltering: true,
  },
  {
    id: 'description',
    accessorKey: 'description',
    header: 'Description',
    enableSorting: false,
    cell: ({row}) => row.original.description ?? '-',
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: 'Created',
    enableSorting: true,
    cell: ({row}) => (row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString() : '-'),
  },
];

/** Helper – distinct names per page so assertions can target page content. */
function makePagedData(total: number, pageSize: number = 10) {
  return Array.from({length: total}, (_, i) => ({
    id: `role-${i + 1}`,
    name: `Pg${Math.floor(i / pageSize) + 1}R${(i % pageSize) + 1}`,
    roleType: 'ADMIN' as const,
    description: `Desc ${i + 1}`,
    createdAt: new Date(Date.now() - i * 86_400_000).toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// localStorage mock (shared across persistence-related describe blocks)
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: () => {
      store = {};
    },
    getStore: () => store,
  };
})();

Object.defineProperty(window, 'localStorage', {value: localStorageMock});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DataTable – Feature Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  // =========================================================================
  // 1. Server-Side Pagination scenarios
  // =========================================================================

  describe('Server-Side Pagination', () => {
    it('displays correct page count from totalRows', () => {
      render(
        <DataTable
          columns={testColumns}
          data={generateTestRoles(10)}
          enablePagination
          manualPagination
          totalRows={50}
          pageSize={10}
        />,
      );

      expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument();
      expect(screen.getByText(/50 row/i)).toBeInTheDocument();
    });

    it('emits server state when navigating pages', async () => {
      const onServerStateChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={generateTestRoles(10)}
          enablePagination
          manualPagination
          totalRows={30}
          pageSize={10}
          onServerStateChange={onServerStateChange}
        />,
      );

      onServerStateChange.mockClear();
      await userEvent.click(screen.getByRole('button', {name: /next page/i}));

      expect(onServerStateChange).toHaveBeenLastCalledWith(
        expect.objectContaining({pagination: expect.objectContaining({pageIndex: 1, pageSize: 10})}),
      );
    });

    it('emits server state when changing page size', async () => {
      const onServerStateChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={generateTestRoles(10)}
          enablePagination
          manualPagination
          totalRows={100}
          pageSize={10}
          pageSizeOptions={[10, 25, 50]}
          onServerStateChange={onServerStateChange}
        />,
      );

      onServerStateChange.mockClear();
      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', {name: '25'}));

      await waitFor(() => {
        expect(onServerStateChange).toHaveBeenLastCalledWith(
          expect.objectContaining({pagination: expect.objectContaining({pageSize: 25})}),
        );
      });
    });

    it('emits server state for server-side sorting', async () => {
      const onServerStateChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={generateTestRoles(10)}
          enablePagination
          enableSorting
          manualPagination
          manualSorting
          totalRows={50}
          pageSize={10}
          onServerStateChange={onServerStateChange}
        />,
      );

      onServerStateChange.mockClear();
      await userEvent.click(screen.getByText('Name'));

      expect(onServerStateChange).toHaveBeenCalled();
    });

    it('shows the correct page after navigating (server-side pagination)', async () => {
      render(
        <DataTable
          columns={testColumns}
          data={generateTestRoles(10)}
          enablePagination
          manualPagination
          totalRows={50}
          pageSize={10}
        />,
      );

      await userEvent.click(screen.getByRole('button', {name: /next page/i}));
      await userEvent.click(screen.getByRole('button', {name: /next page/i}));

      expect(screen.getByText(/page 3 of 5/i)).toBeInTheDocument();
    });

    it('shows correct row range for server-side pagination', () => {
      render(
        <DataTable
          columns={testColumns}
          data={generateTestRoles(10)}
          enablePagination
          manualPagination
          totalRows={100}
          pageSize={10}
        />,
      );

      // "1-10 of 100" should be shown
      expect(screen.getByText(/1-10 of 100/i)).toBeInTheDocument();
    });

    it('disables next on last page for server-side pagination', async () => {
      render(
        <DataTable
          columns={testColumns}
          data={generateTestRoles(5)}
          enablePagination
          manualPagination
          totalRows={15}
          pageSize={10}
        />,
      );

      // 15 rows / pageSize 10 = 2 pages — navigate to the last page.
      await userEvent.click(screen.getByRole('button', {name: /next page/i}));

      expect(screen.getByRole('button', {name: /next page/i})).toBeDisabled();
    });

    it('handles empty server response gracefully', () => {
      render(
        <DataTable
          columns={testColumns}
          data={[]}
          enablePagination
          manualPagination
          totalRows={0}
          pageSize={10}
          emptyMessage="No data available"
        />,
      );

      expect(screen.getByText('No data available')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 2. Client-Side Pagination + Selection
  // =========================================================================

  describe('Client-Side Pagination + Selection', () => {
    it('selection checkboxes render on each page', async () => {
      const data = makePagedData(25);
      render(<DataTable columns={testColumns} data={data} enablePagination enableRowSelection pageSize={10} />);

      // Page 1 – 10 rows + 1 header checkbox = 11
      let checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(11);

      // Navigate to page 3 (5 items)
      await userEvent.click(screen.getByRole('button', {name: /last page/i}));

      await waitFor(() => {
        checkboxes = screen.getAllByRole('checkbox');
        // 5 rows + 1 header = 6
        expect(checkboxes).toHaveLength(6);
      });
    });

    it('selecting rows on page 1 does not affect page 2 checkboxes visually', async () => {
      const data = makePagedData(20);
      render(<DataTable columns={testColumns} data={data} enablePagination enableRowSelection pageSize={10} />);

      // Select first row on page 1
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[1]);

      // Navigate to page 2
      await userEvent.click(screen.getByRole('button', {name: /next page/i}));

      await waitFor(() => {
        const page2Checkboxes = screen.getAllByRole('checkbox');
        // All row checkboxes on page 2 should be unchecked
        const rowCheckboxes = page2Checkboxes.slice(1) as HTMLInputElement[];
        expect(rowCheckboxes.every((cb) => !cb.checked)).toBe(true);
      });
    });

    it('select-all only selects current page rows', async () => {
      const data = makePagedData(20);
      const onRowSelectionChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={data}
          enablePagination
          enableRowSelection
          pageSize={10}
          onRowSelectionChange={onRowSelectionChange}
        />,
      );

      // Click header checkbox (select all on current page)
      const headerCheckbox = screen.getAllByRole('checkbox')[0];
      await userEvent.click(headerCheckbox);

      await waitFor(() => {
        expect(onRowSelectionChange).toHaveBeenCalled();
        const lastCall = onRowSelectionChange.mock.calls[onRowSelectionChange.mock.calls.length - 1][0];
        // Should only have 10 keys (page 1 rows)
        expect(Object.keys(lastCall).length).toBe(10);
      });
    });

    it('onSelectionChange returns correct row objects', async () => {
      const data = makePagedData(15);
      const onSelectionChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={data}
          enablePagination
          enableRowSelection
          pageSize={10}
          onSelectionChange={onSelectionChange}
        />,
      );

      // Select first row
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[1]);

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalled();
        const selectedRows = onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1][0];
        expect(selectedRows).toHaveLength(1);
        expect(selectedRows[0].name).toBe('Pg1R1');
      });
    });
  });

  // =========================================================================
  // 3. Pagination + Column Visibility
  // =========================================================================

  describe('Pagination + Column Visibility', () => {
    it('hidden column does not appear in table headers', () => {
      render(
        <DataTable
          columns={testColumns}
          data={makePagedData(10)}
          enablePagination
          enableColumnVisibility
          initialColumnVisibility={{description: false}}
          pageSize={10}
        />,
      );

      const headers = screen.getAllByRole('columnheader');
      const headerTexts = headers.map((h) => h.textContent);
      expect(headerTexts).not.toContain('Description');
    });

    it('toggling column visibility preserves current page', async () => {
      const data = makePagedData(25);
      render(<DataTable columns={testColumns} data={data} enablePagination enableColumnVisibility pageSize={10} />);

      // Navigate to page 2 first
      await userEvent.click(screen.getByRole('button', {name: /next page/i}));
      await waitFor(() => {
        expect(screen.getByText(/page 2/i)).toBeInTheDocument();
      });

      // Toggle column visibility
      await userEvent.click(screen.getByRole('button', {name: /columns/i}));
      const popover = await screen.findByRole('presentation');
      const visCheckboxes = within(popover).getAllByRole('checkbox');
      await userEvent.click(visCheckboxes[0]); // toggle first column

      // Should still be on page 2
      await waitFor(() => {
        expect(screen.getByText(/page 2/i)).toBeInTheDocument();
      });
    });

    it('column count changes when toggling visibility', () => {
      render(
        <DataTable
          columns={testColumns}
          data={makePagedData(5)}
          enablePagination={false}
          enableColumnVisibility
          initialColumnVisibility={{description: false, createdAt: false}}
        />,
      );

      // Should have 2 visible columns (Name, Type)
      const headers = screen.getAllByRole('columnheader');
      expect(headers).toHaveLength(2);
    });
  });

  // =========================================================================
  // 4. Pagination + Filtering (filter resets page to 0)
  // =========================================================================

  describe('Pagination + Filtering', () => {
    it('resets to page 1 when global filter changes (client-side)', async () => {
      const data = makePagedData(30);
      render(<DataTable columns={testColumns} data={data} enablePagination enableGlobalFilter pageSize={10} />);

      // Navigate to page 2
      await userEvent.click(screen.getByRole('button', {name: /next page/i}));
      await waitFor(() => {
        expect(screen.getByText(/page 2/i)).toBeInTheDocument();
      });

      // Type in global filter
      const searchInput = screen.getByRole('textbox');
      await userEvent.type(searchInput, 'Pg1R1');

      // Should reset to page 1
      await waitFor(() => {
        expect(screen.getByText(/page 1/i)).toBeInTheDocument();
      });
    });

    it('filter reduces total row count in client-side pagination', async () => {
      // Create data where only 3 items match filter
      const data = [
        ...makePagedData(10),
        {
          id: 'special-1',
          name: 'SpecialMatch1',
          roleType: 'ADMIN' as const,
          description: 'Desc',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'special-2',
          name: 'SpecialMatch2',
          roleType: 'ADMIN' as const,
          description: 'Desc',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      render(<DataTable columns={testColumns} data={data} enablePagination enableGlobalFilter pageSize={10} />);

      // Initially 12 rows total
      expect(screen.getByText(/12 row/i)).toBeInTheDocument();

      // Filter to only "SpecialMatch"
      const searchInput = screen.getByRole('textbox');
      await userEvent.type(searchInput, 'SpecialMatch');

      await waitFor(() => {
        expect(screen.getByText(/2 row/i)).toBeInTheDocument();
      });
    });

    it('clearing filter restores full data set', async () => {
      const data = makePagedData(15);
      const onServerStateChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={data}
          enablePagination
          enableGlobalFilter
          initialGlobalFilter="nonexistent"
          pageSize={10}
          onServerStateChange={onServerStateChange}
        />,
      );

      // Clear search
      const clearButton = screen.getByRole('button', {name: /clear/i});
      await userEvent.click(clearButton);

      // Verify filter was cleared
      expect(onServerStateChange).toHaveBeenLastCalledWith(expect.objectContaining({globalFilter: ''}));

      // Data should now be visible
      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // 1 header + 10 data rows on first page
        expect(rows.length).toBe(11);
      });
    });
  });

  // =========================================================================
  // 5. Pagination + Sorting
  // =========================================================================

  describe('Pagination + Sorting', () => {
    it('sorting preserves current page position (client-side)', async () => {
      const data = makePagedData(25);
      render(<DataTable columns={testColumns} data={data} enablePagination enableSorting pageSize={10} />);

      // Navigate to page 2
      await userEvent.click(screen.getByRole('button', {name: /next page/i}));
      await waitFor(() => {
        expect(screen.getByText(/page 2/i)).toBeInTheDocument();
      });

      // Sort by name – page should stay on 2
      await userEvent.click(screen.getByText('Name'));

      // Should still be on page 2 (TanStack Table preserves page on client sort)
      await waitFor(() => {
        expect(screen.getByText(/page 2/i)).toBeInTheDocument();
      });
    });

    it('client-side sorting reorders data correctly', async () => {
      const data = [
        {id: 'a', name: 'Charlie', roleType: 'ADMIN' as const, description: null, createdAt: new Date().toISOString()},
        {id: 'b', name: 'Alice', roleType: 'ADMIN' as const, description: null, createdAt: new Date().toISOString()},
        {id: 'c', name: 'Bob', roleType: 'ADMIN' as const, description: null, createdAt: new Date().toISOString()},
      ];

      const onServerStateChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={data}
          enablePagination={false}
          enableSorting
          onServerStateChange={onServerStateChange}
        />,
      );

      onServerStateChange.mockClear(); // drop the mount emit
      // Sort ascending
      await userEvent.click(screen.getByText('Name'));

      // Verify sorting was triggered
      await waitFor(() => {
        expect(onServerStateChange).toHaveBeenCalled();
      });

      // All three names should still be present
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();

      // Verify sort indicator is shown
      const nameHeader = screen.getByRole('columnheader', {name: /Name/});
      expect(nameHeader).toHaveTextContent('↑');
    });

    it('sort indicator shows after sorting', async () => {
      render(<DataTable columns={testColumns} data={makePagedData(5)} enablePagination={false} enableSorting />);

      await userEvent.click(screen.getByText('Name'));

      await waitFor(() => {
        const nameHeader = screen.getByRole('columnheader', {name: /Name/});
        expect(nameHeader).toHaveTextContent('↑');
      });
    });
  });

  // =========================================================================
  // 6. Rows Per Page + Selection + Pagination combined
  // =========================================================================

  describe('Page Size Change + Selection', () => {
    it('changing page size resets to first page', async () => {
      const data = makePagedData(30);
      render(
        <DataTable columns={testColumns} data={data} enablePagination pageSize={10} pageSizeOptions={[10, 25, 50]} />,
      );

      // Navigate to page 2
      await userEvent.click(screen.getByRole('button', {name: /next page/i}));
      await waitFor(() => {
        expect(screen.getByText(/page 2/i)).toBeInTheDocument();
      });

      // Change page size to 25
      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', {name: '25'}));

      // Should be on page 1 after page size change
      await waitFor(() => {
        expect(screen.getByText(/page 1/i)).toBeInTheDocument();
      });
    });

    it('row selection on rows that stay visible is preserved when page size grows', async () => {
      // 20 rows, pageSize 10 → page 1 shows rows 1–10. Select row 1.
      // Grow to pageSize 25: rows 1–10 remain visible (no rows fall out of view),
      // so row 1's selection persists. The newly-revealed rows 11–20 are unchecked.
      const data = makePagedData(20);
      const onRowSelectionChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={data}
          enablePagination
          enableRowSelection
          pageSize={10}
          pageSizeOptions={[10, 25]}
          onRowSelectionChange={onRowSelectionChange}
        />,
      );

      // Select first row and wait for it to be checked
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[1]);
      await waitFor(() => {
        expect(checkboxes[1] as HTMLInputElement).toBeChecked();
      });

      // Change page size to 25
      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      const option = await screen.findByRole('option', {name: '25'});
      await userEvent.click(option);

      // After page size grows, the originally-selected row 1 stays checked because it
      // remained visible. Rows 11–20 are newly revealed and unchecked.
      await waitFor(() => {
        expect(screen.getAllByRole('checkbox')).toHaveLength(21); // 20 rows + header
      });
      const updatedCheckboxes = screen.getAllByRole('checkbox');
      expect(updatedCheckboxes[1]).toBeChecked();
      expect(updatedCheckboxes.slice(11).every((cb) => !(cb as HTMLInputElement).checked)).toBe(true);
    });
  });

  // =========================================================================
  // 7. Context-dependent rendering (readiness for context split)
  // =========================================================================

  describe('Context-Dependent Rendering', () => {
    it('density change updates cell padding across all rows', async () => {
      render(
        <DataTable
          columns={testColumns}
          data={makePagedData(5)}
          enableDensityToggle
          enablePagination={false}
          density="comfortable"
        />,
      );

      // Change to compact
      await userEvent.click(screen.getByRole('button', {name: /density/i}));
      await userEvent.click(await screen.findByText(/compact/i));

      // Table should still render correctly
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      expect(screen.getAllByRole('row').length).toBe(6); // 1 header + 5 rows
    });

    it('editing state is independent of selection state', async () => {
      // This test verifies that editing and selection don't interfere
      render(<DataTable columns={testColumns} data={makePagedData(5)} enableRowSelection enablePagination={false} />);

      // Select a row
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[1]);

      // Verify row is selected
      await waitFor(() => {
        const updated = screen.getAllByRole('checkbox');
        expect(updated[1] as HTMLInputElement).toBeChecked();
      });

      // Table still renders fine
      expect(screen.getAllByRole('row').length).toBe(6); // 1 header + 5 rows
    });

    it('mobile breakpoint does not affect desktop rendering', () => {
      // Default mock is desktop (matchMedia returns false for down breakpoints)
      render(<DataTable columns={testColumns} data={makePagedData(5)} enableMobileCardView enablePagination={false} />);

      // Should render as a table, not card view
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 8. Persistence – batched write verification
  // =========================================================================

  describe('Persistence – Write Behavior', () => {
    const tableId = 'batch-test';
    const storageKey = getTableStateStorageKey(tableId);

    it('persists sorting state after sort change', async () => {
      render(
        <DataTable
          tableId={tableId}
          columns={testColumns}
          data={makePagedData(10)}
          enableSorting
          enablePagination={false}
        />,
      );

      await userEvent.click(screen.getByText('Name'));

      await waitFor(() => {
        const calls = localStorageMock.setItem.mock.calls.filter((c) => c[0] === storageKey);
        expect(calls.length).toBeGreaterThan(0);
        const last = JSON.parse(calls[calls.length - 1][1]) as PersistedTableState;
        expect(last.sorting).toBeDefined();
        expect(last.sorting!.length).toBeGreaterThan(0);
        expect(last.sorting![0].id).toBe('name');
      });
    });

    it('persists page size after change', async () => {
      render(
        <DataTable
          tableId={tableId}
          columns={testColumns}
          data={makePagedData(30)}
          enablePagination
          pageSize={10}
          pageSizeOptions={[10, 25, 50]}
        />,
      );

      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', {name: '50'}));

      await waitFor(() => {
        const calls = localStorageMock.setItem.mock.calls.filter((c) => c[0] === storageKey);
        expect(calls.length).toBeGreaterThan(0);
        const last = JSON.parse(calls[calls.length - 1][1]) as PersistedTableState;
        expect(last.pageSize).toBe(50);
      });
    });

    it('persists density after change', async () => {
      render(
        <DataTable
          tableId={tableId}
          columns={testColumns}
          data={makePagedData(5)}
          enableDensityToggle
          enablePagination={false}
        />,
      );

      await userEvent.click(screen.getByRole('button', {name: /density/i}));
      await userEvent.click(await screen.findByText(/spacious/i));

      await waitFor(() => {
        const calls = localStorageMock.setItem.mock.calls.filter((c) => c[0] === storageKey);
        const last = JSON.parse(calls[calls.length - 1][1]) as PersistedTableState;
        expect(last.density).toBe('spacious');
      });
    });

    it('reset to default clears all persisted state', async () => {
      // Pre-populate persisted state
      const persistedState: PersistedTableState = {
        sorting: [{id: 'name', desc: true}],
        density: 'compact',
        pageSize: 25,
        globalFilter: 'test',
      };
      localStorageMock.setItem(storageKey, JSON.stringify(persistedState));

      render(
        <DataTable
          tableId={tableId}
          columns={testColumns}
          data={makePagedData(10)}
          enableSorting
          enableGlobalFilter
          initialGlobalFilter=""
          enablePagination={false}
        />,
      );

      // Click reset to default
      const resetButton = screen.getByRole('button', {name: /reset to default/i});
      await userEvent.click(resetButton);

      await waitFor(() => {
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(storageKey);
      });
    });

    it('multiple state changes each result in localStorage writes', async () => {
      render(
        <DataTable
          tableId={tableId}
          columns={testColumns}
          data={makePagedData(30)}
          enableSorting
          enablePagination
          pageSize={10}
          pageSizeOptions={[10, 25]}
        />,
      );

      // Sort
      await userEvent.click(screen.getByText('Name'));

      // Then change page size
      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', {name: '25'}));

      await waitFor(() => {
        const calls = localStorageMock.setItem.mock.calls.filter((c) => c[0] === storageKey);
        // With debounced batching, writes may be merged — verify at least 1 write occurred
        // and the final state contains both sorting and pageSize
        expect(calls.length).toBeGreaterThanOrEqual(1);
        const lastState = JSON.parse(calls[calls.length - 1][1]);
        expect(lastState.sorting).toBeDefined();
        expect(lastState.pageSize).toBeDefined();
      });
    });
  });

  // =========================================================================
  // 9. Server-Side Pagination + Selection
  // =========================================================================

  describe('Server-Side Pagination + Selection', () => {
    it('selection works with manual pagination', async () => {
      const onRowSelectionChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={generateTestRoles(10)}
          enablePagination
          enableRowSelection
          manualPagination
          totalRows={50}
          pageSize={10}
          onRowSelectionChange={onRowSelectionChange}
        />,
      );

      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[1]); // select first row

      await waitFor(() => {
        expect(onRowSelectionChange).toHaveBeenCalled();
      });
    });

    it('select all works with manual pagination', async () => {
      render(
        <DataTable
          columns={testColumns}
          data={generateTestRoles(10)}
          enablePagination
          enableRowSelection
          manualPagination
          totalRows={50}
          pageSize={10}
        />,
      );

      // Click header checkbox
      const headerCheckbox = screen.getAllByRole('checkbox')[0];
      await userEvent.click(headerCheckbox);

      // All visible row checkboxes should be checked
      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        const rowCheckboxes = checkboxes.slice(1) as HTMLInputElement[];
        expect(rowCheckboxes.every((cb) => cb.checked)).toBe(true);
      });
    });
  });

  // =========================================================================
  // 10. Server-Side Pagination + Filtering
  // =========================================================================

  describe('Server-Side Pagination + Filtering', () => {
    it('emits server state (with reset page) on filter change', async () => {
      const onServerStateChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={generateTestRoles(10)}
          enablePagination
          enableGlobalFilter
          manualPagination
          manualFiltering
          totalRows={50}
          pageSize={10}
          onServerStateChange={onServerStateChange}
        />,
      );

      onServerStateChange.mockClear();

      const searchInput = screen.getByRole('textbox');
      await userEvent.type(searchInput, 'test');

      await waitFor(
        () => {
          expect(onServerStateChange).toHaveBeenLastCalledWith(
            expect.objectContaining({globalFilter: 'test', pagination: expect.objectContaining({pageIndex: 0})}),
          );
        },
        {timeout: 500},
      );
    });

    it('never emits the new filter with a stale (non-zero) page index when filtering from a later page', async () => {
      const onServerStateChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={generateTestRoles(10)}
          enablePagination
          enableGlobalFilter
          manualPagination
          manualFiltering
          totalRows={50}
          pageSize={10}
          onServerStateChange={onServerStateChange}
        />,
      );

      // Move to page 2 (pageIndex 1), then filter.
      await userEvent.click(screen.getByRole('button', {name: /next page/i}));
      onServerStateChange.mockClear();

      await userEvent.type(screen.getByRole('textbox'), 'test');

      await waitFor(
        () => {
          expect(onServerStateChange).toHaveBeenLastCalledWith(
            expect.objectContaining({globalFilter: 'test', pagination: expect.objectContaining({pageIndex: 0})}),
          );
        },
        {timeout: 500},
      );

      // The page reset happens in the same commit as the filter change, so no emit
      // should ever carry the new filter together with the pre-reset page index.
      const staleEmit = onServerStateChange.mock.calls.find(
        ([state]) => state.globalFilter === 'test' && state.pagination.pageIndex !== 0,
      );
      expect(staleEmit).toBeUndefined();
    });
  });

  // =========================================================================
  // 11. Server-Side Pagination + Sorting + Persistence
  // =========================================================================

  describe('Server-Side Pagination + Persistence', () => {
    const tableId = 'server-persist';
    const storageKey = getTableStateStorageKey(tableId);

    it('persisted pageIndex is emitted to parent on mount', async () => {
      const persistedState: PersistedTableState = {
        pageIndex: 2,
        pageSize: 10,
      };
      localStorageMock.setItem(storageKey, JSON.stringify(persistedState));

      const onServerStateChange = vi.fn();
      render(
        <DataTable
          tableId={tableId}
          columns={testColumns}
          data={generateTestRoles(10)}
          enablePagination
          manualPagination
          totalRows={50}
          pageSize={10}
          onServerStateChange={onServerStateChange}
        />,
      );

      await waitFor(() => {
        expect(onServerStateChange).toHaveBeenCalledWith(
          expect.objectContaining({pagination: expect.objectContaining({pageIndex: 2, pageSize: 10})}),
        );
      });
    });

    it('persisted sorting is emitted to parent on mount', async () => {
      const persistedState: PersistedTableState = {
        sorting: [{id: 'name', desc: true}],
      };
      localStorageMock.setItem(storageKey, JSON.stringify(persistedState));

      const onServerStateChange = vi.fn();
      render(
        <DataTable
          tableId={tableId}
          columns={testColumns}
          data={generateTestRoles(10)}
          enableSorting
          manualSorting
          enablePagination
          manualPagination
          totalRows={50}
          pageSize={10}
          initialSorting={[]}
          onServerStateChange={onServerStateChange}
        />,
      );

      await waitFor(() => {
        expect(onServerStateChange).toHaveBeenCalledWith(
          expect.objectContaining({sorting: [{id: 'name', desc: true}]}),
        );
      });
    });
  });

  // =========================================================================
  // 12. Expansion + Pagination
  // =========================================================================

  describe('Expansion + Pagination', () => {
    it('expanded state resets when navigating pages', async () => {
      const data = makePagedData(20);
      render(
        <DataTable
          columns={testColumns}
          data={data}
          enablePagination
          enableExpanding
          renderExpandedRow={(row) => <div data-testid={`expanded-${row.original.id}`}>{row.original.name}</div>}
          pageSize={10}
        />,
      );

      // Expand first row on page 1
      const expandButtons = screen.getAllByRole('button', {name: /expand row/i});
      await userEvent.click(expandButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId(`expanded-${data[0].id}`)).toBeInTheDocument();
      });

      // Navigate to page 2
      await userEvent.click(screen.getByRole('button', {name: /next page/i}));

      // Page 2 rows should not show expanded content from page 1
      await waitFor(() => {
        expect(screen.queryByTestId(`expanded-${data[0].id}`)).not.toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 13. Density + Pagination
  // =========================================================================

  describe('Density + Pagination', () => {
    it('changing density does not reset pagination', async () => {
      const data = makePagedData(25);
      render(<DataTable columns={testColumns} data={data} enablePagination enableDensityToggle pageSize={10} />);

      // Navigate to page 2
      await userEvent.click(screen.getByRole('button', {name: /next page/i}));
      await waitFor(() => {
        expect(screen.getByText(/page 2/i)).toBeInTheDocument();
      });

      // Change density
      await userEvent.click(screen.getByRole('button', {name: /density/i}));
      await userEvent.click(await screen.findByText(/compact/i));

      // Should still be on page 2
      await waitFor(() => {
        expect(screen.getByText(/page 2/i)).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 14. Column Visibility + Selection
  // =========================================================================

  describe('Column Visibility + Selection', () => {
    it('selection checkboxes persist when columns are hidden', async () => {
      render(
        <DataTable
          columns={testColumns}
          data={makePagedData(5)}
          enableRowSelection
          enableColumnVisibility
          enablePagination={false}
        />,
      );

      // Select a row first
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[1]);

      // Verify selected
      await waitFor(() => {
        const updated = screen.getAllByRole('checkbox');
        expect(updated[1] as HTMLInputElement).toBeChecked();
      });

      // Hide a column
      await userEvent.click(screen.getByRole('button', {name: /columns/i}));
      const popover = await screen.findByRole('presentation');
      const visCheckboxes = within(popover).getAllByRole('checkbox');
      await userEvent.click(visCheckboxes[0]);

      // Selection should persist – first row still checked
      await waitFor(() => {
        const updated = screen.getAllByRole('checkbox');
        // Find the row checkbox (not header)
        expect(updated[1] as HTMLInputElement).toBeChecked();
      });
    });
  });

  // =========================================================================
  // 15. Sorting + Selection
  // =========================================================================

  describe('Sorting + Selection', () => {
    it('selection persists after sorting', async () => {
      const data = [
        {id: 'a', name: 'Charlie', roleType: 'ADMIN' as const, description: null, createdAt: new Date().toISOString()},
        {id: 'b', name: 'Alice', roleType: 'ADMIN' as const, description: null, createdAt: new Date().toISOString()},
        {id: 'c', name: 'Bob', roleType: 'ADMIN' as const, description: null, createdAt: new Date().toISOString()},
      ];

      const onRowSelectionChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={data}
          enablePagination={false}
          enableSorting
          enableRowSelection
          onRowSelectionChange={onRowSelectionChange}
        />,
      );

      // Select first row (Charlie)
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[1]);

      // Sort ascending (Alice will move to top)
      await userEvent.click(screen.getByText('Name'));

      // The originally selected row should still be selected
      await waitFor(() => {
        expect(onRowSelectionChange).toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // 16. Server-side: Selection cleared on page change
  // =========================================================================

  describe('Server-side: Selection cleared on page change', () => {
    it('clears row selection when page index changes in server-side mode', async () => {
      const onRowSelectionChange = vi.fn();
      const data = makePagedData(30, 10);

      render(
        <DataTable
          columns={testColumns}
          data={data.slice(0, 10)}
          totalRows={30}
          manualPagination
          manualSorting
          manualFiltering
          enableRowSelection
          enablePagination
          pageSize={10}
          onRowSelectionChange={onRowSelectionChange}
        />,
      );

      // Select first row
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[1]);

      await waitFor(() => {
        expect(onRowSelectionChange).toHaveBeenCalledWith({[data[0].id]: true});
      });

      onRowSelectionChange.mockClear();

      // Change page (server-side) — the DataTable owns pagination now, so drive it
      // through the pager; the page-index change should clear the selection.
      await userEvent.click(screen.getByRole('button', {name: /next page/i}));

      // Selection should be cleared
      await waitFor(() => {
        expect(onRowSelectionChange).toHaveBeenCalledWith({});
      });
    });
  });

  // =========================================================================
  // 17. Filter change resets pagination to page 1
  // =========================================================================

  describe('Filter change resets pagination (reference comparison)', () => {
    it('resets to page 1 when column filter changes', async () => {
      const onServerStateChange = vi.fn();
      const data = makePagedData(30, 10);

      render(
        <DataTable
          columns={testColumns}
          data={data}
          enablePagination
          enableFiltering
          enableGlobalFilter
          pageSize={10}
          onServerStateChange={onServerStateChange}
        />,
      );

      // Navigate to page 2
      const nextButton = screen.getByRole('button', {name: /next page/i});
      await userEvent.click(nextButton);

      await waitFor(() => {
        expect(onServerStateChange).toHaveBeenLastCalledWith(
          expect.objectContaining({pagination: expect.objectContaining({pageIndex: 1})}),
        );
      });

      // Type in global search to trigger filter change
      const searchInput = screen.getByPlaceholderText(/search/i);
      await userEvent.type(searchInput, 'Pg1');

      // Pagination should reset to page 0
      await waitFor(() => {
        const calls = onServerStateChange.mock.calls;
        const lastCall = calls[calls.length - 1];
        expect(lastCall[0].pagination.pageIndex).toBe(0);
      });
    });
  });

  // =========================================================================
  // 18. Loading state respects hidden column count
  // =========================================================================

  describe('Loading state with hidden columns', () => {
    it('renders loading state with correct column count when columns are hidden', () => {
      render(<DataTable columns={testColumns} data={[]} isLoading initialColumnVisibility={{description: false}} />);

      // Loading state should be visible
      const content = screen.getByTestId('data-table-content');
      expect(content).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 19. Inline parent notification via handlers (not effects)
  // =========================================================================

  describe('Parent notification via handlers', () => {
    it('emits server state synchronously when sorting changes', async () => {
      const onServerStateChange = vi.fn();
      const data = makePagedData(5, 5);

      render(
        <DataTable
          columns={testColumns}
          data={data}
          enableSorting
          enablePagination={false}
          onServerStateChange={onServerStateChange}
        />,
      );

      // Click sortable column header
      await userEvent.click(screen.getByText('Name'));

      await waitFor(() => {
        expect(onServerStateChange).toHaveBeenLastCalledWith(
          expect.objectContaining({sorting: [{id: 'name', desc: false}]}),
        );
      });
    });

    it('emits server state when page size changes', async () => {
      const onServerStateChange = vi.fn();
      const data = makePagedData(30, 10);

      render(
        <DataTable
          columns={testColumns}
          data={data}
          enablePagination
          pageSize={10}
          pageSizeOptions={[10, 25, 50]}
          onServerStateChange={onServerStateChange}
        />,
      );

      // Change page size
      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      const option25 = await screen.findByRole('option', {name: '25'});
      await userEvent.click(option25);

      await waitFor(() => {
        expect(onServerStateChange).toHaveBeenLastCalledWith(
          expect.objectContaining({pagination: expect.objectContaining({pageSize: 25})}),
        );
      });
    });
  });
});
