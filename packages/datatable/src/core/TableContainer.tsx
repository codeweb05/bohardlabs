import type {SxProps, Theme} from '@mui/material';
import {TableContainer as MuiTableContainer, Table} from '@mui/material';
import type {ColumnSizingState, Row, Table as TanstackTable} from '@tanstack/react-table';
import type {ReactNode} from 'react';
import {useMemo, useRef} from 'react';

import {useTableUI} from '../DataTableContext.hooks';
import {PINNED_SEPARATOR, resolveStickyColumnIds, useStickyColumnOffsets} from '../hooks/useColumnPinning';
import type {CellOverflowMode, ExpandTrigger, HeaderCase, RowAction, RowData} from '../types';
import {DENSITY_CONFIG} from '../types';
import {TableBody} from './TableBody';
import {TableHeader} from './TableHeader';

interface TableContainerProps<TData extends RowData> {
  readonly table: TanstackTable<TData>;
  readonly stickyHeader?: boolean;
  readonly maxHeight?: number | string;
  readonly enableColumnResizing?: boolean;
  readonly enableColumnPinning?: boolean;
  readonly columnSizing?: ColumnSizingState;
  readonly rowActions?: readonly RowAction<TData>[];
  readonly onRowClick?: (row: TData) => void;
  readonly onRowDoubleClick?: (row: TData) => void;
  readonly defaultOverflow?: CellOverflowMode;
  readonly headerCase?: HeaderCase;
  // Expansion props
  readonly enableExpanding?: boolean;
  readonly expandTrigger?: ExpandTrigger;
  readonly renderExpandedRow?: (row: Row<TData>) => ReactNode;
  readonly animateExpansion?: boolean;
  readonly getRowSx?: (row: TData) => SxProps<Theme> | undefined;
  /** Accessible name for the table. Belongs here: `<table>` has an implicit `table` role. */
  readonly ariaLabel?: string;
}

export function TableContainerComponent<TData extends RowData>({
  table,
  stickyHeader = false,
  maxHeight,
  enableColumnResizing = false,
  enableColumnPinning = false,
  columnSizing,
  rowActions,
  onRowClick,
  onRowDoubleClick,
  defaultOverflow = 'ellipsis',
  headerCase,
  enableExpanding = false,
  expandTrigger = 'icon',
  renderExpandedRow,
  animateExpansion = true,
  getRowSx,
  ariaLabel,
}: Readonly<TableContainerProps<TData>>) {
  // P0 fix (1.1): Use granular hook instead of merged context
  const {density, columnPinning, columnVisibility} = useTableUI();
  const densityConfig = DENSITY_CONFIG[density];

  // Calculate total table width when column resizing is enabled
  // Use columnSizing prop to force recalculation on every resize.
  // `getTotalSize()` rather than `getCenterTotalSize()`: the latter drops the pinned
  // columns from the sum, which would leave the table too narrow once anything is pinned.
  const totalWidth = enableColumnResizing ? table.getTotalSize() : undefined;

  // Frozen columns, serialized in visual order. A string rather than an array so it
  // compares by value and the React Compiler re-renders the header and rows on a change.
  const tableRef = useRef<HTMLTableElement>(null);
  const pinnedLeft = enableColumnPinning ? (columnPinning?.left ?? []) : [];
  const pinnedColumns = resolveStickyColumnIds(table, pinnedLeft, columnVisibility).join(PINNED_SEPARATOR);
  useStickyColumnOffsets(tableRef, pinnedColumns);

  // Generate CSS for column widths that updates on every resize
  // This creates a style element that efficiently updates column widths
  const columnStyles = useMemo(() => {
    if (!enableColumnResizing || !columnSizing) return {};

    // Build styles for each column based on current sizing
    const styles: Record<string, React.CSSProperties> = {};
    table.getAllColumns().forEach((column) => {
      const width = columnSizing[column.id] ?? column.getSize();
      styles[column.id] = {width, minWidth: width, maxWidth: width};
    });
    return styles;
  }, [enableColumnResizing, columnSizing, table]);

  return (
    <MuiTableContainer
      sx={{
        width: '100%',
        maxHeight: maxHeight ?? (stickyHeader ? 'calc(100vh - 330px)' : undefined),
        overflow: 'auto',
        position: 'relative',
        '& .MuiTableCell-root': {
          padding: densityConfig.cellPadding,
          fontSize: densityConfig.fontSize,
        },
      }}
    >
      <Table
        ref={tableRef}
        aria-label={ariaLabel}
        stickyHeader={stickyHeader}
        size={density === 'compact' ? 'small' : 'medium'}
        sx={{
          minWidth: '100%',
          width: totalWidth ? `${totalWidth}px` : '100%',
          tableLayout: enableColumnResizing ? 'fixed' : 'auto',
        }}
      >
        <TableHeader
          table={table}
          enableColumnResizing={enableColumnResizing}
          enableColumnOrdering={false}
          columnStyles={columnStyles}
          defaultOverflow={defaultOverflow}
          stickyHeader={stickyHeader}
          headerCase={headerCase}
          pinnedColumns={pinnedColumns}
        />
        <TableBody
          table={table}
          rowActions={rowActions}
          onRowClick={onRowClick}
          onRowDoubleClick={onRowDoubleClick}
          columnStyles={columnStyles}
          defaultOverflow={defaultOverflow}
          enableExpanding={enableExpanding}
          expandTrigger={expandTrigger}
          renderExpandedRow={renderExpandedRow}
          animateExpansion={animateExpansion}
          getRowSx={getRowSx}
          pinnedColumns={pinnedColumns}
        />
      </Table>
    </MuiTableContainer>
  );
}

// Named export for consistency
export {TableContainerComponent as TableContainer};
