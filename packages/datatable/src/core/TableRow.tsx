import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type {SxProps, Theme} from '@mui/material';
import {Checkbox, IconButton, TableRow as MuiTableRow, TableCell, alpha} from '@mui/material';
import type {Row, Table} from '@tanstack/react-table';
import type {ChangeEvent, ReactNode} from 'react';
import {useState} from 'react';

import {useTableEditingContext, useTableUI} from '../DataTableContext.hooks';
import {isRowExpanded} from '../expansion';
import {getPinnedInfo, pinnedBodyCellSx, type SxSlot} from '../hooks/useColumnPinning';
import {useLabels} from '../i18n';
import {visibleRowActions} from '../rowActions';
import {RowActionsMenu} from '../RowActionsMenu';
import type {CellOverflowMode, DataTableColumnDef, ExpandTrigger, RowAction, RowData} from '../types';
import {DENSITY_CONFIG} from '../types';
import {TableCell as DataTableCell} from './TableCell';

interface TableRowProps<TData extends RowData> {
  readonly row: Row<TData>;
  readonly table: Table<TData>;
  readonly rowActions?: readonly RowAction<TData>[];
  readonly columnStyles?: Record<string, React.CSSProperties>;
  readonly onClick?: () => void;
  readonly onDoubleClick?: () => void;
  readonly defaultOverflow?: CellOverflowMode;
  // Expansion props
  readonly enableExpanding?: boolean;
  readonly expandTrigger?: ExpandTrigger;
  readonly getRowSx?: (row: TData) => SxProps<Theme> | undefined;
  /** Frozen columns, serialized in visual order (see `useColumnPinning`). */
  readonly pinnedColumns?: string;
  /** Column-definition counter — a render input so a `columns` swap re-renders these cells. */
  readonly columnsVersion?: number;
}

