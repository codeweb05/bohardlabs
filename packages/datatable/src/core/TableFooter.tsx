import {TableFooter as MuiTableFooter, TableRow as MuiTableRow, TableCell} from '@mui/material';
import type {Table} from '@tanstack/react-table';
import {useMemo} from 'react';

import {useTableCore, useTableUI} from '../DataTableContext.hooks';
import {getPinnedInfo, pinnedHeaderCellSx} from '../hooks/useColumnPinning';
import type {DataTableColumnDef, RowData} from '../types';
import {formatTotal} from './aggregate';

interface TableFooterProps<TData extends RowData> {
  readonly table: Table<TData>;
  /** By column id. A column with no finite number here gets an empty cell. */
  readonly totals?: Readonly<Record<string, number | null>>;
  /** Frozen columns, serialized in visual order (see `useColumnPinning`). */
  readonly pinnedColumns?: string;
}

/** The totals row. Renders nothing at all while no column has a total to show. */
export function TableFooter<TData extends RowData>({
  table,
  totals,
  pinnedColumns = '',
}: Readonly<TableFooterProps<TData>>) {
  const {columnsVersion} = useTableCore<TData>();
  const {columnVisibility, columnOrder} = useTableUI();

  // The columns on screen, in order. `table` is a stable reference, so the state that moves
  // them is the compiler-visible signature, held in a variable as in `TableBody`.
  const columnDeps = [table, columnVisibility, columnOrder, pinnedColumns, columnsVersion];
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  const columns = useMemo(() => table.getVisibleLeafColumns(), columnDeps);

  const cells = columns.map((column) => {
    const value = totals?.[column.id];
    return {column, value: typeof value === 'number' && Number.isFinite(value) ? value : null};
  });
  if (!cells.some(({value}) => value !== null)) return null;

  return (
    <MuiTableFooter>
      <MuiTableRow>
        {cells.map(({column, value}) => {
          const columnDef = column.columnDef as DataTableColumnDef<TData>;
          return (
            <TableCell
              key={column.id}
              data-column-id={column.id}
              align={columnDef.align}
              sx={{
                color: 'text.primary',
                fontWeight: 'fontWeightMedium',
                borderTop: 1,
                borderBottom: 'none',
                borderColor: 'divider',
                ...pinnedHeaderCellSx(column.id, getPinnedInfo(pinnedColumns, column.id)),
              }}
            >
              {value === null ? null : formatTotal(columnDef.meta, value)}
            </TableCell>
          );
        })}
      </MuiTableRow>
    </MuiTableFooter>
  );
}
