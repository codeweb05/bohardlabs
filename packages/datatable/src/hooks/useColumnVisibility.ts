import type {Table, VisibilityState} from '@tanstack/react-table';
import {useCallback, useMemo} from 'react';

import type {DataTableColumnDef, RowData} from '../types';

/**
 * Column information for visibility management
 */
export interface ColumnVisibilityInfo {
  /** Column ID */
  readonly id: string;
  /** Display label for the column */
  readonly label: string;
  /** Whether the column is currently visible */
  readonly isVisible: boolean;
  /** Whether the column can be toggled (not disabled) */
  readonly canToggle: boolean;
}

/**
 * Return type for useColumnVisibility hook
 */
export interface UseColumnVisibilityReturn {
  /** List of columns that can be toggled for visibility */
  readonly columns: readonly ColumnVisibilityInfo[];
  /** Number of currently visible columns */
  readonly visibleCount: number;
  /** Total number of toggleable columns */
  readonly totalCount: number;
  /** Toggle visibility for a specific column */
  readonly toggleColumn: (columnId: string) => void;
  /** Show all columns */
  readonly showAll: () => void;
  /** Hide a specific column */
  readonly hideColumn: (columnId: string) => void;
  /** Show a specific column */
  readonly showColumn: (columnId: string) => void;
  /** Check if all columns are currently visible */
  readonly allVisible: boolean;
}

/**
 * System columns that should not appear in visibility menu
 */
const SYSTEM_COLUMN_IDS = ['select', 'actions', 'expand'] as const;

/**
 * Hook for managing column visibility in DataTable
 *
 * This hook provides a controlled interface for column visibility management.
 * It uses React state rather than relying on TanStack Table's internal state,
 * ensuring proper re-renders when visibility changes.
 *
 * @param table - TanStack Table instance
 * @param columnVisibility - Current visibility state (React state)
 * @param onColumnVisibilityChange - Callback to update visibility state
 */
export function useColumnVisibility<TData extends RowData>(
  table: Table<TData>,
  columnVisibility: VisibilityState,
  onColumnVisibilityChange: (visibility: VisibilityState) => void,
): UseColumnVisibilityReturn {
  // `useReactTable` returns the same table object on every render, so the compiler would
  // cache `getAllLeafColumns()` against it and freeze this menu at the columns present on
  // first render — wrong for any table whose columns depend on data or permissions. The
  // work here is a map over a handful of columns, so recomputing it costs nothing.
  'use no memo';

  // The leaf array changes identity when a column is added or dropped, which is what
  // invalidates the memo below.
  const leafColumns = table.getAllLeafColumns();

  /**
   * Get all toggleable columns (excluding system columns)
   */
  const toggleableColumnDefs = useMemo(() => {
    return leafColumns
      .filter((col) => !SYSTEM_COLUMN_IDS.includes(col.id as (typeof SYSTEM_COLUMN_IDS)[number]))
      .map((col) => ({
        id: col.id,
        columnDef: col.columnDef as DataTableColumnDef<TData>,
      }));
  }, [leafColumns]);

  /**
   * Build column info list with current visibility state
   * This depends on columnVisibility state and will re-compute when it changes
   */
  const columns = useMemo<ColumnVisibilityInfo[]>(() => {
    return toggleableColumnDefs.map(({id, columnDef}) => {
      // Column is visible if not explicitly set to false in visibility state
      const isVisible = columnVisibility[id] !== false;

      // Extract label from column definition
      const label = typeof columnDef.header === 'string' ? columnDef.header : id;

      return {
        id,
        label,
        isVisible,
        canToggle: true, // Will be updated below based on visibility count
      };
    });
  }, [toggleableColumnDefs, columnVisibility]);

  /**
   * Count visible columns
   */
  const visibleCount = useMemo(() => columns.filter((col) => col.isVisible).length, [columns]);

  const totalCount = columns.length;
  const allVisible = visibleCount === totalCount;

  /**
   * Update columns with canToggle flag based on visibility count
   * A column cannot be hidden if it's the last visible column
   */
  const columnsWithToggleState = useMemo<ColumnVisibilityInfo[]>(() => {
    return columns.map((col) => ({
      ...col,
      // Can't hide the last visible column
      canToggle: !(col.isVisible && visibleCount === 1),
    }));
  }, [columns, visibleCount]);

  /**
   * Toggle a column's visibility
   */
  const toggleColumn = useCallback(
    (columnId: string) => {
      const column = columns.find((col) => col.id === columnId);
      if (!column) return;

      // Don't allow hiding the last visible column
      if (column.isVisible && visibleCount === 1) return;

      // Create new visibility state with the toggled value
      // TanStack Table uses: true = visible, false = hidden
      onColumnVisibilityChange({
        ...columnVisibility,
        [columnId]: !column.isVisible,
      });
    },
    [columns, columnVisibility, visibleCount, onColumnVisibilityChange],
  );

  /**
   * Show a specific column
   */
  const showColumn = useCallback(
    (columnId: string) => {
      onColumnVisibilityChange({
        ...columnVisibility,
        [columnId]: true,
      });
    },
    [columnVisibility, onColumnVisibilityChange],
  );

  /**
   * Hide a specific column
   */
  const hideColumn = useCallback(
    (columnId: string) => {
      const column = columns.find((col) => col.id === columnId);
      if (!column) return;

      // Don't allow hiding the last visible column
      if (column.isVisible && visibleCount === 1) return;

      onColumnVisibilityChange({
        ...columnVisibility,
        [columnId]: false,
      });
    },
    [columns, columnVisibility, visibleCount, onColumnVisibilityChange],
  );

  /**
   * Show all columns by setting all to true
   */
  const showAll = useCallback(() => {
    // Merge rather than replace. `columns` holds only the toggleable columns, so
    // rebuilding the state from it alone drops every system-column entry and forces a
    // deliberately hidden `select` or `actions` column back on, with no menu row to
    // hide it again.
    const visibility: VisibilityState = {...columnVisibility};
    for (const col of columns) {
      visibility[col.id] = true;
    }
    onColumnVisibilityChange(visibility);
  }, [columns, columnVisibility, onColumnVisibilityChange]);

  return {
    columns: columnsWithToggleState,
    visibleCount,
    totalCount,
    toggleColumn,
    showAll,
    hideColumn,
    showColumn,
    allVisible,
  };
}
