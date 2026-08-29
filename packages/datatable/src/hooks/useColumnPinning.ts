import type {SxProps, Theme} from '@mui/material';
import {alpha} from '@mui/material';
import type {ColumnPinningState, Table} from '@tanstack/react-table';
import {useEffect} from 'react';

import {useTableUI} from '../DataTableContext.hooks';
import type {RowData} from '../types';

/**
 * Columns that always lead the row. They are not user-pinnable, but they join the
 * frozen block whenever anything is pinned, so a pinned column never floats over
 * the row checkbox or the expand toggle.
 */
export const LEADING_COLUMN_IDS: readonly string[] = ['select', 'expand'];

/** Columns that always close the row. Not user-reorderable and never pinnable. */
export const TRAILING_COLUMN_IDS: readonly string[] = ['actions'];

/** Separator for the serialized pinned-column list passed down the render tree. */
export const PINNED_SEPARATOR = '|';

const EMPTY_PINNED: readonly string[] = [];

function isLeading(columnId: string): boolean {
  return LEADING_COLUMN_IDS.includes(columnId);
}

function isTrailing(columnId: string): boolean {
  return TRAILING_COLUMN_IDS.includes(columnId);
}

/**
 * Normalizes a column order into four blocks: leading, pinned, everything else,
 * trailing. Relative order inside each block is preserved, so dragging pinned columns
 * among themselves still works and a newly pinned column keeps its natural position.
 *
 * The leading and trailing blocks are enforced whether or not anything is pinned. A
 * drag can otherwise slide a regular column past the selection checkbox, which has to
 * stay at the left edge for the row to read as selectable at all.
 */
export function orderWithPinned(ids: readonly string[], pinnedLeft: readonly string[]): string[] {
  const isMiddle = (id: string) => !isLeading(id) && !isTrailing(id);

  const leading = ids.filter(isLeading);
  const pinned = ids.filter((id) => isMiddle(id) && pinnedLeft.includes(id));
  const rest = ids.filter((id) => isMiddle(id) && !pinnedLeft.includes(id));
  const trailing = ids.filter(isTrailing);

  return [...leading, ...pinned, ...rest, ...trailing];
}

/**
 * The order the table should render: the stored arrangement, reconciled against the
 * columns that actually exist, then normalized by `orderWithPinned`.
 *
 * Stored ids the table no longer has are dropped, and columns the stored order predates
 * are folded back in — appended for regular columns, hoisted to the front for the
 * selection and expand columns. Without the reconciliation a stored order written before
 * a column existed leaves that column stranded at the end of the row.
 */
export function resolveColumnOrder(
  storedOrder: readonly string[],
  allIds: readonly string[],
  pinnedLeft: readonly string[],
): string[] {
  if (storedOrder.length === 0) return orderWithPinned(allIds, pinnedLeft);

  const available = new Set(allIds);
  const kept = storedOrder.filter((id) => available.has(id));
  const keptIds = new Set(kept);
  const added = allIds.filter((id) => !keptIds.has(id));

  return orderWithPinned([...kept, ...added], pinnedLeft);
}

/**
 * The columns that render frozen, in visual order: the leading columns plus the
 * pinned ones, minus anything currently hidden.
 */
export function resolveStickyColumnIds<TData extends RowData>(
  table: Table<TData>,
  pinnedLeft: readonly string[],
  columnVisibility: Record<string, boolean> | undefined,
): string[] {
  return table
    .getAllLeafColumns()
    .map((col) => col.id)
    .filter((id) => (isLeading(id) || pinnedLeft.includes(id)) && columnVisibility?.[id] !== false);
}

/**
 * The pinned block as TanStack has to see it.
 *
 * The selection checkbox and the expand toggle are always frozen: they belong at the
 * left edge whether or not the user pinned anything, and a row whose checkbox scrolls
 * out of view stops reading as selectable.
 *
 * The array is rebuilt from `orderedIds` rather than kept in the order the pins were
 * added. `getHeaderGroups()` paints `columnPinning.left` in that array's own order,
 * ahead of anything `columnOrder` says, while the body follows `columnOrder` alone, so
 * the header and the rows line up only while this array is a slice of the rendered
 * order. That also keeps the leading columns at the front, where the checkbox has to
 * stay for the row to read as selectable.
 *
 * Returns the input object untouched when nothing changes, so it stays a stable
 * `useReactTable` input.
 *
 * @param orderedIds - every column id, in the order the table renders them.
 */
export function resolveColumnPinning(pinning: ColumnPinningState, orderedIds: readonly string[]): ColumnPinningState {
  const current = pinning.left ?? EMPTY_PINNED;
  const userPinned = new Set(current.filter((id) => !isLeading(id)));
  const left = orderedIds.filter((id) => isLeading(id) || userPinned.has(id));

  if (left.length === current.length && left.every((id, index) => id === current[index])) return pinning;
  return {...pinning, left};
}

/** Pin state plus the toggle, for the Columns popover. */
export function useColumnPinning<TData extends RowData>(table: Table<TData>) {
  // Read through context, not `table.getState()`: `table` is a stable reference and
  // would not signal a pin change to the React Compiler.
  const {columnPinning} = useTableUI();
  const pinnedLeft = columnPinning?.left ?? EMPTY_PINNED;

  const togglePin = (columnId: string) => {
    // `getAllLeafColumns()` applies `columnOrder`, so this is the rendered order.
    const orderedIds = table.getAllLeafColumns().map((col) => col.id);
    const current = (table.getState().columnPinning.left ?? []).filter((id) => !isLeading(id));
    const nextUserPinned = current.includes(columnId)
      ? current.filter((id) => id !== columnId)
      : [...current, columnId];
    // Pinned columns have to sit at the front of the row for a left offset to mean
    // anything, so the pin also rewrites the column order. The pinned block is then read
    // back off that order, which is the only arrangement the header and body agree on.
    const nextOrder = orderWithPinned(orderedIds, nextUserPinned);
    const nextPinning = resolveColumnPinning({...table.getState().columnPinning, left: nextUserPinned}, nextOrder);

    table.setColumnPinning(nextPinning);
    table.setColumnOrder(nextOrder);
  };

  return {pinnedLeft, togglePin};
}

