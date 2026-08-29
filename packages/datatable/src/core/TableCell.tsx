import type {SxProps, Theme} from '@mui/material';
import {Box, TableCell as MuiTableCell, Tooltip} from '@mui/material';
import type {Cell, Row, Table} from '@tanstack/react-table';
import {useEffect, useRef, useState} from 'react';

import {useTableEditingContext, useTableUI} from '../DataTableContext.hooks';
import {EditableCell} from '../editing/EditableCell';
import type {SxSlot} from '../hooks/useColumnPinning';
import {EMPTY_SX} from '../hooks/useColumnPinning';
import type {CellOverflowMode, DataTableColumnDef, RowData} from '../types';
import {DENSITY_CONFIG} from '../types';

/**
 * @returns Sx style object for the cell wrapper based on overflow mode.
 */
function computeOverflowStyles(
  truncate: boolean,
  overflowMode: CellOverflowMode,
  maxWidth: number | string | undefined = '100%',
): SxProps<Theme> {
  const isEllipsis = truncate || overflowMode === 'ellipsis';
  const isWrap = !isEllipsis && overflowMode === 'wrap';
  const isTruncate = !isEllipsis && overflowMode === 'truncate';

  return {
    ...(isEllipsis && {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      maxWidth,
    }),
    ...(isWrap && {
      wordBreak: 'break-word',
      overflowWrap: 'break-word',
      whiteSpace: 'normal',
    }),
    ...(isTruncate && {
      overflow: 'hidden',
      maxWidth: maxWidth,
    }),
  };
}

interface TableCellProps<TData extends RowData> {
  readonly cell: Cell<TData, unknown>;
  readonly row: Row<TData>;
  readonly table: Table<TData>;
  readonly align?: 'left' | 'center' | 'right';
  readonly truncate?: boolean;
  readonly maxWidth?: number;
  readonly sticky?: 'left' | 'right';
  readonly style?: React.CSSProperties;
  readonly defaultOverflow?: CellOverflowMode;
  /** True when this column is frozen at runtime (see `useColumnPinning`). */
  readonly isPinned?: boolean;
  /** Sticky styles when this column is frozen at runtime. Empty when it is not. */
  readonly pinnedSx?: SxSlot;
}

export function TableCell<TData extends RowData>({
  cell,
  row,
  table,
  align = 'left',
  truncate = false,
  maxWidth,
  sticky,
  style,
  defaultOverflow = 'ellipsis',
  isPinned = false,
  pinnedSx = EMPTY_SX,
}: Readonly<TableCellProps<TData>>) {
  const {density} = useTableUI();
  const {isEditing} = useTableEditingContext<TData>();
  const isRowEditing = isEditing(String(row.original.id));
  const columnDef = cell.column.columnDef as DataTableColumnDef<TData>;
  const densityConfig = DENSITY_CONFIG[density];

  // Determine overflow mode: column-level > global default
  const overflowMode = columnDef.overflow ?? defaultOverflow;

  const cellRef = useRef<HTMLTableCellElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const cellValue = cell.getValue();

  // Check if text is truncated (for ellipsis and truncate modes)
  useEffect(() => {
    if ((truncate || overflowMode === 'ellipsis' || overflowMode === 'truncate') && cellRef.current) {
      const element = cellRef.current.querySelector('.cell-content');
      if (element) {
        setIsTruncated(element.scrollWidth > element.clientWidth);
      }
    }
  }, [truncate, overflowMode, cellValue]);

  // `EditableCell` owns the whole editing path: the built-in text/number/select fields,
  // `editConfig.disabled`, `editConfig.validate`, and a custom `renderEdit` wired to the
  // real save/cancel. It falls through to the normal cell when the row is not editing.
  const content: React.ReactNode = <EditableCell cell={cell} row={row} column={cell.column} table={table} />;

  const overflowStyles: SxProps<Theme> = computeOverflowStyles(truncate, overflowMode, maxWidth);

  // Get tooltip text for truncated content
  const getTooltipText = () => {
    if (!isTruncated) return '';
    const value = cell.getValue();
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
    return '';
  };

  // Wrap in tooltip if truncated (for ellipsis and truncate modes)
  // No tooltip over an open editor: the field overflows its cell by design.
  const shouldShowTooltip =
    (truncate || overflowMode === 'ellipsis' || overflowMode === 'truncate') && isTruncated && !isRowEditing;

  const wrappedContent = shouldShowTooltip ? (
    <Tooltip title={getTooltipText()} placement="top" arrow disableHoverListener={!isTruncated}>
      <Box className="cell-content" sx={overflowStyles}>
        {content}
      </Box>
    </Tooltip>
  ) : (
    <Box className="cell-content" sx={overflowStyles}>
      {content}
    </Box>
  );

  // Use style prop for width if provided (for live resize updates), otherwise fallback to cell.column.getSize()
  const cellWidth = style?.width ?? cell.column.getSize();

  return (
    <MuiTableCell
      ref={cellRef}
      align={align}
      data-column-id={cell.column.id}
      sx={[
        {
          width: cellWidth,
          minWidth: style?.minWidth ?? columnDef.minSize,
          maxWidth: style?.maxWidth ?? columnDef.maxSize ?? maxWidth,
          p: isRowEditing && columnDef.enableEditing ? 0.5 : densityConfig.cellPadding,
          fontSize: densityConfig.fontSize,
          // Static per-column pinning. Runtime pinning comes in through `pinnedSx`,
          // which is appended after this object and therefore wins.
          ...(sticky &&
            !isPinned && {
              position: 'sticky',
              [sticky]: 0,
              zIndex: 1,
              bgcolor: 'background.paper',
            }),
        },
        pinnedSx,
      ]}
    >
      {wrappedContent}
    </MuiTableCell>
  );
}
