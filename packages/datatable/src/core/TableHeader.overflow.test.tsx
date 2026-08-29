import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {describe, expect, it} from 'vitest';

import {DataTableProvider} from '../DataTableContext';
import {render, screen} from '../test/test-utils';
import type {CellOverflowMode, DataTableColumnDef, RowData} from '../types';
import {TableHeader} from './TableHeader';

interface TestData extends RowData {
  readonly id: number;
  readonly name: string;
  readonly email: string;
}

const mockData: TestData[] = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
  },
];

function TestTableHeaderWrapper({
  headerText = 'Name',
  overflowMode,
  columnOverflow,
}: Readonly<{
  headerText?: string;
  overflowMode?: CellOverflowMode;
  columnOverflow?: CellOverflowMode;
}>) {
  const columns: DataTableColumnDef<TestData>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      header: headerText,
      overflow: columnOverflow,
    } as DataTableColumnDef<TestData>,
  ];

  const table = useReactTable({
    data: mockData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DataTableProvider table={table} density="comfortable" setDensity={() => {}} isMobile={false}>
      <table>
        <TableHeader table={table} defaultOverflow={overflowMode} />
      </table>
    </DataTableProvider>
  );
}

describe('TableHeader - Overflow Behavior', () => {
  describe('Ellipsis Mode (default)', () => {
    it('applies ellipsis styles by default', () => {
      render(<TestTableHeaderWrapper />);

      const headerContent = screen.getByText('Name').closest('.header-content');
      expect(headerContent).toBeInTheDocument();

      // Check for ellipsis styles
      expect(headerContent).toHaveStyle({
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });
    });

    it('applies ellipsis styles when explicitly set', () => {
      render(<TestTableHeaderWrapper overflowMode="ellipsis" />);

      const headerContent = screen.getByText('Name').closest('.header-content');
      expect(headerContent).toBeInTheDocument();

      expect(headerContent).toHaveStyle({
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });
    });

    it('column-level overflow overrides global default', () => {
      render(<TestTableHeaderWrapper overflowMode="wrap" columnOverflow="ellipsis" />);

      const headerContent = screen.getByText('Name').closest('.header-content');
      expect(headerContent).toBeInTheDocument();

      // Should use column-level ellipsis, not global wrap
      expect(headerContent).toHaveStyle({
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });
    });
  });

  describe('Wrap Mode', () => {
    it('applies wrap styles when set globally', () => {
      render(<TestTableHeaderWrapper overflowMode="wrap" />);

      const headerContent = screen.getByText('Name').closest('.header-content');
      expect(headerContent).toBeInTheDocument();

      expect(headerContent).toHaveStyle({
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        whiteSpace: 'normal',
      });
    });

    it('applies wrap styles when set at column level', () => {
      render(<TestTableHeaderWrapper columnOverflow="wrap" />);

      const headerContent = screen.getByText('Name').closest('.header-content');
      expect(headerContent).toBeInTheDocument();

      expect(headerContent).toHaveStyle({
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        whiteSpace: 'normal',
      });
    });

    it('does not apply ellipsis styles in wrap mode', () => {
      render(<TestTableHeaderWrapper overflowMode="wrap" />);

      const headerContent = screen.getByText('Name').closest('.header-content');
      expect(headerContent).toBeInTheDocument();

      // Should NOT have textOverflow: ellipsis
      expect(headerContent).not.toHaveStyle({
        textOverflow: 'ellipsis',
      });
    });
  });

  describe('Truncate Mode', () => {
    it('applies truncate styles when set globally', () => {
      render(<TestTableHeaderWrapper overflowMode="truncate" />);

      const headerContent = screen.getByText('Name').closest('.header-content');
      expect(headerContent).toBeInTheDocument();

      expect(headerContent).toHaveStyle({
        overflow: 'hidden',
      });

      // Should NOT have textOverflow: ellipsis (that's the difference from ellipsis mode)
      expect(headerContent).not.toHaveStyle({
        textOverflow: 'ellipsis',
      });
    });

    it('applies truncate styles when set at column level', () => {
      render(<TestTableHeaderWrapper columnOverflow="truncate" />);

      const headerContent = screen.getByText('Name').closest('.header-content');
      expect(headerContent).toBeInTheDocument();

      expect(headerContent).toHaveStyle({
        overflow: 'hidden',
      });
    });
  });

  describe('Column-level overflow priority', () => {
    it('column ellipsis overrides global wrap', () => {
      render(<TestTableHeaderWrapper overflowMode="wrap" columnOverflow="ellipsis" />);

      const headerContent = screen.getByText('Name').closest('.header-content');

      expect(headerContent).toHaveStyle({
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });
    });

    it('column wrap overrides global ellipsis', () => {
      render(<TestTableHeaderWrapper overflowMode="ellipsis" columnOverflow="wrap" />);

      const headerContent = screen.getByText('Name').closest('.header-content');

      expect(headerContent).toHaveStyle({
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        whiteSpace: 'normal',
      });
    });

    it('column truncate overrides global ellipsis', () => {
      render(<TestTableHeaderWrapper overflowMode="ellipsis" columnOverflow="truncate" />);

      const headerContent = screen.getByText('Name').closest('.header-content');

      expect(headerContent).toHaveStyle({
        overflow: 'hidden',
      });

      // Should NOT have ellipsis
      expect(headerContent).not.toHaveStyle({
        textOverflow: 'ellipsis',
      });
    });
  });

  describe('Sortable headers', () => {
    it('overflow styles work with sortable headers', () => {
      function TestSortableHeader() {
        const columns: DataTableColumnDef<TestData>[] = [
          {
            id: 'name',
            accessorKey: 'name',
            header: 'Sortable Name Column',
            enableSorting: true,
            overflow: 'ellipsis',
          } as DataTableColumnDef<TestData>,
        ];

        const table = useReactTable({
          data: mockData,
          columns,
          getCoreRowModel: getCoreRowModel(),
        });

        return (
          <DataTableProvider table={table} density="comfortable" setDensity={() => {}} isMobile={false}>
            <table>
              <TableHeader table={table} defaultOverflow="ellipsis" />
            </table>
          </DataTableProvider>
        );
      }

      render(<TestSortableHeader />);

      const headerContent = screen.getByText('Sortable Name Column').closest('.header-content');
      expect(headerContent).toBeInTheDocument();

      // Should have overflow styles
      expect(headerContent).toHaveStyle({
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });

      // Sort button should also be present
      const sortButton = screen.getByRole('button');
      expect(sortButton).toBeInTheDocument();
    });
  });

  describe('Long header text', () => {
    it('handles very long header text with ellipsis', () => {
      const longHeaderText =
        'This is a very long header text that will definitely overflow the container and should be truncated with ellipsis';

      render(<TestTableHeaderWrapper headerText={longHeaderText} overflowMode="ellipsis" />);

      const headerContent = screen.getByText(longHeaderText).closest('.header-content');
      expect(headerContent).toBeInTheDocument();

      expect(headerContent).toHaveStyle({
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });
    });

    it('handles very long header text with wrap', () => {
      const longHeaderText =
        'This is a very long header text that will wrap to multiple lines instead of being truncated';

      render(<TestTableHeaderWrapper headerText={longHeaderText} overflowMode="wrap" />);

      const headerContent = screen.getByText(longHeaderText).closest('.header-content');
      expect(headerContent).toBeInTheDocument();

      expect(headerContent).toHaveStyle({
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        whiteSpace: 'normal',
      });
    });
  });

  describe('Multiple columns with different overflow modes', () => {
    it('each column can have its own overflow mode', () => {
      function TestMultipleColumns() {
        const columns: DataTableColumnDef<TestData>[] = [
          {
            id: 'name',
            accessorKey: 'name',
            header: 'Name',
            overflow: 'ellipsis',
          } as DataTableColumnDef<TestData>,
          {
            id: 'email',
            accessorKey: 'email',
            header: 'Email',
            overflow: 'wrap',
          } as DataTableColumnDef<TestData>,
        ];

        const table = useReactTable({
          data: mockData,
          columns,
          getCoreRowModel: getCoreRowModel(),
        });

        return (
          <DataTableProvider table={table} density="comfortable" setDensity={() => {}} isMobile={false}>
            <table>
              <TableHeader table={table} defaultOverflow="truncate" />
            </table>
          </DataTableProvider>
        );
      }

      render(<TestMultipleColumns />);

      const nameHeader = screen.getByText('Name').closest('.header-content');
      const emailHeader = screen.getByText('Email').closest('.header-content');

      // Name column should have ellipsis
      expect(nameHeader).toHaveStyle({
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });

      // Email column should have wrap
      expect(emailHeader).toHaveStyle({
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        whiteSpace: 'normal',
      });
    });
  });
});
