import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import {
  Box,
  Button,
  Checkbox,
  Divider,
  IconButton,
  InputAdornment,
  Popover,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type {Theme} from '@mui/material/styles';
import type {Column, Table, VisibilityState} from '@tanstack/react-table';
import {useId, useState} from 'react';

import {BOTTOM_RIGHT_ORIGIN} from '../AnchoredMenu';
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
  /** Puts the column layout back to the table's defaults. The menu offers "Reset columns" when given. */
  readonly onReset?: () => void;
}

// Special columns that should not be toggleable
const SPECIAL_COLUMNS = ['select', 'actions', 'expand'] as const;

export function ColumnVisibility<TData extends RowData>({
  table,
  enableReordering = false,
  enablePinning = false,
  isMobile = false,
  onReset,
}: Readonly<ColumnVisibilityProps<TData>>) {
  const labels = useLabels();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

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

      {/* A closed popover mounts no children, so the list below is built only while it is open. */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        {...BOTTOM_RIGHT_ORIGIN}
        slotProps={{
          paper: {
            sx: {
              width: {xs: 260, sm: 300},
              maxHeight: 400,
              // Single scroll boundary: the paper never scrolls, only the lists below do.
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              mt: 0.5,
              border: (theme) => `1px solid ${theme.palette.divider}`,
            },
          },
        }}
      >
        <ColumnsPanel
          table={table}
          enableReordering={enableReordering}
          enablePinning={enablePinning}
          isMobile={isMobile}
          onReset={onReset}
        />
      </Popover>
    </>
  );
}

interface ColumnBucket<TData extends RowData> {
  /** `undefined` for the columns with no `meta.group`, listed first and with no heading */
  readonly group: string | undefined;
  readonly columns: Column<TData>[];
}

/**
 * The column's `meta.group`. `meta` is TanStack's, typed by whatever the consumer declared
 * for it, so it is read as unknown rather than trusted to hold a group.
 */
function columnGroup<TData extends RowData>(column: Column<TData>): string | undefined {
  const meta: unknown = column.columnDef.meta;
  if (typeof meta === 'object' && meta !== null && 'group' in meta && typeof meta.group === 'string') {
    // An empty name would be a heading with nothing in it, so it counts as no group.
    return meta.group || undefined;
  }
  return undefined;
}

/** The columns bucketed by group, in the order each group first appears; empty buckets dropped. */
function bucketByGroup<TData extends RowData>(columns: Column<TData>[]): ColumnBucket<TData>[] {
  const buckets: ColumnBucket<TData>[] = [{group: undefined, columns: []}];
  for (const column of columns) {
    const group = columnGroup(column);
    let bucket = buckets.find((b) => b.group === group);
    if (!bucket) {
      bucket = {group, columns: []};
      buckets.push(bucket);
    }
    bucket.columns.push(column);
  }
  return buckets.filter((b) => b.columns.length > 0);
}

function columnLabel<TData extends RowData>(column: Column<TData>): string {
  const header = (column.columnDef as DataTableColumnDef<TData>).header;
  return typeof header === 'string' ? header : column.id;
}

type ColumnsPanelProps<TData extends RowData> = Required<Omit<ColumnVisibilityProps<TData>, 'onReset'>> &
  Pick<ColumnVisibilityProps<TData>, 'onReset'>;

