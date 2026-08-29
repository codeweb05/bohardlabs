import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type {SxProps, Theme} from '@mui/material';
import {
  Box,
  Checkbox,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TableRow as MuiTableRow,
  TableCell,
  alpha,
} from '@mui/material';
import type {Row, Table} from '@tanstack/react-table';
import type {ChangeEvent} from 'react';
import {useState} from 'react';

import {useTableEditingContext, useTableUI} from '../DataTableContext.hooks';
import {getPinnedInfo, pinnedBodyCellSx} from '../hooks/useColumnPinning';
import {useLabels} from '../i18n';
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
  // Get expanded state
  const rowId = String(row.original.id);
  const getExpandedState = (): boolean => {
    if (!enableExpanding) return false;
    if (!expanded) return row.getIsExpanded();
    if (typeof expanded === 'boolean') return expanded;
    return Boolean(expanded[rowId]);
  };
  const isExpanded = getExpandedState();

  // Handle row click
  const handleRowClick = () => {
    if (enableExpanding && (expandTrigger === 'row' || expandTrigger === 'both')) {
      row.toggleExpanded(!isExpanded);
    }
    onClick?.();
  };

  // Filter visible actions
  const visibleActions = rowActions?.filter((action) => {
    if (typeof action.hidden === 'function') {
      return !action.hidden(row.original);
    }
    return !action.hidden;
  });

  const handleActionClick = (action: RowAction<TData>) => {
    setActionsAnchor(null);
    // Fire and forget, on purpose: the menu closes immediately and an async handler owns
    // its own progress and error reporting. Awaiting here would freeze the menu open with
    // no indication of why, and the contract in `RowAction.onClick` says so.
    void action.onClick(row.original);
  };

  const isActionDisabled = (action: RowAction<TData>) => {
    if (typeof action.disabled === 'function') {
      return action.disabled(row.original);
    }
    return action.disabled ?? false;
  };

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
                <TableCell
                  key={cell.id}
                  data-column-id={cell.column.id}
                  onClick={(e) => e.stopPropagation()}
                  sx={[
                    {
                      width: 48,
                      minWidth: 48,
                      maxWidth: 48,
                      p: densityConfig.cellPadding,
                      textAlign: 'center',
                    },
                    pinnedSx,
                  ]}
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
                </TableCell>
              );
            }

            // Selection cell
            if (cell.column.id === 'select') {
              const handleSelectionChange = (event: ChangeEvent<HTMLInputElement>) => {
                row.toggleSelected(event.target.checked);
              };
              return (
                <TableCell
                  key={cell.id}
                  data-column-id={cell.column.id}
                  onClick={(e) => e.stopPropagation()}
                  sx={[
                    {
                      width: 48,
                      minWidth: 48,
                      maxWidth: 48,
                      p: densityConfig.cellPadding,
                      textAlign: 'center',
                    },
                    pinnedSx,
                  ]}
                >
                  <Checkbox
                    checked={row.getIsSelected()}
                    disabled={!row.getCanSelect()}
                    onChange={handleSelectionChange}
                    size="small"
                    sx={{p: 0, m: '-4px'}}
                    slotProps={{
                      input: {
                        'aria-label': `Select row ${row.id}`,
                      },
                    }}
                  />
                </TableCell>
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
        <Menu
          anchorEl={actionsAnchor}
          open={Boolean(actionsAnchor)}
          onClose={() => setActionsAnchor(null)}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          slotProps={{
            paper: {
              sx: {
                minWidth: 160,
                maxWidth: 280,
              },
            },
          }}
        >
          {visibleActions.map((action, index) => (
            <Box key={action.id}>
              {action.divider && index > 0 && <Divider sx={{my: 0.5}} />}
              <MenuItem
                onClick={() => handleActionClick(action)}
                disabled={isActionDisabled(action)}
                sx={{
                  color: action.color ? `${action.color}.main` : undefined,
                }}
              >
                {action.icon && (
                  <ListItemIcon
                    sx={{
                      color: action.color ? `${action.color}.main` : undefined,
                      minWidth: 36,
                    }}
                  >
                    {action.icon}
                  </ListItemIcon>
                )}
                <ListItemText>{action.label}</ListItemText>
              </MenuItem>
            </Box>
          ))}
        </Menu>
      )}
    </>
  );
}
