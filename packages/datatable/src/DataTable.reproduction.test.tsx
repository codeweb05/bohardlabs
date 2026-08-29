import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeAll, describe, expect, it, vi} from 'vitest';

import {DataTable} from './DataTable';
import type {TestRole} from './test/test-utils';
import {generateTestRoles, render} from './test/test-utils';
import type {DataTableColumnDef} from './types';

// Test data
const testData = generateTestRoles(5);

// Test columns
const testColumns: DataTableColumnDef<TestRole>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
  },
  {
    id: 'roleType',
    accessorKey: 'roleType',
    header: 'Type',
  },
];

// Mock matchMedia to ensure desktop view
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('DataTable Column Visibility Reproduction', () => {
  it('hides column from UI when unchecking in visibility menu', async () => {
    render(
      <DataTable
        columns={testColumns}
        data={testData}
        enableColumnVisibility
        tableId="test-table-visibility" // Enable persistence if that matters, but checking basic functionality first
      />,
    );

    // Initial check: 'Name' column should be visible
    expect(screen.getByRole('columnheader', {name: /Name/})).toBeVisible();

    // Open column visibility menu
    const columnsButton = screen.getByRole('button', {name: /columns/i});
    await userEvent.click(columnsButton);

    // Find the popover
    const popover = await screen.findByRole('presentation');

    // Find checkbox for 'Name' column inside the popover
    // We can look for the label text "Name" within the popover
    // Get the checkbox associated with the Name column
    const nameCheckbox = within(popover).getByRole('checkbox', {name: 'Name'});

    // Uncheck it
    await userEvent.click(nameCheckbox);

    // Debug: print current state
    // screen.debug();

    // Verify column is hidden
    await waitFor(() => {
      // Look for main content first
      expect(screen.getByTestId('data-table-content')).toBeInTheDocument();

      // Look for column headers in the table only
      // const table = screen.getByRole('table');
      // const headers = within(table).queryAllByRole('columnheader', {name: /Name/});
      const headers = screen.queryAllByRole('columnheader', {name: /Name/});

      // Expect 0 matching headers (column hidden)
      expect(headers.length).toBe(0);
    });
  });
});
