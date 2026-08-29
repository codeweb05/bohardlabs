import type {SxProps, Theme} from '@mui/material';
import {Box, Collapse, TableBody as MuiTableBody, TableRow as MuiTableRow, TableCell} from '@mui/material';
import type {Row, Table} from '@tanstack/react-table';
import type {ReactNode} from 'react';
import {Fragment, useMemo} from 'react';

import {useTableCore, useTableUI} from '../DataTableContext.hooks';
import type {CellOverflowMode, ExpandTrigger, RowAction, RowData} from '../types';
import {TableRow} from './TableRow';

interface TableBodyProps<TData extends RowData> {
  readonly table: Table<TData>;
  readonly rowActions?: readonly RowAction<TData>[];
  readonly columnStyles?: Record<string, React.CSSProperties>;
  readonly onRowClick?: (row: TData) => void;
  readonly onRowDoubleClick?: (row: TData) => void;
  readonly defaultOverflow?: CellOverflowMode;
  // Expansion props
  readonly enableExpanding?: boolean;
  readonly expandTrigger?: ExpandTrigger;
  readonly renderExpandedRow?: (row: Row<TData>) => ReactNode;
  readonly animateExpansion?: boolean;
  readonly getRowSx?: (row: TData) => SxProps<Theme> | undefined;
  /** Frozen columns, serialized in visual order (see `useColumnPinning`). */
  readonly pinnedColumns?: string;
}

export function TableBody<TData extends RowData>({
  table,
  rowActions,
  columnStyles,
  onRowClick,
  onRowDoubleClick,
  defaultOverflow = 'ellipsis',
  enableExpanding = false,
  expandTrigger = 'icon',
  renderExpandedRow,
  animateExpansion = true,
  getRowSx,
  pinnedColumns = '',
}: Readonly<TableBodyProps<TData>>) {
  // Use granular hooks instead of merged context (P0 fix: 1.1)
  const {dataVersion, columnsVersion} = useTableCore<TData>();
  const {expanded, pagination, columnVisibility, columnOrder} = useTableUI();

  // Compute rows from table's row model.
  // P0 fix (2.2): Removed rowSelection from deps — selection is a per-row rendering concern,
  // not a structural concern for the row list.
  // `columnOrder` is a dep so that a reorder invalidates this memo and the mapped rows
  // re-render. `table` is a stable reference, so without it the cached row elements are
  // reused and the body cells keep the old order while the headers move.
  // `columnsVersion` is a dep for the same reason as `dataVersion`: the cell renderers come
  // off the column definitions, so a `columns` swap has to invalidate the rows too or the
  // body keeps rendering with the previous set's cells.
  const rowDeps = [table, pagination, expanded, columnVisibility, columnOrder, dataVersion, columnsVersion];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => table.getRowModel().rows, rowDeps);

  // Helper to check if a row is expanded
  const isRowExpanded = (row: Row<TData>): boolean => {
    if (!enableExpanding) return false;
    if (!expanded) return row.getIsExpanded();
    if (typeof expanded === 'boolean') return expanded;
    // Keyed by the table's row id, which is whatever `getRowId` returns. Looking it up
    // by `row.original.id` misses on every page that supplies its own key (a uuid, a
    // compound `${orderId}-${lineId}`), and the panel then never opens.
    return Boolean(expanded[row.id]);
  };

  return (
    <MuiTableBody>
      {rows.map((row) => {
        const rowIsExpanded = isRowExpanded(row);

        return (
          <Fragment key={row.id}>
            <TableRow
              row={row}
              table={table}
              rowActions={rowActions}
              columnStyles={columnStyles}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(row.original) : undefined}
              defaultOverflow={defaultOverflow}
              enableExpanding={enableExpanding}
              expandTrigger={expandTrigger}
              getRowSx={getRowSx}
              pinnedColumns={pinnedColumns}
              columnsVersion={columnsVersion}
            />
            {/* Expanded row content - only render when expanded or animating */}
            {enableExpanding && renderExpandedRow && (animateExpansion || rowIsExpanded) && (
              <MuiTableRow
                sx={{
                  ...(animateExpansion &&
                    !rowIsExpanded && {
                      '& > td': {
                        p: 0,
                        border: 0,
                      },
                    }),
                }}
              >
                <TableCell
                  colSpan={row.getVisibleCells().length}
                  sx={{
                    p: `0 !important`,
                    borderBottom: rowIsExpanded ? (theme) => `1px solid ${theme.palette.divider}` : 0,
                  }}
                >
                  {animateExpansion ? (
                    <Collapse in={rowIsExpanded} timeout={200} unmountOnExit>
                      <Box sx={{p: 2, bgcolor: 'action.hover'}}>{renderExpandedRow(row)}</Box>
                    </Collapse>
                  ) : (
                    <Box sx={{p: 2, bgcolor: 'action.hover'}}>{renderExpandedRow(row)}</Box>
                  )}
                </TableCell>
              </MuiTableRow>
            )}
          </Fragment>
        );
      })}
    </MuiTableBody>
  );
}
