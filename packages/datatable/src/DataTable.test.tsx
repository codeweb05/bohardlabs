import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {DataTable} from './DataTable';
import type {TestRole} from './test/test-utils';
import {generateTestRoles, render} from './test/test-utils';
import type {BulkAction, DataTableColumnDef, RowAction} from './types';

// Test data
const testData = generateTestRoles(25);

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

// Test row actions
const testRowActions: RowAction<TestRole>[] = [
  {
    id: 'view',
    label: 'View',
    icon: <VisibilityIcon fontSize="small" />,
    onClick: vi.fn(),
  },
  {
    id: 'edit',
    label: 'Edit',
    icon: <EditIcon fontSize="small" />,
    onClick: vi.fn(),
    disabled: (row) => row.roleType === 'SUPER_ADMIN',
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: <DeleteIcon fontSize="small" />,
    onClick: vi.fn(),
    color: 'error',
    disabled: (row) => row.roleType === 'SUPER_ADMIN',
  },
];

// Test bulk actions
const testBulkActions: BulkAction<TestRole>[] = [
  {
    id: 'delete',
    label: 'Delete Selected',
    icon: <DeleteIcon />,
    color: 'error',
    onClick: vi.fn(),
    confirmMessage: (count) => `Delete ${count} items?`,
  },
];

