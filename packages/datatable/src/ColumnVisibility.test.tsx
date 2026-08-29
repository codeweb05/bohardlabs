import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeAll, describe, expect, it, vi} from 'vitest';

import {DataTable} from './DataTable';
import type {TestRole} from './test/test-utils';
import {generateTestRoles, render} from './test/test-utils';
import type {DataTableColumnDef} from './types';

// Test data
const testData = generateTestRoles(5);

// Test columns with clear headers
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
  {
    id: 'description',
    accessorKey: 'description',
    header: 'Description',
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
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// Helper to open column visibility popover
async function openColumnVisibilityPopover() {
  const columnsButton = screen.getByRole('button', {name: /columns/i});
  await userEvent.click(columnsButton);
  return screen.findByRole('presentation');
}

// Helper to get checkbox for a column
function getColumnCheckbox(popover: HTMLElement, columnLabel: string) {
  return within(popover).getByRole('checkbox', {name: columnLabel});
}

// Reads the popover's column rows in list order.
function getReorderHandles(popover: HTMLElement) {
  return within(popover).getAllByRole('button', {name: /^Reorder /});
}

// Reads the popover's column rows, in list order. Each row is the drag source.
function getReorderRows(popover: HTMLElement) {
  return within(popover).getAllByRole('listitem');
}

// The open popover marks the app root aria-hidden, so reach past it with `hidden: true`
// rather than closing the popover between every assertion.
function getHeaderOrder() {
  // Strip the sort indicator glyph so a sorted header still compares by its label.
  return screen
    .getAllByRole('columnheader', {hidden: true})
    .map((th) => th.textContent?.replace(/[\u2191\u2193]/g, '').trim());
}

// First body row's cell text, in DOM order. Used to prove that cells follow the headers.
function getFirstRowOrder() {
  const firstBodyRow = screen.getAllByRole('row', {hidden: true})[1];
  return within(firstBodyRow)
    .getAllByRole('cell')
    .map((td) => td.textContent?.trim());
}

// jsdom does not attach a DataTransfer to synthetic drag events; the component
// writes to it the way a real browser expects, so supply a stub.
function dragRowOnto(source: HTMLElement, target: HTMLElement) {
  const dataTransfer = {effectAllowed: '', dropEffect: '', setData: vi.fn(), getData: vi.fn()};
  fireEvent.dragStart(source, {dataTransfer});
  fireEvent.dragOver(target, {dataTransfer});
  fireEvent.dragEnd(source, {dataTransfer});
}

describe('DataTable Column Visibility', () => {
  describe('Initial State', () => {
    it('shows all columns by default', () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility />);

      expect(screen.getByRole('columnheader', {name: /Name/})).toBeInTheDocument();
      expect(screen.getByRole('columnheader', {name: /Type/})).toBeInTheDocument();
      expect(screen.getByRole('columnheader', {name: /Description/})).toBeInTheDocument();
    });

    it('respects initialColumnVisibility prop', () => {
      render(
        <DataTable
          columns={testColumns}
          data={testData}
          enableColumnVisibility
          initialColumnVisibility={{name: false}}
        />,
      );

      expect(screen.queryByRole('columnheader', {name: /Name/})).not.toBeInTheDocument();
      expect(screen.getByRole('columnheader', {name: /Type/})).toBeInTheDocument();
    });

    it('shows correct count in column visibility header', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility />);

      const popover = await openColumnVisibilityPopover();
      expect(within(popover).getByText('Columns (3/3)')).toBeInTheDocument();
    });
  });

  describe('Toggle Column Visibility via Checkbox', () => {
    it('hides column when unchecking checkbox', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility />);

      // Verify Name column is visible initially
      expect(screen.getByRole('columnheader', {name: /Name/})).toBeInTheDocument();

      // Open popover and uncheck Name
      const popover = await openColumnVisibilityPopover();
      const nameCheckbox = getColumnCheckbox(popover, 'Name');

      expect(nameCheckbox).toBeChecked();
      await userEvent.click(nameCheckbox);

      // Verify Name column is now hidden
      await waitFor(() => {
        expect(screen.queryByRole('columnheader', {name: /Name/})).not.toBeInTheDocument();
      });
    });

    it('shows column when checking checkbox', async () => {
      render(
        <DataTable
          columns={testColumns}
          data={testData}
          enableColumnVisibility
          initialColumnVisibility={{name: false}}
        />,
      );

      // Verify Name column is hidden initially
      expect(screen.queryByRole('columnheader', {name: /Name/})).not.toBeInTheDocument();

      // Open popover and check Name
      const popover = await openColumnVisibilityPopover();
      const nameCheckbox = getColumnCheckbox(popover, 'Name');

      expect(nameCheckbox).not.toBeChecked();
      await userEvent.click(nameCheckbox);

      // Close popover first
      await userEvent.keyboard('{Escape}');

      // Verify Name column is now visible
      await waitFor(() => {
        expect(screen.getByRole('columnheader', {name: /Name/})).toBeInTheDocument();
      });
    });

    it('updates checkbox state immediately after click', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility />);

      const popover = await openColumnVisibilityPopover();
      const nameCheckbox = getColumnCheckbox(popover, 'Name');

      expect(nameCheckbox).toBeChecked();
      await userEvent.click(nameCheckbox);

      // Checkbox should be unchecked now
      await waitFor(() => {
        expect(nameCheckbox).not.toBeChecked();
      });
    });

    it('updates column count when toggling visibility', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility />);

      const popover = await openColumnVisibilityPopover();
      expect(within(popover).getByText('Columns (3/3)')).toBeInTheDocument();

      const nameCheckbox = getColumnCheckbox(popover, 'Name');
      await userEvent.click(nameCheckbox);

      await waitFor(() => {
        expect(within(popover).getByText('Columns (2/3)')).toBeInTheDocument();
      });
    });

    it('can toggle multiple columns', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility />);

      const popover = await openColumnVisibilityPopover();

      // Hide Name
      const nameCheckbox = getColumnCheckbox(popover, 'Name');
      await userEvent.click(nameCheckbox);

      // Hide Type
      const typeCheckbox = getColumnCheckbox(popover, 'Type');
      await userEvent.click(typeCheckbox);

      // Close popover
      await userEvent.keyboard('{Escape}');

      // Verify both columns are hidden
      await waitFor(() => {
        expect(screen.queryByRole('columnheader', {name: /Name/})).not.toBeInTheDocument();
        expect(screen.queryByRole('columnheader', {name: /Type/})).not.toBeInTheDocument();
        expect(screen.getByRole('columnheader', {name: /Description/})).toBeInTheDocument();
      });
    });

    it('disables last visible column checkbox', async () => {
      render(
        <DataTable
          columns={testColumns}
          data={testData}
          enableColumnVisibility
          initialColumnVisibility={{name: false, roleType: false}}
        />,
      );

      const popover = await openColumnVisibilityPopover();

      // Description is the only visible column - its checkbox should be disabled
      const descCheckbox = getColumnCheckbox(popover, 'Description');
      expect(descCheckbox).toBeDisabled();
    });
  });

  describe('Show All Button', () => {
    it('shows all columns when clicking Show All', async () => {
      render(
        <DataTable
          columns={testColumns}
          data={testData}
          enableColumnVisibility
          initialColumnVisibility={{name: false, roleType: false}}
        />,
      );

      // Verify columns are hidden initially
      expect(screen.queryByRole('columnheader', {name: /Name/})).not.toBeInTheDocument();
      expect(screen.queryByRole('columnheader', {name: /Type/})).not.toBeInTheDocument();

      const popover = await openColumnVisibilityPopover();
      const showAllButton = within(popover).getByRole('button', {name: /show all/i});
      await userEvent.click(showAllButton);

      // Close popover by pressing Escape key
      fireEvent.keyDown(screen.getByRole('presentation'), {key: 'Escape'});

      // Wait for popover to fully unmount so aria-hidden is removed
      await waitFor(() => {
        expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
      });

      // Verify all columns are visible
      expect(screen.getByRole('columnheader', {name: /Name/})).toBeInTheDocument();
      expect(screen.getByRole('columnheader', {name: /Type/})).toBeInTheDocument();
      expect(screen.getByRole('columnheader', {name: /Description/})).toBeInTheDocument();
    });

    it('disables Show All button when all columns are visible', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility />);

      const popover = await openColumnVisibilityPopover();
      const showAllButton = within(popover).getByRole('button', {name: /show all/i});

      expect(showAllButton).toBeDisabled();
    });
  });

  describe('Callback Integration', () => {
    it('calls onColumnVisibilityChange when toggling column', async () => {
      const onColumnVisibilityChange = vi.fn();

      render(
        <DataTable
          columns={testColumns}
          data={testData}
          enableColumnVisibility
          onColumnVisibilityChange={onColumnVisibilityChange}
        />,
      );

      const popover = await openColumnVisibilityPopover();
      const nameCheckbox = getColumnCheckbox(popover, 'Name');
      await userEvent.click(nameCheckbox);

      await waitFor(() => {
        expect(onColumnVisibilityChange).toHaveBeenCalled();
        const lastCall = onColumnVisibilityChange.mock.calls.at(-1)?.[0];
        expect(lastCall).toEqual(expect.objectContaining({name: false}));
      });
    });

    it('calls onColumnVisibilityChange with true when showing hidden column', async () => {
      const onColumnVisibilityChange = vi.fn();

      render(
        <DataTable
          columns={testColumns}
          data={testData}
          enableColumnVisibility
          initialColumnVisibility={{name: false}}
          onColumnVisibilityChange={onColumnVisibilityChange}
        />,
      );

      const popover = await openColumnVisibilityPopover();
      const nameCheckbox = getColumnCheckbox(popover, 'Name');

      // Initially unchecked since column is hidden
      expect(nameCheckbox).not.toBeChecked();

      await userEvent.click(nameCheckbox);

      await waitFor(() => {
        expect(onColumnVisibilityChange).toHaveBeenCalled();
        const lastCall = onColumnVisibilityChange.mock.calls.at(-1)?.[0];
        // Should be called with name: true to show the column
        expect(lastCall).toEqual(expect.objectContaining({name: true}));
      });
    });
  });

  describe('Data Display', () => {
    it('hides cell data when column is hidden', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility />);

      // Get first row's name cell value
      const firstRowName = testData[0].name;
      expect(screen.getByText(firstRowName)).toBeInTheDocument();

      // Hide the Name column
      const popover = await openColumnVisibilityPopover();
      const nameCheckbox = getColumnCheckbox(popover, 'Name');
      await userEvent.click(nameCheckbox);

      // Close popover
      await userEvent.keyboard('{Escape}');

      // Verify the name data is no longer visible
      await waitFor(() => {
        expect(screen.queryByText(firstRowName)).not.toBeInTheDocument();
      });
    });
  });

  describe('Reset to Default', () => {
    it('restores initial visibility on reset', async () => {
      render(
        <DataTable columns={testColumns} data={testData} enableColumnVisibility tableId="test-reset-visibility" />,
      );

      // Hide a column
      const popover = await openColumnVisibilityPopover();
      const nameCheckbox = getColumnCheckbox(popover, 'Name');
      await userEvent.click(nameCheckbox);

      await waitFor(() => {
        expect(screen.queryByRole('columnheader', {name: /Name/})).not.toBeInTheDocument();
      });

      // Close popover first
      await userEvent.keyboard('{Escape}');

      // Click reset button
      const resetButton = screen.getByRole('button', {name: /reset to default/i});
      await userEvent.click(resetButton);

      // Verify column is visible again
      await waitFor(() => {
        expect(screen.getByRole('columnheader', {name: /Name/})).toBeInTheDocument();
      });
    });
  });

  describe('Column Reordering', () => {
    it('does not render drag handles when ordering is disabled', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility enableColumnOrdering={false} />);

      const popover = await openColumnVisibilityPopover();
      expect(within(popover).queryByRole('button', {name: /^Reorder /})).not.toBeInTheDocument();
    });

    it('renders a drag handle per column, labelled with its position', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility />);

      const popover = await openColumnVisibilityPopover();
      const handles = getReorderHandles(popover);

      expect(handles).toHaveLength(3);
      expect(handles[0]).toHaveAccessibleName('Reorder Name, position 1 of 3');
      expect(handles[2]).toHaveAccessibleName('Reorder Description, position 3 of 3');
    });

    it('reorders table columns when a row is dragged onto another', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility />);

      expect(getHeaderOrder()).toEqual(['Name', 'Type', 'Description']);

      const popover = await openColumnVisibilityPopover();
      const rows = getReorderRows(popover);

      // Drag "Description" (index 2) onto "Name" (index 0)
      dragRowOnto(rows[2], rows[0]);

      await waitFor(() => {
        expect(getHeaderOrder()).toEqual(['Description', 'Name', 'Type']);
      });
    });

    it('reflects the new order in the popover list after a reorder', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility />);

      const popover = await openColumnVisibilityPopover();
      const rows = getReorderRows(popover);

      dragRowOnto(rows[2], rows[0]);

      await waitFor(() => {
        expect(getReorderHandles(popover)[0]).toHaveAccessibleName('Reorder Description, position 1 of 3');
      });
    });

    it('moves a column with ArrowDown on its drag handle', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility />);

      const popover = await openColumnVisibilityPopover();
      getReorderHandles(popover)[0].focus();
      await userEvent.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(getHeaderOrder()).toEqual(['Type', 'Name', 'Description']);
      });
    });

    it('ignores ArrowUp on the first column', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility />);

      const popover = await openColumnVisibilityPopover();
      getReorderHandles(popover)[0].focus();
      await userEvent.keyboard('{ArrowUp}');

      await waitFor(() => {
        expect(getHeaderOrder()).toEqual(['Name', 'Type', 'Description']);
      });
    });

    it('notifies the parent via onColumnOrderChange', async () => {
      const onColumnOrderChange = vi.fn();
      render(
        <DataTable
          columns={testColumns}
          data={testData}
          enableColumnVisibility
          onColumnOrderChange={onColumnOrderChange}
        />,
      );

      const popover = await openColumnVisibilityPopover();
      getReorderHandles(popover)[0].focus();
      await userEvent.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(onColumnOrderChange).toHaveBeenCalledWith(['roleType', 'name', 'description']);
      });
    });

    it('keeps visibility toggling working alongside reordering', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility />);

      const popover = await openColumnVisibilityPopover();
      await userEvent.click(getColumnCheckbox(popover, 'Name'));

      await waitFor(() => {
        expect(screen.queryByRole('columnheader', {name: /Name/})).not.toBeInTheDocument();
      });
    });
  });

  // Combinations verified against the running app: a reorder has to survive every other
  // table setting, and the body cells have to follow the headers rather than drift apart.
  describe('Column Reordering Combinations', () => {
    async function reorderDescriptionToFront() {
      const popover = await openColumnVisibilityPopover();
      const rows = getReorderRows(popover);
      dragRowOnto(rows[rows.length - 1], rows[0]);
      return popover;
    }

    it('moves the body cells along with the headers', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility />);

      const headersBefore = getHeaderOrder();
      const rowBefore = getFirstRowOrder();

      await reorderDescriptionToFront();
      await userEvent.keyboard('{Escape}');

      await waitFor(() => {
        expect(getHeaderOrder()).toEqual(['Description', 'Name', 'Type']);
        // The last cell moved to the front alongside its header.
        expect(getFirstRowOrder()).toEqual([rowBefore[2], rowBefore[0], rowBefore[1]]);
      });
      expect(headersBefore).toEqual(['Name', 'Type', 'Description']);
    });

    it('reorders the remaining columns while one is hidden', async () => {
      render(
        <DataTable
          columns={testColumns}
          data={testData}
          enableColumnVisibility
          initialColumnVisibility={{roleType: false}}
        />,
      );

      expect(getHeaderOrder()).toEqual(['Name', 'Description']);

      const popover = await openColumnVisibilityPopover();
      const rows = getReorderRows(popover);
      // The popover still lists the hidden column, so target by label position: 0=Name, 1=Type, 2=Description
      dragRowOnto(rows[2], rows[0]);

      await waitFor(() => {
        expect(getHeaderOrder()).toEqual(['Description', 'Name']);
      });
      // Hiding is independent of ordering — Type stays hidden.
      expect(getHeaderOrder()).not.toContain('Type');
    });

    it('keeps the new order when a hidden column is shown again', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility />);

      const popover = await reorderDescriptionToFront();
      await userEvent.click(getColumnCheckbox(popover, 'Name'));

      await waitFor(() => {
        expect(getHeaderOrder()).toEqual(['Description', 'Type']);
      });

      await userEvent.click(getColumnCheckbox(popover, 'Name'));

      await waitFor(() => {
        expect(getHeaderOrder()).toEqual(['Description', 'Name', 'Type']);
      });
    });

    it('keeps the new order across a page-size change', async () => {
      render(
        <DataTable
          columns={testColumns}
          data={generateTestRoles(30)}
          enableColumnVisibility
          enablePagination
          pageSize={10}
          pageSizeOptions={[10, 25]}
        />,
      );

      await reorderDescriptionToFront();
      await userEvent.keyboard('{Escape}');

      await waitFor(() => {
        expect(getHeaderOrder()).toEqual(['Description', 'Name', 'Type']);
      });

      await userEvent.click(screen.getByRole('combobox'));
      await userEvent.click(screen.getByRole('option', {name: '25'}));

      await waitFor(() => {
        expect(screen.getAllByRole('row')).toHaveLength(26);
      });
      expect(getHeaderOrder()).toEqual(['Description', 'Name', 'Type']);
    });

    it('keeps the new order when a moved column is sorted', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility enableSorting />);

      await reorderDescriptionToFront();
      await userEvent.keyboard('{Escape}');

      await waitFor(() => {
        expect(getHeaderOrder()).toEqual(['Description', 'Name', 'Type']);
      });

      await userEvent.click(within(screen.getAllByRole('columnheader')[0]).getByRole('button'));

      await waitFor(() => {
        expect(getHeaderOrder()).toEqual(['Description', 'Name', 'Type']);
      });
    });

    it('keeps the new order across a density change', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility enableDensityToggle />);

      await reorderDescriptionToFront();
      await userEvent.keyboard('{Escape}');

      await userEvent.click(screen.getByRole('button', {name: /density/i}));
      await userEvent.click(await screen.findByText(/compact/i));

      await waitFor(() => {
        expect(getHeaderOrder()).toEqual(['Description', 'Name', 'Type']);
      });
    });

    it('leaves the selection column in place when other columns are reordered', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility enableRowSelection />);

      await reorderDescriptionToFront();
      await userEvent.keyboard('{Escape}');

      await waitFor(() => {
        // The select column has no label, so it reads as an empty header at index 0.
        expect(getHeaderOrder().slice(1)).toEqual(['Description', 'Name', 'Type']);
      });
    });

    it('restores the original order on reset to default', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility tableId="test-reset-order" />);

      await reorderDescriptionToFront();
      await userEvent.keyboard('{Escape}');

      await waitFor(() => {
        expect(getHeaderOrder()).toEqual(['Description', 'Name', 'Type']);
      });

      await userEvent.click(screen.getByRole('button', {name: /reset to default/i}));

      await waitFor(() => {
        expect(getHeaderOrder()).toEqual(['Name', 'Type', 'Description']);
      });
    });
  });

  describe('Non-toggleable Columns', () => {
    it('does not show select column in visibility menu', async () => {
      render(<DataTable columns={testColumns} data={testData} enableColumnVisibility enableRowSelection />);

      const popover = await openColumnVisibilityPopover();

      // Should only show our 3 data columns
      const checkboxes = within(popover).getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3);
    });

    it('does not show actions column in visibility menu when row actions enabled', async () => {
      render(
        <DataTable
          columns={testColumns}
          data={testData}
          enableColumnVisibility
          rowActions={[{id: 'edit', label: 'Edit', onClick: vi.fn()}]}
        />,
      );

      const popover = await openColumnVisibilityPopover();

      // Should only show our 3 data columns
      const checkboxes = within(popover).getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3);
    });
  });
});