/** The popover's content. Its search text lives here, so it starts empty on every open. */
function ColumnsPanel<TData extends RowData>({
  table,
  enableReordering,
  enablePinning,
  isMobile,
  onReset,
}: Readonly<ColumnsPanelProps<TData>>) {
  // The list is read off `table`, which is a stable reference. Compiled, the order would be
  // cached against it and an arrow-key move would never reach the open list (a drag got
  // through only because the drag state changes too). The panel renders only while the
  // menu is open, so rendering it in full each time costs nothing worth caching.
  'use no memo';

  const labels = useLabels();
  const listId = useId();
  const [query, setQuery] = useState('');

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

  // The search matches what the row shows and the id, which is what a developer or a
  // support note calls the column. Show All and Hide All still act on every column.
  const needle = query.trim().toLowerCase();
  const matches = (column: Column<TData>) =>
    needle === '' || columnLabel(column).toLowerCase().includes(needle) || column.id.toLowerCase().includes(needle);
  const buckets = bucketByGroup(toggleableColumns.filter(matches));
  const groupById = new Map(toggleableColumns.map((column) => [column.id, columnGroup(column)]));

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
  // handle moves with its row and keeps focus after the reorder. The neighbour is the
  // one on screen, inside the same group: a move never leaves its group.
  const handleReorderKeyDown = (
    event: React.KeyboardEvent,
    columnId: string,
    shown: Column<TData>[],
    index: number,
  ) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

    const targetIndex = event.key === 'ArrowUp' ? index - 1 : index + 1;
    const target = shown[targetIndex];
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

  const renderRow = (column: Column<TData>, bucket: ColumnBucket<TData>, index: number) => {
    const label = columnLabel(column);
    const isVisible = getColumnVisibility(column.id);
    const isDragged = draggedColumn === column.id;
    const isPinned = pinnedLeft.includes(column.id);
    // The name is a real <label> for the checkbox, so clicking it toggles the
    // column instead of leaving an orphan label in the accessibility tree.
    const checkboxId = `${listId}-${column.id}`;
    const isLastVisible = visibleCount === 1 && isVisible;
    // Positions count the whole list, not what the search left on screen, so "3 of 12"
    // means the same column whatever is typed above it.
    const position = toggleableColumns.indexOf(column) + 1;

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
          // A drag stays inside its group. Over another group's row the drop is refused,
          // and the pending target is cleared so the indicator does not stay on the last
          // row that would have taken it.
          if (groupById.get(draggedColumn) !== bucket.group) {
            handleDragOver(draggedColumn);
            return;
          }
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
            aria-label={labels.reorderColumn(label, position, totalCount)}
            onKeyDown={(e) => handleReorderKeyDown(e, column.id, bucket.columns, index)}
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
          onChange={() => column.toggleVisibility()}
          slotProps={{input: {id: checkboxId, 'aria-label': label}}}
          // Prevent hiding the last visible column
          disabled={isLastVisible}
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
                {isPinned ? <PushPinIcon sx={{fontSize: '1rem'}} /> : <PushPinOutlinedIcon sx={{fontSize: '1rem'}} />}
              </IconButton>
            </Box>
          </Tooltip>
        )}
      </Box>
    );
  };

  return (
    <>
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

      <Box sx={{flexShrink: 0, px: 2, pb: 1}}>
        <TextField
          size="small"
          fullWidth
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.searchColumns}
          slotProps={{
            htmlInput: {'aria-label': labels.searchColumns},
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      <Divider sx={{flexShrink: 0}} />

      {/* Column lists: one for the ungrouped columns, then one under each group's heading */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          p: 1,
          overflowY: 'auto',
        }}
      >
        {buckets.map((bucket) => (
          <Box key={bucket.group ?? ''} sx={{display: 'flex', flexDirection: 'column'}}>
            {bucket.group !== undefined && (
              <Typography
                variant="caption"
                sx={{color: 'text.secondary', display: 'block', fontWeight: 600, px: 1, pt: 1}}
              >
                {bucket.group}
              </Typography>
            )}
            <Box
              role="list"
              aria-label={bucket.group ?? labels.columns}
              sx={{display: 'flex', flexDirection: 'column'}}
            >
              {bucket.columns.map((column, index) => renderRow(column, bucket, index))}
            </Box>
          </Box>
        ))}
      </Box>

      <Divider sx={{flexShrink: 0}} />

      {/* Footer */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          px: 2,
          py: 1,
        }}
      >
        <Typography variant="caption" sx={{color: 'text.secondary'}}>
          {labels.hiddenCount(totalCount - visibleCount)}
        </Typography>
        {onReset && (
          <Button size="small" onClick={onReset} sx={{fontSize: '0.75rem', minWidth: 'auto', px: 1}}>
            {labels.resetColumns}
          </Button>
        )}
      </Box>
    </>
  );
}