export function TableRow<TData extends RowData>({
  row,
  table,
  rowActions,
  columnStyles,
  onClick,
  onDoubleClick,
  defaultOverflow = 'ellipsis',
  enableExpanding = false,
  expandTrigger = 'icon',
  getRowSx,
  pinnedColumns = '',
  columnsVersion = 0,
}: Readonly<TableRowProps<TData>>) {
  // `row.getAllCells()` is read off a stable TanStack row. Extracting ChromeCell made the
  // compiler cache the cell list against `row` alone, so a column swap or reorder left the
  // body on the previous render's cells. Opt this component out; TableHeader already
  // threads the same signatures into each HeaderCell instead.
  'use no memo';
  const labels = useLabels();
  // P0 fix (1.1): Use granular hooks instead of merged context
  const {density, expanded, rowSelection, columnVisibility, columnOrder} = useTableUI();
  const {isEditing} = useTableEditingContext<TData>();

  const densityConfig = DENSITY_CONFIG[density];
  // Serialized column order — a render input so a reorder re-renders the cells of this row.
  // `row.getAllCells()` already returns them in order; without this the compiler serves the
  // cached cell list and the body drifts out of sync with the header.
  const orderSignature = columnOrder?.join('|') ?? '';

  // Explicit visibility check using context state
  const isColumnVisible = (columnId: string): boolean => {
    if (!columnVisibility) return true;
    return columnVisibility[columnId] !== false;
  };
  const [actionsAnchor, setActionsAnchor] = useState<HTMLElement | null>(null);

  // Get selection state
  const isSelected = rowSelection ? Boolean(rowSelection[row.id]) : row.getIsSelected();
  const isRowEditing = isEditing(String(row.original.id));
  const isExpanded = isRowExpanded(row, enableExpanding, expanded);

  const handleRowClick = () => {
    if (enableExpanding && (expandTrigger === 'row' || expandTrigger === 'both')) {
      row.toggleExpanded(!isExpanded);
    }
    onClick?.();
  };

  const visibleActions = visibleRowActions(row.original, rowActions);

  return (
    <>
      <MuiTableRow
        hover
        data-column-order={orderSignature}
        data-pinned-columns={pinnedColumns}
        data-columns-version={columnsVersion}
        selected={isSelected}
        onClick={handleRowClick}
        onDoubleClick={onDoubleClick}
        sx={{
          height: densityConfig.rowHeight,
          cursor: onClick || (enableExpanding && expandTrigger !== 'icon') ? 'pointer' : 'default',
          bgcolor: isRowEditing ? 'action.selected' : undefined,
          '&.Mui-selected': {
            bgcolor: 'action.selected',
          },
          '&.Mui-selected:hover': {
            bgcolor: (theme) =>
              theme.palette.mode === 'dark'
                ? alpha(theme.palette.primary.light, 0.12)
                : alpha(theme.palette.primary.main, 0.12),
          },
          ...(getRowSx ? (getRowSx(row.original) as Record<string, unknown>) : {}),
        }}
      >
        {row
          .getAllCells()
          .filter((cell) => isColumnVisible(cell.column.id))
          .map((cell) => {
            const columnDef = cell.column.columnDef as DataTableColumnDef<TData>;
            const pinnedInfo = getPinnedInfo(pinnedColumns, cell.column.id);
            const pinnedSx = pinnedBodyCellSx(cell.column.id, pinnedInfo);

            // Expand cell
            if (cell.column.id === 'expand') {
              return (
                <ChromeCell
                  key={cell.id}
                  columnId={cell.column.id}
                  padding={densityConfig.cellPadding}
                  pinnedSx={pinnedSx}
                >
                  <IconButton
                    size="small"
                    onClick={() => row.toggleExpanded(!isExpanded)}
                    aria-label={isExpanded ? labels.collapseRow : labels.expandRow}
                    aria-expanded={isExpanded}
                    sx={{p: 0, m: '-4px'}}
                  >
                    <ChevronRightIcon
                      fontSize="small"
                      sx={{
                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.2s ease-in-out',
                      }}
                    />
                  </IconButton>
                </ChromeCell>
              );
            }

            // Selection cell
            if (cell.column.id === 'select') {
              const handleSelectionChange = (event: ChangeEvent<HTMLInputElement>) => {
                row.toggleSelected(event.target.checked);
              };
              return (
                <ChromeCell
                  key={cell.id}
                  columnId={cell.column.id}
                  padding={densityConfig.cellPadding}
                  pinnedSx={pinnedSx}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={!row.getCanSelect()}
                    onChange={handleSelectionChange}
                    size="small"
                    sx={{p: 0, m: '-4px'}}
                    slotProps={{
                      input: {
                        'aria-label': labels.selectRow(row.id),
                      },
                    }}
                  />
                </ChromeCell>
              );
            }

            // Actions cell
            if (cell.column.id === 'actions' && visibleActions && visibleActions.length > 0) {
              return (
                <TableCell
                  key={cell.id}
                  data-column-id={cell.column.id}
                  align="center"
                  onClick={(e) => e.stopPropagation()}
                  sx={{
                    width: 56,
                    minWidth: 56,
                    maxWidth: 56,
                    p: densityConfig.cellPadding,
                  }}
                >
                  <IconButton
                    size="small"
                    onClick={(e) => setActionsAnchor(e.currentTarget)}
                    aria-label={labels.actions}
                    sx={{p: 0, m: '-4px'}}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              );
            }

            // Regular cell
            return (
              <DataTableCell
                key={cell.id}
                cell={cell}
                row={row}
                table={table}
                align={columnDef.align}
                truncate={columnDef.truncate}
                maxWidth={columnDef.maxWidth}
                sticky={columnDef.sticky}
                style={columnStyles?.[cell.column.id]}
                defaultOverflow={defaultOverflow}
                isPinned={pinnedInfo.isPinned}
                pinnedSx={pinnedSx}
              />
            );
          })}
      </MuiTableRow>

      {/* Actions Menu */}
      {visibleActions && visibleActions.length > 0 && (
        <RowActionsMenu
          actions={visibleActions}
          row={row.original}
          anchorEl={actionsAnchor}
          onClose={() => setActionsAnchor(null)}
        />
      )}
    </>
  );
}

function ChromeCell({
  columnId,
  padding,
  pinnedSx,
  children,
}: {
  columnId: string;
  padding: string | number;
  pinnedSx: SxSlot;
  children: ReactNode;
}) {
  return (
    <TableCell
      /* v8 ignore start: compiler cache check. `children` is a new element on every render of the row and this cell has no state, so the operands after it are never compared */
      data-column-id={columnId}
      /* v8 ignore stop */
      onClick={(e) => e.stopPropagation()}
      sx={[
        {
          width: 48,
          minWidth: 48,
          maxWidth: 48,
          p: padding,
          textAlign: 'center',
        },
        pinnedSx,
      ]}
    >
      {/* v8 ignore start: as above */}
      {children}
      {/* v8 ignore stop */}
    </TableCell>
  );
}
