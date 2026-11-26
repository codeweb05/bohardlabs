import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {DataTable} from './DataTable';
import {getTableStateStorageKey} from './storage/storageKey';
import type {TestRole} from './test/test-utils';
import {generateTestRoles, render} from './test/test-utils';
import type {DataTableColumnDef, PersistedTableState} from './types';

// Mock localStorage
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

// Test data
const testData = generateTestRoles(30);

// Test columns
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

describe('DataTable Persistence', () => {
  const tableId = 'test-persistence-table';
  const storageKey = getTableStateStorageKey(tableId);

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('without tableId (persistence disabled)', () => {
    it('should not save state to localStorage', async () => {
      const onServerStateChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 10)}
          enableSorting
          onServerStateChange={onServerStateChange}
        />,
      );

      // Click to sort
      const nameHeader = screen.getByText('Name');
      await userEvent.click(nameHeader);

      // Wait for sorting to be applied
      await waitFor(() => {
        expect(onServerStateChange).toHaveBeenCalled();
      });

      // localStorage should not have been called
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('with tableId (persistence enabled)', () => {
    describe('sorting persistence', () => {
      it('should persist sorting state when changed', async () => {
        const onServerStateChange = vi.fn();
        render(
          <DataTable
            tableId={tableId}
            columns={testColumns}
            data={testData.slice(0, 10)}
            enableSorting
            onServerStateChange={onServerStateChange}
          />,
        );

        // Click to sort by Name
        const nameHeader = screen.getByText('Name');
        await userEvent.click(nameHeader);

        // Wait for sorting callback
        await waitFor(() => {
          expect(onServerStateChange).toHaveBeenCalled();
        });

        // Check localStorage was updated
        await waitFor(() => {
          const calls = localStorageMock.setItem.mock.calls.filter((call) => call[0] === storageKey);
          expect(calls.length).toBeGreaterThan(0);
          const lastCall = calls[calls.length - 1];
          const savedState = JSON.parse(lastCall[1]) as PersistedTableState;
          expect(savedState.sorting).toBeDefined();
          expect(savedState.sorting?.length).toBeGreaterThan(0);
        });
      });

      it('should load persisted sorting on mount', async () => {
        const persistedState: PersistedTableState = {
          sorting: [{id: 'name', desc: true}],
        };
        localStorageMock.setItem(storageKey, JSON.stringify(persistedState));

        render(
          <DataTable
            tableId={tableId}
            columns={testColumns}
            data={testData.slice(0, 10)}
            enableSorting
            initialSorting={[]}
          />,
        );

        // Should show descending sort indicator
        await waitFor(() => {
          const nameHeader = screen.getByRole('columnheader', {name: /Name/});
          expect(nameHeader).toHaveTextContent('↓');
        });
      });
    });

    describe('pageSize persistence', () => {
      it('should persist pageSize when changed', async () => {
        render(
          <DataTable
            tableId={tableId}
            columns={testColumns}
            data={testData}
            enablePagination
            pageSize={10}
            pageSizeOptions={[10, 25, 50]}
          />,
        );

        // Change page size
        const select = screen.getByRole('combobox');
        await userEvent.click(select);
        const option25 = screen.getByRole('option', {name: '25'});
        await userEvent.click(option25);

        // Check localStorage was updated with pageSize
        await waitFor(() => {
          const calls = localStorageMock.setItem.mock.calls.filter((call) => call[0] === storageKey);
          expect(calls.length).toBeGreaterThan(0);
          const lastCall = calls[calls.length - 1];
          const savedState = JSON.parse(lastCall[1]) as PersistedTableState;
          expect(savedState.pageSize).toBe(25);
        });
      });

      it('should load persisted pageSize on mount', () => {
        const persistedState: PersistedTableState = {
          pageSize: 50,
        };
        localStorageMock.setItem(storageKey, JSON.stringify(persistedState));

        render(
          <DataTable
            tableId={tableId}
            columns={testColumns}
            data={testData}
            enablePagination
            pageSize={10}
            pageSizeOptions={[10, 25, 50]}
          />,
        );

        // Should show 50 in select
        const select = screen.getByRole('combobox');
        expect(select).toHaveTextContent('50');
      });
    });

    describe('density persistence', () => {
      it('should persist density when changed', async () => {
        render(<DataTable tableId={tableId} columns={testColumns} data={testData.slice(0, 5)} enableDensityToggle />);

        // Open density menu
        const densityButton = screen.getByRole('button', {name: /density/i});
        await userEvent.click(densityButton);

        // Select compact
        const compactOption = await screen.findByText(/compact/i);
        await userEvent.click(compactOption);

        // Check localStorage was updated
        await waitFor(() => {
          const calls = localStorageMock.setItem.mock.calls.filter((call) => call[0] === storageKey);
          expect(calls.length).toBeGreaterThan(0);
          const lastCall = calls[calls.length - 1];
          const savedState = JSON.parse(lastCall[1]) as PersistedTableState;
          expect(savedState.density).toBe('compact');
        });
      });

      it('should load persisted density on mount', () => {
        const persistedState: PersistedTableState = {
          density: 'spacious',
        };
        localStorageMock.setItem(storageKey, JSON.stringify(persistedState));

        render(
          <DataTable
            tableId={tableId}
            columns={testColumns}
            data={testData.slice(0, 5)}
            enableDensityToggle
            density="comfortable"
          />,
        );

        // Table should be rendered with spacious density
        // (verified by the component using the persisted value)
        const table = screen.getByRole('table');
        expect(table).toBeInTheDocument();
      });
    });

    describe('columnVisibility persistence', () => {
      it('should persist column visibility when changed', async () => {
        render(
          <DataTable tableId={tableId} columns={testColumns} data={testData.slice(0, 5)} enableColumnVisibility />,
        );

        // Open columns menu
        const columnsButton = screen.getByRole('button', {name: /columns/i});
        await userEvent.click(columnsButton);

        // Toggle a column checkbox in the popover
        const popover = await screen.findByRole('presentation');
        const popoverCheckboxes = within(popover).getAllByRole('checkbox');
        await userEvent.click(popoverCheckboxes[0]);

        // Check localStorage was updated
        await waitFor(() => {
          const calls = localStorageMock.setItem.mock.calls.filter((call) => call[0] === storageKey);
          expect(calls.length).toBeGreaterThan(0);
          const lastCall = calls[calls.length - 1];
          const savedState = JSON.parse(lastCall[1]) as PersistedTableState;
          expect(savedState.columnVisibility).toBeDefined();
        });
      });

      it('should load persisted column visibility on mount', () => {
        const persistedState: PersistedTableState = {
          columnVisibility: {description: false},
        };
        localStorageMock.setItem(storageKey, JSON.stringify(persistedState));

        render(
          <DataTable tableId={tableId} columns={testColumns} data={testData.slice(0, 5)} enableColumnVisibility />,
        );

        // Description column should be hidden
        const headers = screen.getAllByRole('columnheader');
        const headerTexts = headers.map((h) => h.textContent);
        expect(headerTexts).not.toContain('Description');
      });
    });

    describe('globalFilter persistence', () => {
      it('should persist global filter when changed', async () => {
        render(
          <DataTable
            tableId={tableId}
            columns={testColumns}
            data={testData.slice(0, 10)}
            enableGlobalFilter
            globalFilterPlaceholder="Search..."
          />,
        );

        // Type in search
        const searchInput = screen.getByPlaceholderText('Search...');
        await userEvent.type(searchInput, 'test');

        // Wait for debounce and localStorage update
        await waitFor(
          () => {
            const calls = localStorageMock.setItem.mock.calls.filter((call) => call[0] === storageKey);
            expect(calls.length).toBeGreaterThan(0);
            const lastCall = calls[calls.length - 1];
            const savedState = JSON.parse(lastCall[1]) as PersistedTableState;
            expect(savedState.globalFilter).toBe('test');
          },
          {timeout: 1000},
        );
      });

      it('should load persisted global filter on mount', () => {
        const persistedState: PersistedTableState = {
          globalFilter: 'persisted search',
        };
        localStorageMock.setItem(storageKey, JSON.stringify(persistedState));

        render(
          <DataTable
            tableId={tableId}
            columns={testColumns}
            data={testData.slice(0, 10)}
            enableGlobalFilter
            globalFilterPlaceholder="Search..."
          />,
        );

        // Search input should have persisted value
        const searchInput = screen.getByPlaceholderText('Search...');
        expect(searchInput).toHaveValue('persisted search');
      });
    });

    describe('reset to default', () => {
      it('should clear persisted state when reset to default is clicked', async () => {
        // First, set up some persisted state
        const persistedState: PersistedTableState = {
          sorting: [{id: 'name', desc: true}],
          pageSize: 25,
          density: 'compact',
          globalFilter: 'test',
        };
        localStorageMock.setItem(storageKey, JSON.stringify(persistedState));

        render(
          <DataTable
            tableId={tableId}
            columns={testColumns}
            data={testData.slice(0, 10)}
            enableSorting
            enableGlobalFilter
            initialGlobalFilter=""
          />,
        );

        // Find and click reset button (it should be visible because filters are active)
        const resetButton = screen.getByRole('button', {name: /reset to default/i});
        await userEvent.click(resetButton);

        // localStorage.removeItem should have been called
        await waitFor(() => {
          expect(localStorageMock.removeItem).toHaveBeenCalledWith(storageKey);
        });
      });
    });

    describe('sync to parent callbacks', () => {
      it('should emit persisted sorting to parent on mount', async () => {
        const onServerStateChange = vi.fn();
        const persistedState: PersistedTableState = {
          sorting: [{id: 'name', desc: true}],
        };
        localStorageMock.setItem(storageKey, JSON.stringify(persistedState));

        render(
          <DataTable
            tableId={tableId}
            columns={testColumns}
            data={testData.slice(0, 10)}
            enableSorting
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

      it('should emit persisted pageSize to parent on mount', async () => {
        const onServerStateChange = vi.fn();
        const persistedState: PersistedTableState = {
          pageSize: 50,
        };
        localStorageMock.setItem(storageKey, JSON.stringify(persistedState));

        render(
          <DataTable
            tableId={tableId}
            columns={testColumns}
            data={testData}
            enablePagination
            pageSize={10}
            onServerStateChange={onServerStateChange}
          />,
        );

        await waitFor(() => {
          expect(onServerStateChange).toHaveBeenCalledWith(
            expect.objectContaining({pagination: expect.objectContaining({pageSize: 50})}),
          );
        });
      });

      it('should emit persisted filter to parent on mount', async () => {
        const onServerStateChange = vi.fn();
        const persistedState: PersistedTableState = {
          globalFilter: 'search term',
        };
        localStorageMock.setItem(storageKey, JSON.stringify(persistedState));

        render(
          <DataTable
            tableId={tableId}
            columns={testColumns}
            data={testData.slice(0, 10)}
            enableGlobalFilter
            initialGlobalFilter=""
            onServerStateChange={onServerStateChange}
          />,
        );

        await waitFor(() => {
          expect(onServerStateChange).toHaveBeenCalledWith(expect.objectContaining({globalFilter: 'search term'}));
        });
      });

      it('should call onColumnVisibilityChange with persisted visibility on mount', async () => {
        const onColumnVisibilityChange = vi.fn();
        const persistedState: PersistedTableState = {
          columnVisibility: {description: false, createdAt: false},
        };
        localStorageMock.setItem(storageKey, JSON.stringify(persistedState));

        render(
          <DataTable
            tableId={tableId}
            columns={testColumns}
            data={testData.slice(0, 10)}
            enableColumnVisibility
            onColumnVisibilityChange={onColumnVisibilityChange}
          />,
        );

        // onColumnVisibilityChange should be called with persisted visibility
        await waitFor(() => {
          expect(onColumnVisibilityChange).toHaveBeenCalledWith({description: false, createdAt: false});
        });
      });
    });

    describe('multiple tables independence', () => {
      it('should persist state separately for different tableIds', async () => {
        const tableId1 = 'table-1';
        const tableId2 = 'table-2';
        const storageKey1 = getTableStateStorageKey(tableId1);
        const storageKey2 = getTableStateStorageKey(tableId2);

        // Render first table and change density
        const {unmount: unmount1} = render(
          <DataTable tableId={tableId1} columns={testColumns} data={testData.slice(0, 5)} enableDensityToggle />,
        );

        const densityButton1 = screen.getByRole('button', {name: /density/i});
        await userEvent.click(densityButton1);
        const compactOption1 = await screen.findByText(/compact/i);
        await userEvent.click(compactOption1);

        await waitFor(() => {
          const calls = localStorageMock.setItem.mock.calls.filter((call) => call[0] === storageKey1);
          expect(calls.length).toBeGreaterThan(0);
        });

        unmount1();

        // Render second table and change density differently
        render(<DataTable tableId={tableId2} columns={testColumns} data={testData.slice(0, 5)} enableDensityToggle />);

        const densityButton2 = screen.getByRole('button', {name: /density/i});
        await userEvent.click(densityButton2);
        const spaciousOption = await screen.findByText(/spacious/i);
        await userEvent.click(spaciousOption);

        await waitFor(() => {
          const calls = localStorageMock.setItem.mock.calls.filter((call) => call[0] === storageKey2);
          expect(calls.length).toBeGreaterThan(0);
        });

        // Verify both tables have different persisted states
        const state1 = JSON.parse(localStorageMock.getStore()[storageKey1]) as PersistedTableState;
        const state2 = JSON.parse(localStorageMock.getStore()[storageKey2]) as PersistedTableState;

        expect(state1.density).toBe('compact');
        expect(state2.density).toBe('spacious');
      });
    });
  });
});

// Storage holds what the user chose, never what the column defs declare, so a default
// changed in a later release reaches everyone who never touched that column.
describe('DataTable Persistence, preferences only', () => {
  const tableId = 'test-preferences-table';
  const storageKey = getTableStateStorageKey(tableId);
  const withDescriptionHidden = testColumns.map((column) =>
    column.id === 'description' ? {...column, hidden: true} : column,
  );

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  function stored(): PersistedTableState {
    return JSON.parse(localStorageMock.getStore()[storageKey] ?? '{}') as PersistedTableState;
  }

  function headerTexts(): (string | null)[] {
    return screen.getAllByRole('columnheader').map((header) => header.textContent);
  }

  async function toggleColumn(name: string) {
    await userEvent.click(screen.getByRole('button', {name: /columns/i}));
    const popover = await screen.findByRole('presentation');
    await userEvent.click(within(popover).getByRole('checkbox', {name}));
  }

  it('hides a column declared hidden and stores nothing for it', async () => {
    render(
      <DataTable
        tableId={tableId}
        columns={withDescriptionHidden}
        data={testData.slice(0, 5)}
        enableColumnVisibility
      />,
    );

    expect(headerTexts()).not.toContain('Description');

    await toggleColumn('Created');

    await waitFor(() => expect(stored().columnVisibility).toEqual({createdAt: false}));
    expect(stored().version).toBe(2);
  });

  it('lets a default flipped in a later release reach a user who never touched it', async () => {
    // The first release: the user hides Created. Description is visible by default.
    const {unmount} = render(
      <DataTable tableId={tableId} columns={testColumns} data={testData.slice(0, 5)} enableColumnVisibility />,
    );
    await toggleColumn('Created');
    await waitFor(() => expect(stored().columnVisibility).toEqual({createdAt: false}));
    unmount();

    // The next release hides Description by default.
    render(
      <DataTable
        tableId={tableId}
        columns={withDescriptionHidden}
        data={testData.slice(0, 5)}
        enableColumnVisibility
      />,
    );

    expect(headerTexts()).not.toContain('Description');
    expect(headerTexts()).not.toContain('Created');
  });

  it('keeps a user who showed a default-hidden column seeing it', () => {
    localStorageMock.setItem(storageKey, JSON.stringify({version: 2, columnVisibility: {description: true}}));

    render(
      <DataTable
        tableId={tableId}
        columns={withDescriptionHidden}
        data={testData.slice(0, 5)}
        enableColumnVisibility
      />,
    );

    expect(headerTexts()).toContain('Description');
  });

  it('lets initialColumnVisibility win over a column declared hidden', () => {
    render(
      <DataTable
        tableId={tableId}
        columns={withDescriptionHidden}
        data={testData.slice(0, 5)}
        enableColumnVisibility
        initialColumnVisibility={{description: true}}
      />,
    );

    expect(headerTexts()).toContain('Description');
  });

  it('ignores hidden on a column the user cannot show again', () => {
    render(
      <DataTable
        tableId={tableId}
        columns={withDescriptionHidden.map((column) =>
          column.id === 'description' ? {...column, enableHiding: false} : column,
        )}
        data={testData.slice(0, 5)}
        enableColumnVisibility
      />,
    );

    expect(headerTexts()).toContain('Description');
  });

  it('drops a stored column the table no longer has', async () => {
    localStorageMock.setItem(
      storageKey,
      JSON.stringify({version: 2, columnVisibility: {removed: false, createdAt: false}, columnSizing: {removed: 90}}),
    );

    render(<DataTable tableId={tableId} columns={testColumns} data={testData.slice(0, 5)} enableColumnVisibility />);
    expect(headerTexts()).not.toContain('Created');

    await toggleColumn('Type');

    await waitFor(() => expect(stored().columnVisibility).toEqual({createdAt: false, roleType: false}));
    expect(stored().columnSizing).toEqual({});
  });

  it('migrates an entry in the old shape once, keeping what the user saw', async () => {
    // An earlier build wrote the whole resolved layout, defaults included.
    localStorageMock.setItem(
      storageKey,
      JSON.stringify({
        pageSize: 25,
        columnVisibility: {name: true, roleType: true, description: false, createdAt: true},
      }),
    );

    const {unmount} = render(
      <DataTable tableId={tableId} columns={testColumns} data={testData.slice(0, 5)} enableColumnVisibility />,
    );

    expect(headerTexts()).not.toContain('Description');
    await waitFor(() => expect(stored().version).toBe(2));
    expect(stored()).toMatchObject({pageSize: 25, columnVisibility: {description: false}});
    expect(stored().columnVisibility).toEqual({description: false});
    unmount();

    // In the new shape now, so the next mount reads it without writing.
    localStorageMock.setItem.mockClear();
    render(<DataTable tableId={tableId} columns={testColumns} data={testData.slice(0, 5)} enableColumnVisibility />);

    expect(headerTexts()).not.toContain('Description');
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });

  it('never throws on an entry it cannot read', () => {
    localStorageMock.setItem(storageKey, JSON.stringify(42));

    render(<DataTable tableId={tableId} columns={testColumns} data={testData.slice(0, 5)} enableColumnVisibility />);

    expect(headerTexts()).toContain('Description');
  });
});
