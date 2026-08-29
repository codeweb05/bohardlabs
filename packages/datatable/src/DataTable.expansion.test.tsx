import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {DataTable} from './DataTable';
import type {TestRole} from './test/test-utils';
import {generateTestRoles, render} from './test/test-utils';
import type {DataTableColumnDef} from './types';

// Test data with nested content for expansion
interface TestDataWithChildren extends TestRole {
  children: {id: string; name: string}[];
}

const testDataWithChildren: TestDataWithChildren[] = generateTestRoles(5).map((role, index) => ({
  ...role,
  children: [
    {id: `child-${index}-1`, name: `Child 1 of ${role.name}`},
    {id: `child-${index}-2`, name: `Child 2 of ${role.name}`},
  ],
}));

const testColumns: DataTableColumnDef<TestDataWithChildren>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    enableSorting: true,
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

describe('DataTable Expansion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Expansion', () => {
    it('renders expand column when enableExpanding is true', () => {
      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          renderExpandedRow={(row) => <div>Expanded: {row.original.name}</div>}
        />,
      );

      // Should have expand buttons for each row
      const expandButtons = screen.getAllByRole('button', {name: /expand row|collapse row/i});
      expect(expandButtons.length).toBe(5);
    });

    it('does not render expand column when enableExpanding is false', () => {
      render(<DataTable columns={testColumns} data={testDataWithChildren} enableExpanding={false} />);

      // Should not have expand buttons
      const expandButtons = screen.queryAllByRole('button', {name: /expand row|collapse row/i});
      expect(expandButtons.length).toBe(0);
    });

    it('renders chevron icon for each row', () => {
      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          renderExpandedRow={(row) => <div>Expanded: {row.original.name}</div>}
        />,
      );

      // Expand row buttons should be present
      const buttons = screen.getAllByRole('button', {name: /expand row/i});
      expect(buttons).toHaveLength(testDataWithChildren.length);
    });

    it('accepts renderExpandedRow prop', () => {
      const renderMock = vi.fn((row) => <div data-testid="expanded-content">{row.original.name}</div>);

      render(
        <DataTable columns={testColumns} data={testDataWithChildren} enableExpanding renderExpandedRow={renderMock} />,
      );

      // Component should render without errors
      const expandButtons = screen.getAllByRole('button', {name: /expand row/i});
      expect(expandButtons.length).toBe(5);
    });

    it('all expand buttons have aria-expanded false initially', () => {
      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          renderExpandedRow={(row) => <div>Expanded: {row.original.name}</div>}
        />,
      );

      const expandButtons = screen.getAllByRole('button', {name: /expand row/i});
      expandButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('expand button has correct onClick handler attached', () => {
      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          renderExpandedRow={(row) => <div data-testid="expanded-content">Expanded: {row.original.name}</div>}
        />,
      );

      // Verify expand buttons exist and have correct structure
      const expandButtons = screen.getAllByRole('button', {name: /expand row/i});
      expect(expandButtons).toHaveLength(5);

      // Each button should be an IconButton with the correct attributes
      expandButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button).toHaveAttribute('aria-label', 'Expand row');
        expect(button).toHaveAttribute('type', 'button');
      });
    });

    it('all expand buttons have Expand row aria-label initially', () => {
      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          renderExpandedRow={(row) => <div>Expanded: {row.original.name}</div>}
        />,
      );

      const expandButtons = screen.getAllByRole('button', {name: /expand row/i});
      expandButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label', 'Expand row');
      });
    });
  });

  describe('Row Expand and Collapse Functionality', () => {
    it('expands row when clicking expand icon', async () => {
      const user = userEvent.setup();

      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          renderExpandedRow={(row) => (
            <div data-testid={`expanded-content-${row.original.id}`}>Expanded: {row.original.name}</div>
          )}
        />,
      );

      // Get first expand button
      const expandButtons = screen.getAllByRole('button', {name: /expand row/i});
      const firstExpandButton = expandButtons[0];

      // Initially no expanded content
      expect(screen.queryByTestId(`expanded-content-${testDataWithChildren[0].id}`)).not.toBeInTheDocument();

      // Click to expand
      await user.click(firstExpandButton);

      // Wait for expanded content to appear
      await waitFor(() => {
        expect(screen.getByTestId(`expanded-content-${testDataWithChildren[0].id}`)).toBeInTheDocument();
      });

      // Button should now show "Collapse row"
      expect(firstExpandButton).toHaveAttribute('aria-expanded', 'true');
      expect(firstExpandButton).toHaveAttribute('aria-label', 'Collapse row');
    });

    it('collapses row when clicking collapse icon', async () => {
      const user = userEvent.setup();

      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          renderExpandedRow={(row) => (
            <div data-testid={`expanded-content-${row.original.id}`}>Expanded: {row.original.name}</div>
          )}
        />,
      );

      // Get first expand button
      const expandButtons = screen.getAllByRole('button', {name: /expand row/i});
      const firstExpandButton = expandButtons[0];

      // Click to expand
      await user.click(firstExpandButton);

      // Wait for expanded content
      await waitFor(() => {
        expect(screen.getByTestId(`expanded-content-${testDataWithChildren[0].id}`)).toBeInTheDocument();
      });

      // Click to collapse
      await user.click(firstExpandButton);

      // Wait for expanded content to disappear
      await waitFor(() => {
        expect(screen.queryByTestId(`expanded-content-${testDataWithChildren[0].id}`)).not.toBeInTheDocument();
      });

      // Button should show "Expand row" again
      expect(firstExpandButton).toHaveAttribute('aria-expanded', 'false');
      expect(firstExpandButton).toHaveAttribute('aria-label', 'Expand row');
    });

    it('can expand multiple rows independently', async () => {
      const user = userEvent.setup();

      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          renderExpandedRow={(row) => (
            <div data-testid={`expanded-content-${row.original.id}`}>Expanded: {row.original.name}</div>
          )}
        />,
      );

      const expandButtons = screen.getAllByRole('button', {name: /expand row/i});

      // Expand first row
      await user.click(expandButtons[0]);
      await waitFor(() => {
        expect(screen.getByTestId(`expanded-content-${testDataWithChildren[0].id}`)).toBeInTheDocument();
      });

      // Expand second row
      await user.click(expandButtons[1]);
      await waitFor(() => {
        expect(screen.getByTestId(`expanded-content-${testDataWithChildren[1].id}`)).toBeInTheDocument();
      });

      // Both should be expanded
      expect(screen.getByTestId(`expanded-content-${testDataWithChildren[0].id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`expanded-content-${testDataWithChildren[1].id}`)).toBeInTheDocument();
    });

    it('renders expanded content with correct data', async () => {
      const user = userEvent.setup();

      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          renderExpandedRow={(row) => {
            const {original} = row;
            const subItems = original['children' as keyof typeof original] as TestRole[];
            return (
              <div data-testid="expanded-content">
                <span data-testid="expanded-name">{original.name}</span>
                <span data-testid="expanded-children-count">{subItems.length}</span>
              </div>
            );
          }}
        />,
      );

      const expandButtons = screen.getAllByRole('button', {name: /expand row/i});

      // Expand first row
      await user.click(expandButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('expanded-content')).toBeInTheDocument();
      });

      // Verify content matches the row data
      expect(screen.getByTestId('expanded-name')).toHaveTextContent(testDataWithChildren[0].name);
      expect(screen.getByTestId('expanded-children-count')).toHaveTextContent('2');
    });

    it('chevron icon rotates when expanded', async () => {
      const user = userEvent.setup();

      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          renderExpandedRow={(row) => <div data-testid="expanded-content">Expanded: {row.original.name}</div>}
        />,
      );

      const expandButtons = screen.getAllByRole('button', {name: /expand row/i});
      const firstButton = expandButtons[0];

      // Initially not expanded
      expect(firstButton).toHaveAttribute('aria-expanded', 'false');

      // Click to expand
      await user.click(firstButton);

      // Wait for expansion state change
      await waitFor(() => {
        expect(firstButton).toHaveAttribute('aria-expanded', 'true');
      });
    });
  });

  describe('Expansion Trigger Modes', () => {
    it('accepts expandTrigger="icon" prop', () => {
      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          expandTrigger="icon"
          renderExpandedRow={(row) => <div>Expanded: {row.original.name}</div>}
        />,
      );

      // Component should render with expand buttons
      const expandButtons = screen.getAllByRole('button', {name: /expand row/i});
      expect(expandButtons.length).toBe(5);
    });

    it('accepts expandTrigger="row" prop', () => {
      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          expandTrigger="row"
          renderExpandedRow={(row) => <div>Expanded: {row.original.name}</div>}
        />,
      );

      // Component should render with expand buttons
      const expandButtons = screen.getAllByRole('button', {name: /expand row/i});
      expect(expandButtons.length).toBe(5);

      // Verify all data rows are rendered (5 data rows + 5 expansion rows for animation)
      const rows = screen.getAllByRole('row');
      // Skip header row - with animation, each data row has an expansion row
      expect(rows.length).toBeGreaterThanOrEqual(6); // 1 header + 5 data rows minimum
    });

    it('accepts expandTrigger="both" prop', () => {
      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          expandTrigger="both"
          renderExpandedRow={(row) => <div>Expanded: {row.original.name}</div>}
        />,
      );

      // Component should render with expand buttons
      const expandButtons = screen.getAllByRole('button', {name: /expand row/i});
      expect(expandButtons.length).toBe(5);
    });

    it('defaults to "icon" trigger when expandTrigger is not specified', () => {
      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          renderExpandedRow={(row) => <div>Expanded: {row.original.name}</div>}
        />,
      );

      // All expand buttons should be present and in collapsed state
      const expandButtons = screen.getAllByRole('button', {name: /expand row/i});
      expect(expandButtons.length).toBe(5);
      expandButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('expands row when clicking row with expandTrigger="row"', async () => {
      const user = userEvent.setup();

      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          expandTrigger="row"
          renderExpandedRow={(row) => (
            <div data-testid={`expanded-content-${row.original.id}`}>Expanded: {row.original.name}</div>
          )}
        />,
      );

      // Get the first data row (skip header)
      const rows = screen.getAllByRole('row');
      const firstDataRow = rows[1];

      // Click the row itself (not the button)
      await user.click(firstDataRow);

      // Wait for expanded content
      await waitFor(() => {
        expect(screen.getByTestId(`expanded-content-${testDataWithChildren[0].id}`)).toBeInTheDocument();
      });
    });

    it('expands row when clicking row with expandTrigger="both"', async () => {
      const user = userEvent.setup();

      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          expandTrigger="both"
          renderExpandedRow={(row) => (
            <div data-testid={`expanded-content-${row.original.id}`}>Expanded: {row.original.name}</div>
          )}
        />,
      );

      // Get the first data row (skip header)
      const rows = screen.getAllByRole('row');
      const firstDataRow = rows[1];

      // Click the row itself
      await user.click(firstDataRow);

      // Wait for expanded content
      await waitFor(() => {
        expect(screen.getByTestId(`expanded-content-${testDataWithChildren[0].id}`)).toBeInTheDocument();
      });
    });

    it('does not expand row when clicking row with expandTrigger="icon"', async () => {
      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          expandTrigger="icon"
          renderExpandedRow={(row) => (
            <div data-testid={`expanded-content-${row.original.id}`}>Expanded: {row.original.name}</div>
          )}
        />,
      );

      // Get the first data row (skip header)
      const rows = screen.getAllByRole('row');
      const firstDataRow = rows[1];

      // Find a cell that's not the expand button cell (to click on the row)
      const cells = within(firstDataRow).getAllByRole('cell');
      const nameCell = cells[1]; // Second cell should be the name column

      // Click the cell
      fireEvent.click(nameCell);

      // Should NOT expand - wait a bit to ensure no state change
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(screen.queryByTestId(`expanded-content-${testDataWithChildren[0].id}`)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('expand buttons have aria-expanded attribute', () => {
      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          renderExpandedRow={(row) => <div>Expanded: {row.original.name}</div>}
        />,
      );

      const expandButtons = screen.getAllByRole('button', {name: /expand row/i});
      expandButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('expand buttons have proper aria-label', () => {
      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          renderExpandedRow={(row) => <div>Expanded: {row.original.name}</div>}
        />,
      );

      const expandButtons = screen.getAllByRole('button', {name: /expand row/i});
      expandButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label', 'Expand row');
      });
    });

    it('aria-label changes to Collapse row when expanded', async () => {
      const user = userEvent.setup();

      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          renderExpandedRow={(row) => <div data-testid="expanded-content">Expanded: {row.original.name}</div>}
        />,
      );

      const expandButtons = screen.getAllByRole('button', {name: /expand row/i});
      const firstButton = expandButtons[0];

      // Click to expand
      await user.click(firstButton);

      // Wait for aria-label to change
      await waitFor(() => {
        expect(firstButton).toHaveAttribute('aria-label', 'Collapse row');
      });
    });

    it('table has correct structure for expansion', () => {
      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          renderExpandedRow={(row) => <div data-testid="expanded-content">Expanded: {row.original.name}</div>}
        />,
      );

      // Table should have correct number of rows
      // With animation enabled, each data row has an expansion row (collapsed by default)
      // 1 header + 5 data rows + 5 expansion rows = 11 rows
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThanOrEqual(6); // At minimum: 1 header + 5 data rows

      // Each data row should have an expand cell
      const expandButtons = screen.getAllByRole('button', {name: /expand row/i});
      expect(expandButtons.length).toBe(5);
    });

    it('expanded content row spans full table width', async () => {
      const user = userEvent.setup();

      render(
        <DataTable
          columns={testColumns}
          data={testDataWithChildren}
          enableExpanding
          renderExpandedRow={(row) => <div data-testid="expanded-content">Expanded: {row.original.name}</div>}
        />,
      );

      const expandButtons = screen.getAllByRole('button', {name: /expand row/i});

      // Expand first row
      await user.click(expandButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('expanded-content')).toBeInTheDocument();
      });

      // Verify expanded content is rendered within a cell that spans all columns
      const expandedContent = screen.getByTestId('expanded-content');
      expect(expandedContent).toBeInTheDocument();
      // The expanded row should exist and contain the expanded content
      const allCells = screen.getAllByRole('cell');
      const expandedCell = allCells.find((cell) => cell.getAttribute('colspan'));
      expect(expandedCell).toBeDefined();
    });
  });
});
