import {Box, Collapse, TableBody as MuiTableBody, TableRow as MuiTableRow, TableCell} from '@mui/material';
import type {Table} from '@tanstack/react-table';
import {Fragment, useMemo} from 'react';

import {useTableCore, useTableUI} from '../DataTableContext.hooks';
import {isRowExpanded, type TableExpansionProps} from '../expansion';
import type {CellOverflowMode, RowAction, RowData} from '../types';
import {TableRow} from './TableRow';

interface TableBodyProps<TData extends RowData> extends TableExpansionProps<TData> {
  readonly table: Table<TData>;
  readonly rowActions?: readonly RowAction<TData>[];
  readonly columnStyles?: Record<string, React.CSSProperties>;
  readonly onRowClick?: (row: TData) => void;
  readonly onRowDoubleClick?: (row: TData) => void;
  readonly defaultOverflow?: CellOverflowMode;
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
  // `table` is a stable identity; the rest of the list is the compiler-visible signature.
  // Held in a variable so the compiler cannot prove the callback ignores those inputs and
  // drop them. Inlining the array made column swaps and similar updates paint stale cells.
  const rowDeps = [table, pagination, expanded, columnVisibility, columnOrder, dataVersion, columnsVersion];
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  const rows = useMemo(() => table.getRowModel().rows, rowDeps);

  return (
    <MuiTableBody>
      {rows.map((row) => {
        const rowIsExpanded = isRowExpanded(row, enableExpanding, expanded);

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