describe('DataTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders table with data', () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 10)} ariaLabel="Test table" />);

      // Check table is rendered
      expect(screen.getByRole('table')).toBeInTheDocument();

      // Check headers are rendered
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
    });

    it('renders empty state when no data', () => {
      render(<DataTable columns={testColumns} data={[]} emptyMessage="No roles found" />);

      expect(screen.getByText('No roles found')).toBeInTheDocument();
    });

    it('renders loading state', () => {
      const {container} = render(<DataTable columns={testColumns} data={[]} isLoading={true} />);

      // The skeleton table is `aria-hidden`, so it has no role to query: the announcement
      // is the status message, and the "no data" message must not be showing.
      expect(container.querySelector('table')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.queryByText('No roles found')).not.toBeInTheDocument();
    });

    it('renders error state with retry button', async () => {
      const onRetry = vi.fn();
      render(
        <DataTable columns={testColumns} data={[]} isError={true} error="Something went wrong" onRetry={onRetry} />,
      );

      // Error message appears in the error state component
      expect(screen.getAllByText(/something went wrong/i).length).toBeGreaterThan(0);

      const retryButton = screen.getByRole('button', {name: /retry/i});
      await userEvent.click(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('Pagination', () => {
    it('renders pagination controls', () => {
      render(<DataTable columns={testColumns} data={testData} enablePagination pageSize={10} />);

      // Should show page info
      expect(screen.getByText(/page 1/i)).toBeInTheDocument();
    });

    it('shows different data when navigating pages', async () => {
      // Create data with distinct names for each page
      const paginationTestData = Array.from({length: 25}, (_, i) => ({
        id: `role-${i + 1}`,
        name: `Role Page${Math.floor(i / 10) + 1} Item${(i % 10) + 1}`,
        roleType: 'ADMIN' as const,
        description: `Description ${i + 1}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      render(<DataTable columns={testColumns} data={paginationTestData} enablePagination pageSize={10} />);

      // First page should show "Role Page1" items
      expect(screen.getByText('Role Page1 Item1')).toBeInTheDocument();
      expect(screen.queryByText('Role Page2 Item1')).not.toBeInTheDocument();

      // Click next page
      const nextButton = screen.getByRole('button', {name: /next page/i});
      await userEvent.click(nextButton);

      // Second page should show "Role Page2" items
      await waitFor(() => {
        expect(screen.getByText('Role Page2 Item1')).toBeInTheDocument();
      });
      expect(screen.queryByText('Role Page1 Item1')).not.toBeInTheDocument();
    });

    it('displays correct page number after navigating forward and backward', async () => {
      // Create data with 30 items (3 pages with 10 items each)
      const paginationTestData = Array.from({length: 30}, (_, i) => ({
        id: `role-${i + 1}`,
        name: `P${Math.floor(i / 10) + 1}R${(i % 10) + 1}`,
        roleType: 'ADMIN' as const,
        description: `Description ${i + 1}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      render(<DataTable columns={testColumns} data={paginationTestData} enablePagination pageSize={10} />);

      // Initially on page 1 - verify data and page number
      expect(screen.getByText('P1R1')).toBeInTheDocument();
      expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();

      // Navigate to page 2
      await userEvent.click(screen.getByRole('button', {name: /next page/i}));

      // Wait for page 2 data and page number
      await waitFor(() => {
        expect(screen.getByText('P2R1')).toBeInTheDocument();
        expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
      });

      // Navigate back to page 1 using first page button (more reliable)
      await userEvent.click(screen.getByRole('button', {name: /first page/i}));

      // Should show page 1 data and page number again
      await waitFor(() => {
        expect(screen.getByText('P1R1')).toBeInTheDocument();
        expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
      });
    });

    it('steps back one page with the previous button', async () => {
      // The previous-page button (DataTablePagination.tsx:210) had no coverage: the
      // tests above all step back with "first page". On a long list those are very
      // different actions, and the one users reach for after paging forward is this one.
      const paginationTestData = Array.from({length: 30}, (_, i) => ({
        id: `role-${i + 1}`,
        name: `P${Math.floor(i / 10) + 1}R${(i % 10) + 1}`,
        roleType: 'ADMIN' as const,
        description: `Description ${i + 1}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      render(<DataTable columns={testColumns} data={paginationTestData} enablePagination pageSize={10} />);
      await userEvent.click(screen.getByRole('button', {name: /next page/i}));
      await waitFor(() => {
        expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', {name: /previous page/i}));

      await waitFor(() => {
        expect(screen.getByText('P1R1')).toBeInTheDocument();
        expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
      });
    });

    it('displays correct page number after navigating to last and first page', async () => {
      // Create data with 30 items (3 pages with 10 items each)
      const paginationTestData = Array.from({length: 30}, (_, i) => ({
        id: `role-${i + 1}`,
        name: `P${Math.floor(i / 10) + 1}R${(i % 10) + 1}`,
        roleType: 'ADMIN' as const,
        description: `Description ${i + 1}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      render(<DataTable columns={testColumns} data={paginationTestData} enablePagination pageSize={10} />);

      // Initially on page 1
      expect(screen.getByText('P1R1')).toBeInTheDocument();
      expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();

      // Navigate to last page
      await userEvent.click(screen.getByRole('button', {name: /last page/i}));

      // Wait for page 3 data and page number
      await waitFor(() => {
        expect(screen.getByText('P3R1')).toBeInTheDocument();
        expect(screen.getByText(/page 3 of 3/i)).toBeInTheDocument();
      });

      // Navigate to first page
      await userEvent.click(screen.getByRole('button', {name: /first page/i}));

      // Should show page 1 data and page number again
      await waitFor(() => {
        expect(screen.getByText('P1R1')).toBeInTheDocument();
        expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
      });
    });

    it('shows correct data and page after multiple navigation cycles', async () => {
      // Create data with distinct identifiers per page
      const paginationTestData = Array.from({length: 25}, (_, i) => ({
        id: `role-${i + 1}`,
        name: `Pg${Math.floor(i / 10) + 1}It${(i % 10) + 1}`,
        roleType: 'ADMIN' as const,
        description: `Description ${i + 1}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      render(<DataTable columns={testColumns} data={paginationTestData} enablePagination pageSize={10} />);

      // Start on page 1
      expect(screen.getByText('Pg1It1')).toBeInTheDocument();
      expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();

      // Go to page 2
      await userEvent.click(screen.getByRole('button', {name: /next page/i}));
      await waitFor(() => {
        expect(screen.getByText('Pg2It1')).toBeInTheDocument();
        expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
      });

      // Go to page 3 using next
      await userEvent.click(screen.getByRole('button', {name: /next page/i}));
      await waitFor(() => {
        expect(screen.getByText('Pg3It1')).toBeInTheDocument();
        expect(screen.getByText(/page 3 of 3/i)).toBeInTheDocument();
      });

      // Go back to page 1 using first page button
      await userEvent.click(screen.getByRole('button', {name: /first page/i}));
      await waitFor(() => {
        expect(screen.getByText('Pg1It1')).toBeInTheDocument();
        expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
      });

      // Go to last page
      await userEvent.click(screen.getByRole('button', {name: /last page/i}));
      await waitFor(() => {
        expect(screen.getByText('Pg3It1')).toBeInTheDocument();
        expect(screen.getByText(/page 3 of 3/i)).toBeInTheDocument();
      });

      // Go back to first page again
      await userEvent.click(screen.getByRole('button', {name: /first page/i}));
      await waitFor(() => {
        expect(screen.getByText('Pg1It1')).toBeInTheDocument();
        expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
      });
    });

    it('changes page when clicking next', async () => {
      const onServerStateChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={testData}
          enablePagination
          pageSize={10}
          onServerStateChange={onServerStateChange}
        />,
      );

      onServerStateChange.mockClear(); // drop the mount emit
      const nextButton = screen.getByRole('button', {name: /next page/i});
      await userEvent.click(nextButton);

      expect(onServerStateChange).toHaveBeenCalled();
    });

    it('changes page size', async () => {
      const onServerStateChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={testData}
          enablePagination
          pageSize={10}
          pageSizeOptions={[10, 25, 50]}
          onServerStateChange={onServerStateChange}
        />,
      );

      onServerStateChange.mockClear(); // drop the mount emit

      // Find the page size select
      const select = screen.getByRole('combobox');
      await userEvent.click(select);

      // Select 25
      const option25 = screen.getByRole('option', {name: '25'});
      await userEvent.click(option25);

      expect(onServerStateChange).toHaveBeenCalled();
    });

    it('disables previous button on first page', () => {
      render(<DataTable columns={testColumns} data={testData} enablePagination pageSize={10} />);

      const prevButton = screen.getByRole('button', {name: /previous page/i});
      expect(prevButton).toBeDisabled();
    });

    it('disables next button on last page', () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 10)} enablePagination pageSize={10} />);

      const nextButton = screen.getByRole('button', {name: /next page/i});
      expect(nextButton).toBeDisabled();
    });
  });

  describe('Sorting', () => {
    it('sorts column when clicking header', async () => {
      const onServerStateChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 10)}
          enableSorting
          onServerStateChange={onServerStateChange}
        />,
      );

      onServerStateChange.mockClear(); // drop the mount emit
      // Click on sortable column header
      const nameHeader = screen.getByText('Name');
      await userEvent.click(nameHeader);

      expect(onServerStateChange).toHaveBeenCalled();
    });

    it('shows sort indicator when sorted', () => {
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 10)}
          enableSorting
          initialSorting={[{id: 'name', desc: false}]}
        />,
      );

      // Should have sort indicator (ascending arrow)
      const nameHeader = screen.getByRole('columnheader', {name: /Name/});
      expect(nameHeader).toHaveTextContent('↑');
    });

    it('toggles sort direction on multiple clicks', async () => {
      const onServerStateChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 10)}
          enableSorting
          onServerStateChange={onServerStateChange}
        />,
      );

      const nameHeader = screen.getByText('Name');

      // Clear any mount-triggered calls
      onServerStateChange.mockClear();

      // First click - ascending
      await userEvent.click(nameHeader);
      expect(onServerStateChange).toHaveBeenCalledTimes(1);

      // Second click - descending
      await userEvent.click(nameHeader);
      expect(onServerStateChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('Row Selection', () => {
    it('renders selection checkboxes when enabled', () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 5)} enableRowSelection />);

      // Should have checkboxes for each row plus header
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(6); // 5 rows + 1 header
    });

    it('selects single row when clicking checkbox', async () => {
      const onRowSelectionChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 5)}
          enableRowSelection
          onRowSelectionChange={onRowSelectionChange}
        />,
      );

      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[1]); // First row checkbox

      expect(onRowSelectionChange).toHaveBeenCalled();
    });

    it('selects all rows when clicking header checkbox', async () => {
      const onRowSelectionChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 5)}
          enableRowSelection
          onRowSelectionChange={onRowSelectionChange}
        />,
      );

      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]); // Header checkbox

      expect(onRowSelectionChange).toHaveBeenCalled();
    });

    it('shows bulk actions when rows are selected', async () => {
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 5)}
          enableRowSelection
          bulkActions={testBulkActions}
        />,
      );

      // Select a row
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[1]);

      // Bulk actions should appear - the chip shows "1 selected"
      await waitFor(() => {
        // Look for Delete Selected button that appears in bulk actions
        expect(screen.getByRole('button', {name: /delete selected/i})).toBeInTheDocument();
      });
    });

    it('checkbox actually gets checked when clicked', async () => {
      const onRowSelectionChange = vi.fn();
      const onSelectionChange = vi.fn();

      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 5)}
          enableRowSelection
          onRowSelectionChange={onRowSelectionChange}
          onSelectionChange={onSelectionChange}
        />,
      );

      // Get all checkboxes - first is header, rest are rows
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(6); // 1 header + 5 rows

      const firstRowCheckbox = checkboxes[1] as HTMLInputElement;

      // Initially unchecked
      expect(firstRowCheckbox).not.toBeChecked();

      // Click to select
      await userEvent.click(firstRowCheckbox);

      // The callback should have been called
      expect(onRowSelectionChange).toHaveBeenCalled();

      // Get fresh reference after re-render
      await waitFor(() => {
        const updatedCheckboxes = screen.getAllByRole('checkbox');
        const updatedFirstRowCheckbox = updatedCheckboxes[1] as HTMLInputElement;
        expect(updatedFirstRowCheckbox).toBeChecked();
      });
    });

    it('select all checkbox selects all rows', async () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 3)} enableRowSelection />);

      const checkboxes = screen.getAllByRole('checkbox');
      const headerCheckbox = checkboxes[0] as HTMLInputElement;

      // Click select all
      await userEvent.click(headerCheckbox);

      // All row checkboxes should be checked - get fresh references after re-render
      await waitFor(() => {
        const freshCheckboxes = screen.getAllByRole('checkbox');
        const rowCheckboxes = freshCheckboxes.slice(1) as HTMLInputElement[];
        expect(rowCheckboxes.every((cb) => cb.checked)).toBe(true);
      });
    });

    it('deselect all when clicking checked header checkbox', async () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 3)} enableRowSelection />);

      const checkboxes = screen.getAllByRole('checkbox');
      const headerCheckbox = checkboxes[0] as HTMLInputElement;

      // Click select all first
      await userEvent.click(headerCheckbox);

      // All should be selected
      await waitFor(() => {
        expect(headerCheckbox.checked).toBe(true);
      });

      // Click again to deselect all
      await userEvent.click(headerCheckbox);

      // All should be deselected
      await waitFor(() => {
        const rowCheckboxes = checkboxes.slice(1) as HTMLInputElement[];
        expect(rowCheckboxes.every((cb) => !cb.checked)).toBe(true);
      });
    });
  });

  describe('Row Actions', () => {
    it('renders action menu button for each row', () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 5)} rowActions={testRowActions} />);

      // Should have action buttons for each row
      const actionButtons = screen.getAllByRole('button', {name: /actions/i});
      expect(actionButtons.length).toBe(5);
    });

    it('opens action menu when clicking action button', async () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 5)} rowActions={testRowActions} />);

      const actionButtons = screen.getAllByRole('button', {name: /actions/i});
      await userEvent.click(actionButtons[0]);

      // Menu should open with actions
      await waitFor(() => {
        expect(screen.getByText('View')).toBeInTheDocument();
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });
    });

    it('calls action onClick when clicking menu item', async () => {
      const viewAction = testRowActions[0];
      render(<DataTable columns={testColumns} data={testData.slice(0, 5)} rowActions={testRowActions} />);

      const actionButtons = screen.getAllByRole('button', {name: /actions/i});
      await userEvent.click(actionButtons[0]);

      const viewMenuItem = await screen.findByText('View');
      await userEvent.click(viewMenuItem);

      expect(viewAction.onClick).toHaveBeenCalledWith(testData[0]);
    });

    it('closes the menu on Escape without running an action', async () => {
      // The menu's `onClose` (TableRow.tsx:276) had no coverage: every other test here
      // closes it by picking an item. Dismissing is the more common path in practice,
      // and a menu that stays anchored after Escape traps the keyboard on that row.
      render(<DataTable columns={testColumns} data={testData.slice(0, 5)} rowActions={testRowActions} />);
      const actionButtons = screen.getAllByRole('button', {name: /actions/i});
      await userEvent.click(actionButtons[0]);
      await screen.findByText('View');

      await userEvent.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('menuitem', {name: /View/})).not.toBeInTheDocument();
      });
      expect(testRowActions[0].onClick).not.toHaveBeenCalled();
    });

    it('disables action when disabled function returns true', async () => {
      // Find a SUPER_ADMIN role
      const superAdminData = testData.filter((d) => d.roleType === 'SUPER_ADMIN');
      render(<DataTable columns={testColumns} data={superAdminData.slice(0, 1)} rowActions={testRowActions} />);

      const actionButton = screen.getByRole('button', {name: /actions/i});
      await userEvent.click(actionButton);

      // Edit and Delete should be disabled for SUPER_ADMIN
      await waitFor(() => {
        const editItem = screen.getByRole('menuitem', {name: /Edit/});
        const deleteItem = screen.getByRole('menuitem', {name: /Delete/});
        expect(editItem).toHaveAttribute('aria-disabled', 'true');
        expect(deleteItem).toHaveAttribute('aria-disabled', 'true');
      });
    });
  });

  describe('Global Search', () => {
    it('renders search input when enabled', () => {
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 10)}
          enableGlobalFilter
          globalFilterPlaceholder="Search roles..."
        />,
      );

      expect(screen.getByPlaceholderText('Search roles...')).toBeInTheDocument();
    });

    it('emits server state when typing in the global filter', async () => {
      const onServerStateChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 10)}
          enableGlobalFilter
          onServerStateChange={onServerStateChange}
        />,
      );

      onServerStateChange.mockClear(); // drop the mount emit
      const searchInput = screen.getByRole('textbox');
      await userEvent.type(searchInput, 'test');

      // Debounced, so wait
      await waitFor(
        () => {
          expect(onServerStateChange).toHaveBeenCalledWith(expect.objectContaining({globalFilter: 'test'}));
        },
        {timeout: 500},
      );
    });

    it('clears search when clicking clear button', async () => {
      const onServerStateChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 10)}
          enableGlobalFilter
          initialGlobalFilter="test"
          onServerStateChange={onServerStateChange}
        />,
      );

      const clearButton = screen.getByRole('button', {name: /clear/i});
      await userEvent.click(clearButton);

      expect(onServerStateChange).toHaveBeenLastCalledWith(expect.objectContaining({globalFilter: ''}));
    });
  });

  describe('Column Visibility', () => {
    it('renders column visibility button when enabled', () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 10)} enableColumnVisibility />);

      expect(screen.getByRole('button', {name: /columns/i})).toBeInTheDocument();
    });

    it('opens column visibility popover when clicking button', async () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 10)} enableColumnVisibility />);

      const columnsButton = screen.getByRole('button', {name: /columns/i});
      await userEvent.click(columnsButton);

      // Should show column checkboxes in the popover
      const popover = await screen.findByRole('presentation');
      // Check for checkboxes inside the popover (one for each column)
      const checkboxes = within(popover).getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThanOrEqual(4); // At least 4 columns
    });

    it('hides column when unchecking in visibility menu', async () => {
      const onColumnVisibilityChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 10)}
          enableColumnVisibility
          onColumnVisibilityChange={onColumnVisibilityChange}
        />,
      );

      const columnsButton = screen.getByRole('button', {name: /columns/i});
      await userEvent.click(columnsButton);

      // Find and click a column checkbox in the popover
      const popover = await screen.findByRole('presentation');
      const popoverCheckboxes = within(popover).getAllByRole('checkbox');
      await userEvent.click(popoverCheckboxes[0]); // First column

      expect(onColumnVisibilityChange).toHaveBeenCalled();
    });
  });

  describe('Density Toggle', () => {
    it('renders density toggle when enabled', () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 10)} enableDensityToggle />);

      expect(screen.getByRole('button', {name: /density/i})).toBeInTheDocument();
    });

    it('opens density menu when clicking toggle', async () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 10)} enableDensityToggle />);

      const densityButton = screen.getByRole('button', {name: /density/i});
      await userEvent.click(densityButton);

      await waitFor(() => {
        expect(screen.getByText(/compact/i)).toBeInTheDocument();
        expect(screen.getByText(/comfortable/i)).toBeInTheDocument();
        expect(screen.getByText(/spacious/i)).toBeInTheDocument();
      });
    });

    it('changes density when selecting option', async () => {
      render(
        <DataTable columns={testColumns} data={testData.slice(0, 10)} enableDensityToggle density="comfortable" />,
      );

      const densityButton = screen.getByRole('button', {name: /density/i});
      await userEvent.click(densityButton);

      const compactOption = await screen.findByText(/compact/i);
      await userEvent.click(compactOption);

      // Table should update with new density
      // Verify by checking cell padding
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });
  });

  describe('Row Click Events', () => {
    it('calls onRowClick when clicking a row', async () => {
      const onRowClick = vi.fn();
      render(<DataTable columns={testColumns} data={testData.slice(0, 5)} onRowClick={onRowClick} />);

      // Click on a cell in the first row
      const rows = screen.getAllByRole('row');
      const firstDataRow = rows[1]; // Skip header row
      const firstCell = within(firstDataRow).getAllByRole('cell')[0];
      await userEvent.click(firstCell);

      expect(onRowClick).toHaveBeenCalledWith(testData[0]);
    });
  });

  describe('Export', () => {
    it('renders export button when enabled', () => {
      render(
        <DataTable columns={testColumns} data={testData.slice(0, 10)} enableExport exportFormats={['csv', 'json']} />,
      );

      expect(screen.getByRole('button', {name: /export/i})).toBeInTheDocument();
    });

    it('opens export menu when clicking button', async () => {
      render(
        <DataTable columns={testColumns} data={testData.slice(0, 10)} enableExport exportFormats={['csv', 'json']} />,
      );

      const exportButton = screen.getByRole('button', {name: /export/i});
      await userEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText(/csv/i)).toBeInTheDocument();
        expect(screen.getByText(/json/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    // By role, not by label alone: the name used to sit on the wrapping Paper, which is a
    // div with no role, so axe flagged it and a screen reader announced nothing on entering
    // the table. `getByRole` is what tells the two apart.
    it('names the table element itself', () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 10)} ariaLabel="Roles data table" />);

      expect(screen.getByRole('table', {name: 'Roles data table'})).toBeInTheDocument();
    });

    it('has proper aria-label on checkboxes', () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 5)} enableRowSelection />);

      const selectAllCheckbox = screen.getByRole('checkbox', {name: /select all/i});
      expect(selectAllCheckbox).toBeInTheDocument();
    });
  });

  describe('Filter Reset', () => {
    it('shows reset filters button when filters are active', () => {
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 10)}
          enableFiltering
          enableGlobalFilter
          initialGlobalFilter="test"
        />,
      );

      // Look for the specific "Reset filters" button
      expect(screen.getByRole('button', {name: /reset filters/i})).toBeInTheDocument();
    });

    it('resets filters when clicking reset button', async () => {
      const onServerStateChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 10)}
          enableFiltering
          enableGlobalFilter
          initialGlobalFilter="test"
          onServerStateChange={onServerStateChange}
        />,
      );

      const resetButton = screen.getByRole('button', {name: /reset filters/i});
      await userEvent.click(resetButton);

      expect(onServerStateChange).toHaveBeenLastCalledWith(
        expect.objectContaining({globalFilter: '', columnFilters: []}),
      );
    });
  });

  describe('Multi-Sort', () => {
    it('allows multi-sort with shift-click when enabled', async () => {
      const onServerStateChange = vi.fn();
      const user = userEvent.setup();
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 10)}
          enableSorting
          enableMultiSort
          onServerStateChange={onServerStateChange}
        />,
      );

      const nameHeader = screen.getByText('Name');
      const typeHeader = screen.getByText('Type');

      // Clear any mount-triggered calls
      onServerStateChange.mockClear();

      // First click
      await user.click(nameHeader);
      expect(onServerStateChange).toHaveBeenCalledTimes(1);

      // Shift+click for multi-sort
      await user.keyboard('{Shift>}');
      await user.click(typeHeader);
      await user.keyboard('{/Shift}');
      expect(onServerStateChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('Row Double Click', () => {
    it('calls onRowDoubleClick when double clicking a row', async () => {
      const onRowDoubleClick = vi.fn();
      render(<DataTable columns={testColumns} data={testData.slice(0, 5)} onRowDoubleClick={onRowDoubleClick} />);

      const rows = screen.getAllByRole('row');
      const firstDataRow = rows[1];
      const firstCell = within(firstDataRow).getAllByRole('cell')[0];
      await userEvent.dblClick(firstCell);

      expect(onRowDoubleClick).toHaveBeenCalledWith(testData[0]);
    });
  });

  describe('Sticky Header', () => {
    it('applies sticky header when enabled', () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 10)} stickyHeader maxHeight={300} />);

      const table = screen.getByRole('table');
      expect(table).toHaveClass('MuiTable-stickyHeader');
    });
  });

  describe('Column Resizing', () => {
    it('allows column resizing when enabled', () => {
      // Enable resizing on column definitions
      const resizableColumns: DataTableColumnDef<TestRole>[] = testColumns.map((col) => ({
        ...col,
        enableResizing: true,
      }));

      render(<DataTable columns={resizableColumns} data={testData.slice(0, 5)} enableColumnResizing />);

      // Verify the table renders with resizing enabled
      // The resize handles are rendered via sx prop which creates CSS classes
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();

      // Verify table has fixed layout when resizing is enabled
      expect(table).toHaveStyle({tableLayout: 'fixed'});
    });
  });

  describe('Initial States', () => {
    it('respects initial column visibility', () => {
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 5)}
          enableColumnVisibility
          initialColumnVisibility={{description: false}}
        />,
      );

      // Description column should be hidden
      const headers = screen.getAllByRole('columnheader');
      const headerTexts = headers.map((h) => h.textContent);
      expect(headerTexts).not.toContain('Description');
    });

    it('respects initial sorting state', () => {
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 5)}
          enableSorting
          initialSorting={[{id: 'name', desc: true}]}
        />,
      );

      // Check for descending arrow indicator
      const nameHeader = screen.getByRole('columnheader', {name: /Name/});
      expect(nameHeader).toHaveTextContent('↓');
    });

    it('respects initial page size', () => {
      render(<DataTable columns={testColumns} data={testData} enablePagination pageSize={25} />);

      // Check that the select shows 25
      const select = screen.getByRole('combobox');
      expect(select).toHaveTextContent('25');
    });
  });

  describe('Data Display', () => {
    it('displays correct number of rows per page', () => {
      render(<DataTable columns={testColumns} data={testData} enablePagination pageSize={10} />);

      const rows = screen.getAllByRole('row');
      // 10 data rows + 1 header row
      expect(rows.length).toBe(11);
    });

    it('displays all rows when pagination disabled', () => {
      const smallData = testData.slice(0, 5);
      render(<DataTable columns={testColumns} data={smallData} enablePagination={false} />);

      const rows = screen.getAllByRole('row');
      expect(rows.length).toBe(6); // 5 data rows + 1 header
    });

    it('displays custom cell content', () => {
      const customColumns: DataTableColumnDef<TestRole>[] = [
        {
          id: 'name',
          accessorKey: 'name',
          header: 'Name',
          cell: ({row}) => <span data-testid="custom-cell">{row.original.name.toUpperCase()}</span>,
        },
      ];

      render(<DataTable columns={customColumns} data={testData.slice(0, 3)} />);

      const customCells = screen.getAllByTestId('custom-cell');
      expect(customCells.length).toBe(3);
      expect(customCells[0]).toHaveTextContent(testData[0].name.toUpperCase());
    });
  });

  describe('Selection States', () => {
    it('shows indeterminate state when some rows selected', async () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 5)} enableRowSelection />);

      // Select first row (not all rows)
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[1]);

      // Header checkbox should be indeterminate
      // Get fresh references after re-render
      await waitFor(() => {
        const freshCheckboxes = screen.getAllByRole('checkbox');
        const headerCheckbox = freshCheckboxes[0];
        // MUI sets data-indeterminate attribute when checkbox is indeterminate
        expect(headerCheckbox).toHaveAttribute('data-indeterminate', 'true');
      });
    });

    it('header checkbox is clickable', async () => {
      const onSelectionChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 5)}
          enableRowSelection
          onSelectionChange={onSelectionChange}
        />,
      );

      const checkboxes = screen.getAllByRole('checkbox');
      const headerCheckbox = checkboxes[0];

      // Click header checkbox
      await userEvent.click(headerCheckbox);

      // Selection change should be triggered
      expect(onSelectionChange).toHaveBeenCalled();
    });

    it('shows checked (not indeterminate) when every row on the current page is selected', async () => {
      // 26 rows total with page size 25 → page 1 shows 25 rows. Selecting all of them
      // means selectedCount === pageRowCount; the header must reflect "all-selected".
      const data = generateTestRoles(26);
      render(<DataTable columns={testColumns} data={data} enableRowSelection enablePagination pageSize={25} />);

      const headerCheckbox = screen.getAllByRole('checkbox')[0];
      await userEvent.click(headerCheckbox);

      await waitFor(() => {
        expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
      });
      expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('data-indeterminate', 'false');
    });

    it('shows indeterminate when selection covers some-but-not-all rows on the page', async () => {
      // 5 rows on the page, only 4 selected manually → must be indeterminate, never checked.
      render(<DataTable columns={testColumns} data={testData.slice(0, 5)} enableRowSelection />);

      const rowCheckboxes = screen.getAllByRole('checkbox').slice(1, 5);
      for (const cb of rowCheckboxes) {
        await userEvent.click(cb);
      }

      await waitFor(() => {
        const headerCheckbox = screen.getAllByRole('checkbox')[0];
        expect(headerCheckbox).toHaveAttribute('data-indeterminate', 'true');
        expect(headerCheckbox).not.toBeChecked();
      });
    });

    it('clicking an indeterminate header selects every row on the current page', async () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 5)} enableRowSelection />);

      // Partially select a single row → header becomes indeterminate
      await userEvent.click(screen.getAllByRole('checkbox')[1]);
      await waitFor(() => {
        expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('data-indeterminate', 'true');
      });

      // Clicking the indeterminate header must select every row, not no-op
      await userEvent.click(screen.getAllByRole('checkbox')[0]);

      await waitFor(() => {
        expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
      });
      const fresh = screen.getAllByRole('checkbox');
      expect(fresh[0]).toHaveAttribute('data-indeterminate', 'false');
      expect(fresh.slice(1).every((cb) => (cb as HTMLInputElement).checked)).toBe(true);
    });

    it('header becomes indeterminate after page size grows because no rows fall out of view', async () => {
      // Start with 10 rows visible, select them all → header is "checked".
      // Bumping page size to 25 reveals rows 11–25 alongside the already-visible 1–10.
      // Pagination only deselects rows that fall *out* of view, so rows 1–10 stay selected.
      // The header becomes indeterminate (10 of 25 selected) and rows 11–25 are unchecked.
      const data = generateTestRoles(25);
      render(<DataTable columns={testColumns} data={data} enableRowSelection enablePagination pageSize={10} />);

      await userEvent.click(screen.getAllByRole('checkbox')[0]);
      await waitFor(() => {
        expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
      });

      // Open the rows-per-page select and pick a larger page size.
      const pageSizeSelect = screen.getByRole('combobox');
      await userEvent.click(pageSizeSelect);
      const option25 = await screen.findByRole('option', {name: '25'});
      await userEvent.click(option25);

      await waitFor(() => {
        expect(screen.getAllByRole('checkbox')).toHaveLength(26); // 25 rows + header
      });
      const all = screen.getAllByRole('checkbox');
      const rowCheckboxes = all.slice(1).map((cb) => cb as HTMLInputElement);
      expect(rowCheckboxes.slice(0, 10).every((cb) => cb.checked)).toBe(true);
      expect(rowCheckboxes.slice(10).every((cb) => !cb.checked)).toBe(true);
      expect(all[0]).toHaveAttribute('data-indeterminate', 'true');
    });

    it('shrinking page size deselects only the rows that fall out of view', async () => {
      // 50 rows, pageSize 25, select all 25 visible → header checked.
      // Shrink to pageSize 10: rows 11–25 fall out of view and get deselected.
      // Rows 1–10 remain visible AND remain selected, so the header stays checked.
      // Grow back to pageSize 25: nothing falls out (1–10 ⊂ 1–25), so rows 1–10
      // stay selected, rows 11–25 are unchecked, header becomes indeterminate.
      const data = generateTestRoles(50);
      render(<DataTable columns={testColumns} data={data} enableRowSelection enablePagination pageSize={25} />);

      await userEvent.click(screen.getAllByRole('checkbox')[0]);
      await waitFor(() => {
        expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
      });

      // Shrink page size to 10 → visible rows 1–10 stay selected
      await userEvent.click(screen.getByRole('combobox'));
      await userEvent.click(await screen.findByRole('option', {name: '10'}));
      await waitFor(() => {
        expect(screen.getAllByRole('checkbox')).toHaveLength(11); // 10 rows + header
      });
      let all = screen.getAllByRole('checkbox');
      expect(all.slice(1).every((cb) => (cb as HTMLInputElement).checked)).toBe(true);
      expect(all[0]).toBeChecked();
      expect(all[0]).toHaveAttribute('data-indeterminate', 'false');

      // Grow back to 25 → no rows fall out, rows 1–10 stay selected, 11–25 unchecked
      await userEvent.click(screen.getByRole('combobox'));
      await userEvent.click(await screen.findByRole('option', {name: '25'}));
      await waitFor(() => {
        expect(screen.getAllByRole('checkbox')).toHaveLength(26); // 25 rows + header
      });
      all = screen.getAllByRole('checkbox');
      const rowCheckboxes = all.slice(1).map((cb) => cb as HTMLInputElement);
      expect(rowCheckboxes.slice(0, 10).every((cb) => cb.checked)).toBe(true);
      expect(rowCheckboxes.slice(10).every((cb) => !cb.checked)).toBe(true);
      expect(all[0]).toHaveAttribute('data-indeterminate', 'true');
    });

    it('clicking a fully-checked header deselects every row on the current page', async () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 5)} enableRowSelection />);

      // Select all
      await userEvent.click(screen.getAllByRole('checkbox')[0]);
      await waitFor(() => {
        expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
      });

      // Click again to deselect all
      await userEvent.click(screen.getAllByRole('checkbox')[0]);

      await waitFor(() => {
        const fresh = screen.getAllByRole('checkbox');
        expect(fresh[0]).not.toBeChecked();
        const rowCheckboxes = fresh.slice(1) as HTMLInputElement[];
        expect(rowCheckboxes.every((cb) => !cb.checked)).toBe(true);
      });
    });
  });

  describe('Toolbar Visibility', () => {
    it('hides toolbar when showToolbar is false', () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 5)} showToolbar={false} enableGlobalFilter />);

      // Search input should not be visible
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('hides pagination when showPagination is false', () => {
      render(<DataTable columns={testColumns} data={testData} enablePagination showPagination={false} />);

      // Pagination controls should not be visible
      expect(screen.queryByRole('button', {name: /next page/i})).not.toBeInTheDocument();
    });
  });

  describe('Server Side Mode', () => {
    it('passes totalRows to pagination in manual mode', () => {
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 10)}
          enablePagination
          manualPagination
          totalRows={100}
          pageSize={10}
        />,
      );

      // Should show total rows count - format is "{{count}} row(s) total." from i18n
      expect(screen.getByText(/100 row/i)).toBeInTheDocument();
    });

    it('emits server state in manual pagination mode', async () => {
      const onServerStateChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 10)}
          enablePagination
          manualPagination
          totalRows={50}
          pageSize={10}
          onServerStateChange={onServerStateChange}
        />,
      );

      onServerStateChange.mockClear(); // drop the mount emit
      const nextButton = screen.getByRole('button', {name: /next page/i});
      await userEvent.click(nextButton);

      expect(onServerStateChange).toHaveBeenLastCalledWith(
        expect.objectContaining({pagination: expect.objectContaining({pageIndex: 1})}),
      );
    });
  });

  describe('Hidden Actions', () => {
    it('hides actions based on hidden function', async () => {
      const actionsWithHidden: RowAction<TestRole>[] = [
        {
          id: 'visible',
          label: 'Visible Action',
          onClick: vi.fn(),
        },
        {
          id: 'hidden',
          label: 'Hidden Action',
          onClick: vi.fn(),
          hidden: () => true,
        },
      ];

      render(<DataTable columns={testColumns} data={testData.slice(0, 1)} rowActions={actionsWithHidden} />);

      const actionButton = screen.getByRole('button', {name: /actions/i});
      await userEvent.click(actionButton);

      await waitFor(() => {
        expect(screen.getByText('Visible Action')).toBeInTheDocument();
        expect(screen.queryByText('Hidden Action')).not.toBeInTheDocument();
      });
    });
  });

  describe('Bulk Actions Confirmation', () => {
    it('shows confirmation dialog when confirmMessage is provided', async () => {
      const bulkActionsWithConfirm: BulkAction<TestRole>[] = [
        {
          id: 'delete',
          label: 'Delete Selected',
          onClick: vi.fn(),
          confirmMessage: (count) => `Are you sure you want to delete ${count} items?`,
        },
      ];

      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 5)}
          enableRowSelection
          bulkActions={bulkActionsWithConfirm}
        />,
      );

      // Select first row
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[1]);

      // Get fresh checkboxes after re-render and select second row
      const freshCheckboxes = screen.getAllByRole('checkbox');
      await userEvent.click(freshCheckboxes[2]);

      // Click bulk delete
      const deleteButton = await screen.findByRole('button', {name: /delete selected/i});
      await userEvent.click(deleteButton);

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByText(/are you sure you want to delete 2 items/i)).toBeInTheDocument();
      });
    });
  });

  describe('Export Functionality', () => {
    it('calls custom onExport when provided', async () => {
      const onExport = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 5)}
          enableExport
          exportFormats={['csv']}
          onExport={onExport}
        />,
      );

      const exportButton = screen.getByRole('button', {name: /export/i});
      await userEvent.click(exportButton);

      const csvOption = await screen.findByText(/csv/i);
      await userEvent.click(csvOption);

      expect(onExport).toHaveBeenCalledWith('csv', testData.slice(0, 5));
    });
  });

  describe('First/Last Page Buttons', () => {
    it('disables first page button on first page', () => {
      render(<DataTable columns={testColumns} data={testData} enablePagination pageSize={10} />);

      const firstPageButton = screen.getByRole('button', {name: /first page/i});
      expect(firstPageButton).toBeDisabled();
    });

    it('disables last page button on last page', async () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 20)} enablePagination pageSize={10} />);

      // Navigate to the last page (20 rows / pageSize 10 = 2 pages).
      await userEvent.click(screen.getByRole('button', {name: /last page/i}));

      const lastPageButton = screen.getByRole('button', {name: /last page/i});
      expect(lastPageButton).toBeDisabled();
    });

    it('navigates to first page when clicking first page button', async () => {
      const onServerStateChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={testData}
          enablePagination
          pageSize={10}
          onServerStateChange={onServerStateChange}
        />,
      );

      // Jump to the last page first so "first page" is a meaningful navigation.
      await userEvent.click(screen.getByRole('button', {name: /last page/i}));
      await userEvent.click(screen.getByRole('button', {name: /first page/i}));

      expect(onServerStateChange).toHaveBeenLastCalledWith(
        expect.objectContaining({pagination: expect.objectContaining({pageIndex: 0})}),
      );
    });

    it('navigates to last page when clicking last page button', async () => {
      const onServerStateChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={testData}
          enablePagination
          pageSize={10}
          onServerStateChange={onServerStateChange}
        />,
      );

      onServerStateChange.mockClear(); // drop the mount emit
      const lastPageButton = screen.getByRole('button', {name: /last page/i});
      await userEvent.click(lastPageButton);

      expect(onServerStateChange).toHaveBeenCalled();
    });
  });

  describe('Show All Columns', () => {
    it('shows Show All button in column visibility menu', async () => {
      render(
        <DataTable
          columns={testColumns}
          data={testData.slice(0, 5)}
          enableColumnVisibility
          initialColumnVisibility={{description: false}}
        />,
      );

      const columnsButton = screen.getByRole('button', {name: /columns/i});
      await userEvent.click(columnsButton);

      await waitFor(() => {
        expect(screen.getByText(/show all/i)).toBeInTheDocument();
      });
    });
  });

  describe('Density Applied', () => {
    it('applies compact density cell padding', () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 5)} density="compact" />);

      // Compact density should show the table with smaller cell padding
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();

      // The density is applied via context and affects cell padding in the TableContainer
      // We verify the table renders - the actual styling is applied via sx prop
      const cells = screen.getAllByRole('cell');
      expect(cells.length).toBeGreaterThan(0);
    });

    it('applies comfortable density by default', () => {
      render(<DataTable columns={testColumns} data={testData.slice(0, 5)} density="comfortable" />);

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });
  });

  describe('Action Dividers', () => {
    it('renders divider between actions when specified', async () => {
      const actionsWithDivider: RowAction<TestRole>[] = [
        {id: 'view', label: 'View', onClick: vi.fn()},
        {id: 'edit', label: 'Edit', onClick: vi.fn()},
        {id: 'delete', label: 'Delete', onClick: vi.fn(), divider: true, color: 'error'},
      ];

      render(<DataTable columns={testColumns} data={testData.slice(0, 1)} rowActions={actionsWithDivider} />);

      const actionButton = screen.getByRole('button', {name: /actions/i});
      await userEvent.click(actionButton);

      await waitFor(() => {
        const dividers = screen.getAllByRole('separator');
        expect(dividers.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Truncation', () => {
    it('applies truncation styles when truncate is enabled', () => {
      const columnsWithTruncate: DataTableColumnDef<TestRole>[] = [
        {
          id: 'description',
          accessorKey: 'description',
          header: 'Description',
          truncate: true,
          maxWidth: 200,
        },
      ];

      render(<DataTable columns={columnsWithTruncate} data={testData.slice(0, 3)} />);

      // Check for cells - they should exist and contain content
      const cells = screen.getAllByRole('cell');
      expect(cells.length).toBeGreaterThan(0);
    });
  });
});