// ============================================================================
// RENDERING
// ============================================================================

/** CSS custom property holding a pinned column's measured left offset. */
export function pinnedLeftVar(columnId: string): string {
  return `--dt-pin-${columnId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

/**
 * Writes each frozen column's left offset onto the table element as a CSS custom
 * property, which the sticky cells then read.
 *
 * The offsets have to be measured: the table renders with `table-layout: auto`
 * unless resizing is enabled, so `column.getSize()` is the requested width, not the
 * painted one. The effect deliberately has no dependency array — it re-measures after
 * every render (density, page size, data and visibility all change painted widths)
 * and on resize. It writes to the DOM rather than to state, so it cannot loop.
 */
export function useStickyColumnOffsets(
  tableRef: React.RefObject<HTMLTableElement | null>,
  pinnedColumns: string,
): void {
  useEffect(() => {
    const tableEl = tableRef.current;
    if (!tableEl || pinnedColumns.length === 0) return;

    const sticky = new Set(pinnedColumns.split(PINNED_SEPARATOR));

    const measure = () => {
      const cells = Array.from(
        tableEl.querySelectorAll<HTMLTableCellElement>('thead tr:first-of-type > th[data-column-id]'),
      );

      let offset = 0;
      let remaining = sticky.size;

      for (const cell of cells) {
        const id = cell.dataset.columnId;
        if (id && sticky.has(id)) {
          tableEl.style.setProperty(pinnedLeftVar(id), `${offset}px`);
          remaining -= 1;
        }
        offset += cell.offsetWidth;
        if (remaining === 0) break;
      }
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(tableEl);
    return () => observer.disconnect();
  });
}

/**
 * One entry of an `sx={[...]}` array. MUI's array form rejects a nested array and
 * `SxProps` includes one, so the style helpers below return only its plain-object
 * member.
 */
export type SxSlot = Exclude<SxProps<Theme>, readonly unknown[] | ((theme: Theme) => unknown)>;

/** "Not pinned": contributes nothing when merged into a cell's `sx` array. */
export const EMPTY_SX: SxSlot = {};

export interface PinnedColumnInfo {
  readonly isPinned: boolean;
  /** The right-most frozen column, which carries the boundary divider. */
  readonly isLastPinned: boolean;
}

const NOT_PINNED: PinnedColumnInfo = {isPinned: false, isLastPinned: false};

/**
 * Reads a column's pin state out of the serialized list. The list travels as a string
 * rather than an array so it compares by value, which is what makes the React Compiler
 * re-render the header and the rows when the pinned set changes.
 */
export function getPinnedInfo(pinnedColumns: string | undefined, columnId: string): PinnedColumnInfo {
  if (!pinnedColumns) return NOT_PINNED;

  const ids = pinnedColumns.split(PINNED_SEPARATOR);
  const index = ids.indexOf(columnId);
  if (index === -1) return NOT_PINNED;

  // The leading columns are frozen on every table, so on their own they get no divider.
  // The divider marks the edge of what the user chose to freeze.
  const hasUserPinned = ids.some((id) => !isLeading(id));
  return {isPinned: true, isLastPinned: hasUserPinned && index === ids.length - 1};
}

function pinnedBaseSx(columnId: string, info: PinnedColumnInfo, zIndex: number): SxSlot {
  return {
    position: 'sticky',
    left: `var(${pinnedLeftVar(columnId)}, 0px)`,
    zIndex,
    backgroundColor: 'background.paper',
    ...(info.isLastPinned && {
      borderRight: (theme: Theme) => `1px solid ${theme.palette.divider}`,
    }),
  };
}

/** Sticky styles for a frozen header cell. Sits above the sticky header row. */
export function pinnedHeaderCellSx(columnId: string, info: PinnedColumnInfo): SxSlot {
  if (!info.isPinned) return EMPTY_SX;
  return pinnedBaseSx(columnId, info, 11);
}

/**
 * Sticky styles for a frozen body cell.
 *
 * The cell has to be opaque to cover the columns scrolling under it, which would
 * otherwise swallow the row's hover and selected tints. They come back as an overlay,
 * so a frozen cell is tinted exactly once, like every other cell in the row.
 */
export function pinnedBodyCellSx(columnId: string, info: PinnedColumnInfo): SxSlot {
  if (!info.isPinned) return EMPTY_SX;

  return {
    ...pinnedBaseSx(columnId, info, 2),
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
    },
    '.MuiTableRow-root:hover > &::before': {
      backgroundColor: 'action.hover',
    },
    '.MuiTableRow-root.Mui-selected > &::before': {
      backgroundColor: 'action.selected',
    },
    '.MuiTableRow-root.Mui-selected:hover > &::before': {
      backgroundColor: (theme: Theme) =>
        theme.palette.mode === 'dark'
          ? alpha(theme.palette.primary.light, 0.12)
          : alpha(theme.palette.primary.main, 0.12),
    },
  };
}
