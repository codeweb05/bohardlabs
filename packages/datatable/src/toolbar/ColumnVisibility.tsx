import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import {Box, Button, Checkbox, Divider, IconButton, Popover, Tooltip, Typography} from '@mui/material';
import type {Theme} from '@mui/material/styles';
import type {Table, VisibilityState} from '@tanstack/react-table';
import {useId, useState} from 'react';

import {useTableUI} from '../DataTableContext.hooks';
import {useColumnOrdering} from '../hooks/useColumnOrdering';
import {useColumnPinning} from '../hooks/useColumnPinning';
import {useLabels} from '../i18n';
import type {DataTableColumnDef, RowData} from '../types';

interface ColumnVisibilityProps<TData extends RowData> {
  readonly table: Table<TData>;
  /** Allow drag-and-drop / keyboard reordering of the listed columns */
  readonly enableReordering?: boolean;
  /** Touch layout: HTML5 drag-and-drop and the arrow-key fallback are both unusable */
  readonly isMobile?: boolean;
  /** Allow freezing columns to the left edge */
  readonly enablePinning?: boolean;
}

// Special columns that should not be toggleable
const SPECIAL_COLUMNS = ['select', 'actions', 'expand'] as const;

export function ColumnVisibility<TData extends RowData>({
  table,
  enableReordering = false,
  enablePinning = false,
  isMobile = false,
}: Readonly<ColumnVisibilityProps<TData>>) {
  const labels = useLabels();
  const listId = useId();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);

  // Access context to ensure re-render when column visibility changes. The context value
  // also carries `columnOrder`, so a reorder invalidates it and re-renders this popover —
  // which matters because `table` is a stable reference and would not signal the change.
  const {columnVisibility} = useTableUI();

  const {draggedColumn, dragOverColumn, moveColumn, handleDragStart, handleDragOver, handleDragEnd} =
    useColumnOrdering(table);

  const {pinnedLeft, togglePin} = useColumnPinning(table);

  // Columns that can be toggled (exclude special columns and those with enableHiding: false).
  // `getAllLeafColumns()` applies `columnOrder`, so this list mirrors the header row's order.
  const toggleableColumns = table
    .getAllLeafColumns()
    .filter((col) => col.getCanHide() && !SPECIAL_COLUMNS.includes(col.id as (typeof SPECIAL_COLUMNS)[number]));

  // Use columnVisibility from context to determine visibility (ensures re-render on state change)
  const getColumnVisibility = (columnId: string): boolean => {
    // If columnVisibility state exists and has this column, use that value
    // Otherwise default to true (visible)
    if (columnVisibility && columnId in columnVisibility) {
      return columnVisibility[columnId];
    }
    return true;
  };

  const visibleCount = toggleableColumns.filter((col) => getColumnVisibility(col.id)).length;
  const totalCount = toggleableColumns.length;

  const getColumnLabel = (columnId: string): string => {
    const column = toggleableColumns.find((c) => c.id === columnId);
    if (!column) return columnId;
    const columnDef = column.columnDef as DataTableColumnDef<TData>;
    return typeof columnDef.header === 'string' ? columnDef.header : columnId;
  };

  // Toggle a single column's visibility
  const handleToggleVisibility = (columnId: string) => {
    const column = table.getColumn(columnId);
    if (column) {
      column.toggleVisibility();
    }
  };

  // Show all columns
  const handleShowAll = () => {
    // Merge with existing state to preserve non-toggleable columns
    const currentVisibility = table.getState().columnVisibility;
    const newVisibility: VisibilityState = {...currentVisibility};
    toggleableColumns.forEach((col) => {
      newVisibility[col.id] = true;
    });
    table.setColumnVisibility(newVisibility);
  };

  // Hide all columns (except one to prevent empty table)
  const handleHideAll = () => {
    // Merge with existing state to preserve non-toggleable columns
    const currentVisibility = table.getState().columnVisibility;
    const newVisibility: VisibilityState = {...currentVisibility};
    toggleableColumns.forEach((col, index) => {
      // Keep at least one column visible
      newVisibility[col.id] = index === 0;
    });
    table.setColumnVisibility(newVisibility);
  };

  // Keyboard reordering: HTML5 drag-and-drop is pointer-only, so the drag handle
  // also accepts ArrowUp/ArrowDown. React keys the row by column id, so the focused
  // handle moves with its row and keeps focus after the reorder.
  const handleReorderKeyDown = (event: React.KeyboardEvent, columnId: string, index: number) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

    const targetIndex = event.key === 'ArrowUp' ? index - 1 : index + 1;
    const target = toggleableColumns[targetIndex];
    if (!target) return;

    event.preventDefault();
    moveColumn(columnId, target.id);
  };

  // HTML5 drag-and-drop is pointer-only and the ArrowUp/ArrowDown fallback needs a
  // physical keyboard, so the handles and the hint would be inert on a touch layout.
  const canReorderColumns = enableReordering && !isMobile && totalCount > 1;

  // The mobile layout renders cards, not a scrollable row of columns, so there is
  // nothing for a frozen column to stay in front of.
  const canPinColumns = enablePinning && !isMobile;

  const getDropIndicator = (columnId: string) => {
    if (dragOverColumn !== columnId || !draggedColumn) return {};

    const fromIndex = toggleableColumns.findIndex((c) => c.id === draggedColumn);
    const toIndex = toggleableColumns.findIndex((c) => c.id === columnId);
    const edge = toIndex < fromIndex ? 'borderTop' : 'borderBottom';

    return {[edge]: (theme: Theme) => `2px solid ${theme.palette.primary.main}`};
  };

  return (
    <>
      <Tooltip title={labels.columns}>
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          size="small"
          aria-label={labels.columns}
          sx={{
            p: {xs: 0.5, sm: 1},
            color: 'text.secondary',
            '&:hover': {
              color: 'primary.main',
            },
          }}
        >
          <ViewColumnIcon sx={{fontSize: {xs: '1.25rem', sm: '1.5rem'}}} />
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
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
              width: {xs: 260, sm: 300},
              maxHeight: 400,
              // Single scroll boundary: the paper never scrolls, only the list below does.
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              mt: 0.5,
              border: (theme) => `1px solid ${theme.palette.divider}`,
              boxShadow: (theme) =>
                theme.palette.mode === 'dark' ? '0 4px 20px rgba(0, 0, 0, 0.4)' : '0 4px 20px rgba(0, 0, 0, 0.08)',
            },
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
            p: 2,
            pb: 1,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
            }}
          >
            {labels.columns} ({visibleCount}/{totalCount})
          </Typography>
          <Box sx={{display: 'flex', gap: 0.5}}>
            <Button
              size="small"
              onClick={handleShowAll}
              disabled={visibleCount === totalCount}
              sx={{fontSize: '0.75rem', minWidth: 'auto', px: 1}}
            >
              {labels.showAll}
            </Button>
            <Button
              size="small"
              onClick={handleHideAll}
              disabled={visibleCount <= 1}
              sx={{fontSize: '0.75rem', minWidth: 'auto', px: 1}}
            >
              {labels.hideAll}
            </Button>
          </Box>
        </Box>

        {canReorderColumns && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              display: 'block',
              flexShrink: 0,
              px: 2,
              pb: 1,
            }}
          >
            {labels.reorderHint}
          </Typography>
        )}

        <Divider sx={{flexShrink: 0}} />

        {/* Column list */}
        <Box
          role="list"
          aria-label={labels.columns}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            p: 1,
            overflowY: 'auto',
          }}
        >
          {toggleableColumns.map((column, index) => {
            const label = getColumnLabel(column.id);
            const isVisible = getColumnVisibility(column.id);
            const isDragged = draggedColumn === column.id;
            const isPinned = pinnedLeft.includes(column.id);
            // The name is a real <label> for the checkbox, so clicking it toggles the
            // column instead of leaving an orphan label in the accessibility tree.
            const checkboxId = `${listId}-${column.id}`;
            const isLastVisible = visibleCount === 1 && isVisible;

            return (
              <Box
                key={column.id}
                role="listitem"
                draggable={canReorderColumns}
                onDragStart={(e) => {
                  // Firefox requires dataTransfer payload for a drag to start at all
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', column.id);
                  handleDragStart(column.id);
                }}
                onDragOver={(e) => {
                  if (!draggedColumn) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  handleDragOver(column.id);
                }}
                onDrop={(e) => e.preventDefault()}
                onDragEnd={(e) => handleDragEnd(e.dataTransfer.dropEffect)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  py: 0.25,
                  pr: 1,
                  pl: canReorderColumns ? 0 : 1,
                  borderRadius: 0.5,
                  opacity: isDragged ? 0.4 : 1,
                  transition: 'background-color 0.15s ease, opacity 0.15s ease',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                  ...getDropIndicator(column.id),
                }}
              >
                {canReorderColumns && (
                  <IconButton
                    size="small"
                    disableRipple
                    aria-label={labels.reorderColumn(label, index + 1, totalCount)}
                    onKeyDown={(e) => handleReorderKeyDown(e, column.id, index)}
                    sx={{
                      cursor: 'grab',
                      color: 'text.disabled',
                      '&:active': {cursor: 'grabbing'},
                      '&:hover': {color: 'text.secondary'},
                    }}
                  >
                    <DragIndicatorIcon sx={{fontSize: '1.125rem'}} />
                  </IconButton>
                )}
                <Checkbox
                  size="small"
                  checked={isVisible}
                  onChange={() => handleToggleVisibility(column.id)}
                  slotProps={{input: {id: checkboxId, 'aria-label': label}}}
                  // Prevent hiding the last visible column
                  disabled={visibleCount === 1 && isVisible}
                />
                <Typography
                  variant="body2"
                  component="label"
                  htmlFor={checkboxId}
                  sx={{
                    fontSize: '0.8125rem',
                    flex: 1,
                    cursor: isLastVisible ? 'default' : 'pointer',
                    userSelect: 'none',
                  }}
                >
                  {label}
                </Typography>
                {canPinColumns && (
                  <Tooltip title={isPinned ? labels.unpinColumn : labels.pinColumn}>
                    {/* A hidden column has no cell to freeze, so pinning it would be a no-op */}
                    <Box component="span">
                      <IconButton
                        size="small"
                        disabled={!isVisible}
                        onClick={() => togglePin(column.id)}
                        aria-label={isPinned ? labels.unpinColumnLabel(label) : labels.pinColumnLabel(label)}
                        aria-pressed={isPinned}
                        sx={{
                          color: isPinned ? 'primary.main' : 'text.disabled',
                          '&:hover': {color: isPinned ? 'primary.dark' : 'text.secondary'},
                        }}
                      >
                        {isPinned ? (
                          <PushPinIcon sx={{fontSize: '1rem'}} />
                        ) : (
                          <PushPinOutlinedIcon sx={{fontSize: '1rem'}} />
                        )}
                      </IconButton>
                    </Box>
                  </Tooltip>
                )}
              </Box>
            );
          })}
        </Box>
      </Popover>
    </>
  );
}
