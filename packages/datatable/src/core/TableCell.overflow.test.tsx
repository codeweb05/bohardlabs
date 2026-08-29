import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {describe, expect, it} from 'vitest';

import {DataTableProvider} from '../DataTableContext';
import {render, screen} from '../test/test-utils';
import type {CellOverflowMode, DataTableColumnDef, RowData} from '../types';
import {TableCell} from './TableCell';

interface TestData extends RowData {
  readonly id: number;
  readonly name: string;
  readonly description: string;
}

const mockData: TestData[] = [
  {
    id: 1,
    name: 'Short Name',
    description: 'This is a very long description that will definitely overflow the container',
  },
];

function TestTableWrapper({
  overflowMode,
  columnOverflow,
}: Readonly<{
  overflowMode?: CellOverflowMode;
  columnOverflow?: CellOverflowMode;
}>) {
  'use no memo';
  const columns: DataTableColumnDef<TestData>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Name',
      overflow: columnOverflow,
    } as DataTableColumnDef<TestData>,
  ];

  const table = useReactTable({
    data: mockData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const row = table.getRowModel().rows[0];
  const cell = row?.getVisibleCells()[0];

  if (!cell || !row) {
    return <div>No data</div>;
  }

  return (
    <DataTableProvider table={table} density="comfortable" setDensity={() => {}} isMobile={false}>
      <table>
        <tbody>
          <tr>
            <TableCell cell={cell} row={row} table={table} defaultOverflow={overflowMode} />
          </tr>
        </tbody>
      </table>
    </DataTableProvider>
  );
}

describe('TableCell - Overflow Behavior', () => {
  describe('Ellipsis Mode (default)', () => {
    it('applies ellipsis styles by default', () => {
      render(<TestTableWrapper />);

      const cellContent = screen.getByText('Short Name').closest('.cell-content');
      expect(cellContent).toBeInTheDocument();

      // Check for ellipsis styles
      expect(cellContent).toHaveStyle({
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });
    });

    it('applies ellipsis styles when explicitly set', () => {
      render(<TestTableWrapper overflowMode="ellipsis" />);

      const cellContent = screen.getByText('Short Name').closest('.cell-content');
      expect(cellContent).toBeInTheDocument();

      expect(cellContent).toHaveStyle({
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });
    });

    it('column-level overflow overrides global default', () => {
      render(<TestTableWrapper overflowMode="wrap" columnOverflow="ellipsis" />);

      const cellContent = screen.getByText('Short Name').closest('.cell-content');
      expect(cellContent).toBeInTheDocument();

      // Should use column-level ellipsis, not global wrap
      expect(cellContent).toHaveStyle({
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });
    });
  });

  describe('Wrap Mode', () => {
    it('applies wrap styles when set globally', () => {
      render(<TestTableWrapper overflowMode="wrap" />);

      const cellContent = screen.getByText('Short Name').closest('.cell-content');
      expect(cellContent).toBeInTheDocument();

      expect(cellContent).toHaveStyle({
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        whiteSpace: 'normal',
      });
    });

    it('applies wrap styles when set at column level', () => {
      render(<TestTableWrapper columnOverflow="wrap" />);

      const cellContent = screen.getByText('Short Name').closest('.cell-content');
      expect(cellContent).toBeInTheDocument();

      expect(cellContent).toHaveStyle({
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        whiteSpace: 'normal',
      });
    });

    it('does not apply ellipsis styles in wrap mode', () => {
      render(<TestTableWrapper overflowMode="wrap" />);

      const cellContent = screen.getByText('Short Name').closest('.cell-content');
      expect(cellContent).toBeInTheDocument();

      // Should NOT have textOverflow: ellipsis
      expect(cellContent).not.toHaveStyle({
        textOverflow: 'ellipsis',
      });
    });
  });

  describe('Truncate Mode', () => {
    it('applies truncate styles when set globally', () => {
      render(<TestTableWrapper overflowMode="truncate" />);

      const cellContent = screen.getByText('Short Name').closest('.cell-content');
      expect(cellContent).toBeInTheDocument();

      expect(cellContent).toHaveStyle({
        overflow: 'hidden',
      });

      // Should NOT have textOverflow: ellipsis (that's the difference from ellipsis mode)
      expect(cellContent).not.toHaveStyle({
        textOverflow: 'ellipsis',
      });
    });

    it('applies truncate styles when set at column level', () => {
      render(<TestTableWrapper columnOverflow="truncate" />);

      const cellContent = screen.getByText('Short Name').closest('.cell-content');
      expect(cellContent).toBeInTheDocument();

      expect(cellContent).toHaveStyle({
        overflow: 'hidden',
      });
    });
  });

  describe('Column-level overflow priority', () => {
    it('column ellipsis overrides global wrap', () => {
      render(<TestTableWrapper overflowMode="wrap" columnOverflow="ellipsis" />);

      const cellContent = screen.getByText('Short Name').closest('.cell-content');

      expect(cellContent).toHaveStyle({
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });
    });

    it('column wrap overrides global ellipsis', () => {
      render(<TestTableWrapper overflowMode="ellipsis" columnOverflow="wrap" />);

      const cellContent = screen.getByText('Short Name').closest('.cell-content');

      expect(cellContent).toHaveStyle({
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        whiteSpace: 'normal',
      });
    });

    it('column truncate overrides global ellipsis', () => {
      render(<TestTableWrapper overflowMode="ellipsis" columnOverflow="truncate" />);

      const cellContent = screen.getByText('Short Name').closest('.cell-content');

      expect(cellContent).toHaveStyle({
        overflow: 'hidden',
      });

      // Should NOT have ellipsis
      expect(cellContent).not.toHaveStyle({
        textOverflow: 'ellipsis',
      });
    });
  });

  describe('Legacy truncate prop compatibility', () => {
    function TestLegacyTruncate({truncate, maxWidth}: Readonly<{truncate?: boolean; maxWidth?: number}>) {
      const columns: DataTableColumnDef<TestData>[] = [
        {
          id: 'name',
          accessorKey: 'name',
          header: 'Name',
          truncate,
          maxWidth,
        } as DataTableColumnDef<TestData>,
      ];

      const table = useReactTable({
        data: mockData,
        columns,
        getCoreRowModel: getCoreRowModel(),
      });

      const row = table.getRowModel().rows[0];
      const cell = row?.getVisibleCells()[0];

      if (!cell || !row) {
        return <div>No data</div>;
      }

      return (
        <DataTableProvider table={table} density="comfortable" setDensity={() => {}} isMobile={false}>
          <table>
            <tbody>
              <tr>
                <TableCell cell={cell} row={row} table={table} truncate={truncate} maxWidth={maxWidth} />
              </tr>
            </tbody>
          </table>
        </DataTableProvider>
      );
    }

    it('legacy truncate prop still works', () => {
      render(<TestLegacyTruncate truncate={true} />);

      const cellContent = screen.getByText('Short Name').closest('.cell-content');

      expect(cellContent).toHaveStyle({
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });
    });

    it('legacy truncate prop takes precedence over overflow mode', () => {
      function TestTruncatePrecedence() {
        const columns: DataTableColumnDef<TestData>[] = [
          {
            id: 'name',
            accessorKey: 'name',
            header: 'Name',
            truncate: true,
            overflow: 'wrap', // Should be ignored when truncate is true
          } as DataTableColumnDef<TestData>,
        ];

        const table = useReactTable({
          data: mockData,
          columns,
          getCoreRowModel: getCoreRowModel(),
        });

        const row = table.getRowModel().rows[0];
        const cell = row?.getVisibleCells()[0];

        if (!cell || !row) {
          return <div>No data</div>;
        }

        return (
          <DataTableProvider table={table} density="comfortable" setDensity={() => {}} isMobile={false}>
            <table>
              <tbody>
                <tr>
                  {/* Pass truncate prop explicitly since we're not using TableRow */}
                  <TableCell cell={cell} row={row} table={table} truncate={true} defaultOverflow="wrap" />
                </tr>
              </tbody>
            </table>
          </DataTableProvider>
        );
      }

      render(<TestTruncatePrecedence />);

      const cellContent = screen.getByText('Short Name').closest('.cell-content');

      // Should use truncate=true behavior (ellipsis), not defaultOverflow="wrap"
      expect(cellContent).toHaveStyle({
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });
    });
  });

  describe('Content overflow prevention', () => {
    it('applies maxWidth to prevent overflow into next column (ellipsis mode)', () => {
      render(<TestTableWrapper overflowMode="ellipsis" />);

      const cellContent = screen.getByText('Short Name').closest('.cell-content');

      // maxWidth should be set to prevent overflow
      expect(cellContent).toHaveStyle({
        maxWidth: '100%',
      });
    });

    it('applies maxWidth to prevent overflow into next column (truncate mode)', () => {
      render(<TestTableWrapper overflowMode="truncate" />);

      const cellContent = screen.getByText('Short Name').closest('.cell-content');

      // maxWidth should be set to prevent overflow
      expect(cellContent).toHaveStyle({
        maxWidth: '100%',
      });
    });

    it('wrap mode allows content to wrap within cell boundaries', () => {
      render(<TestTableWrapper overflowMode="wrap" />);

      const cellContent = screen.getByText('Short Name').closest('.cell-content');

      // Wrap mode uses word-break instead of maxWidth constraint
      expect(cellContent).toHaveStyle({
        wordBreak: 'break-word',
      });
    });
  });
});