// ===========================================================================
// `handleHideAll` (ColumnVisibility.tsx:97-105) had no test at all. It is the one action
// in the menu that can empty the table, so the guard that keeps the first column visible
// is the whole point of it: without that, the user is left with a table of no columns and
// a menu of unchecked boxes, and the only way back is to check one at random.
//
// The merge with the current visibility state matters just as much. Rebuilding the object
// from the toggleable columns alone would drop the entries for `select` and `actions`, so
// a consumer that had hidden either one would see them reappear.
// ===========================================================================
describe('ColumnVisibility — hide all', () => {
  it('leaves the first column visible', async () => {
    render(<DataTable columns={testColumns} data={testData} enableColumnVisibility />);
    const popover = await openColumnVisibilityPopover();

    await userEvent.click(within(popover).getByRole('button', {name: 'Hide All'}));

    const checkboxes = within(popover).getAllByRole('checkbox');
    expect(checkboxes.map((box) => (box as HTMLInputElement).checked)).toEqual([true, false, false]);
  });

  it('keeps a column in the table for the rows to live in', async () => {
    render(<DataTable columns={testColumns} data={testData} enableColumnVisibility />);
    const popover = await openColumnVisibilityPopover();

    await userEvent.click(within(popover).getByRole('button', {name: 'Hide All'}));
    // The popover is a modal, so everything behind it is hidden from the role queries
    // until it closes. Shut it before asking what the table is showing.
    fireEvent.keyDown(popover, {key: 'Escape'});

    // The popover node lingers through its fade, so wait for the table behind it to come
    // back into the accessibility tree rather than for the node to disappear.
    await waitFor(() => {
      expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0);
    });
    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers).toContain('Name');
    expect(headers).not.toContain('Type');
  });

  it('turns them all back on from the same menu', async () => {
    // Hide all then show all is the round trip a user makes while looking for a column,
    // and it has to end where it started.
    render(<DataTable columns={testColumns} data={testData} enableColumnVisibility />);
    const popover = await openColumnVisibilityPopover();
    await userEvent.click(within(popover).getByRole('button', {name: 'Hide All'}));

    await userEvent.click(within(popover).getByRole('button', {name: 'Show All'}));

    const checkboxes = within(popover).getAllByRole('checkbox');
    expect(checkboxes.map((box) => (box as HTMLInputElement).checked)).toEqual([true, true, true]);
  });
});
