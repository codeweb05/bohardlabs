import type {
  ColumnFiltersState,
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  ExpandedState,
  PaginationState,
  RowSelectionState,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import type {PersistedTableState, ServerTableState, TableDensity} from './types';
import {useTableStatePersistence} from './useTableStatePersistence';

/** Syncs persisted columnOrder/columnVisibility to parent callbacks on mount. */
function syncPersistedColumnLayout(
  persistedState: PersistedTableState,
  onColumnOrderChange?: (order: ColumnOrderState) => void,
  onColumnVisibilityChange?: (visibility: VisibilityState) => void,
): void {
  if (persistedState.columnOrder && onColumnOrderChange && persistedState.columnOrder.length > 0) {
    onColumnOrderChange(persistedState.columnOrder);
  }
  if (persistedState.columnVisibility && onColumnVisibilityChange) {
    if (Object.keys(persistedState.columnVisibility).length > 0) {
      onColumnVisibilityChange(persistedState.columnVisibility);
    }
  }
}

export interface UseDataTableStateOptions {
  readonly tableId?: string;

  // Pagination
  readonly initialPageSize: number;

  // Consolidated server-state callback ("DataTable owns the state" model):
  // the single way the parent observes pagination/sorting/filter changes.
  readonly onServerStateChange?: (state: ServerTableState) => void;

  // Sorting
  readonly initialSorting: SortingState;

  // Filtering
  readonly initialFilters: ColumnFiltersState;
  readonly initialGlobalFilter: string;

  // Columns
  readonly initialColumnOrder: ColumnOrderState;
  readonly initialColumnPinning: ColumnPinningState;
  readonly initialColumnVisibility: VisibilityState;
  readonly onColumnOrderChange?: (order: ColumnOrderState) => void;
  readonly onColumnVisibilityChange?: (visibility: VisibilityState) => void;

  // Selection
  readonly initialRowSelection: RowSelectionState;
  readonly onRowSelectionChange?: (selection: RowSelectionState) => void;
  readonly manualPagination: boolean;

  // Density
  readonly initialDensity: TableDensity;

  // Grouping
  readonly initialGrouping: readonly string[];

  // Data
  readonly data: readonly unknown[];
}

export function useDataTableState(options: UseDataTableStateOptions) {
  const {
    tableId,
    initialPageSize,
    onServerStateChange,
    initialSorting,
    initialFilters,
    initialGlobalFilter,
    initialColumnOrder,
    initialColumnPinning,
    initialColumnVisibility,
    onColumnOrderChange,
    onColumnVisibilityChange,
    initialRowSelection,
    onRowSelectionChange,
    manualPagination,
    initialDensity,
    initialGrouping,
    data,
  } = options;

  // State persistence
  const {
    loadPersistedState,
    persistWholeState,
    clearPersistedState,
    isEnabled: isPersistenceEnabled,
  } = useTableStatePersistence(tableId);

  // Load persisted state once on mount
  const persistedState = useMemo<PersistedTableState | null>(() => {
    if (!isPersistenceEnabled) return null;
    return loadPersistedState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPersistenceEnabled]);

  // Capture the true initial/default values on first mount so handleResetToDefault
  // always resets to defaults, even if the parent re-passes current state as props.
  const defaultFiltersRef = useRef(initialFilters);
  const defaultGlobalFilterRef = useRef(initialGlobalFilter);
  const defaultSortingRef = useRef(initialSorting);
  const defaultColumnOrderRef = useRef(initialColumnOrder);
  const defaultColumnPinningRef = useRef(initialColumnPinning);
  const defaultColumnVisibilityRef = useRef(initialColumnVisibility);
  const defaultDensityRef = useRef(initialDensity);
  const defaultPageSizeRef = useRef(initialPageSize);
  const defaultRowSelectionRef = useRef(initialRowSelection);
  const defaultGroupingRef = useRef(initialGrouping);

  // Track data changes with a version counter so TableBody recomputes rows
  const dataVersionRef = useRef(0);
  const prevDataRef = useRef(data);
  if (prevDataRef.current !== data) {
    prevDataRef.current = data;
    dataVersionRef.current += 1;
  }
  const dataVersion = dataVersionRef.current;

  // State declarations - use persisted values as defaults when available
  const [density, setDensity] = useState<TableDensity>(persistedState?.density ?? initialDensity);
  const [sorting, setSortingInternal] = useState<SortingState>(persistedState?.sorting ?? initialSorting);
  const [columnFilters, setColumnFiltersInternal] = useState<ColumnFiltersState>(
    persistedState?.columnFilters ?? initialFilters,
  );
  const [globalFilter, setGlobalFilterInternal] = useState<string>(persistedState?.globalFilter ?? initialGlobalFilter);
  const [columnOrder, setColumnOrderInternal] = useState<ColumnOrderState>(
    persistedState?.columnOrder ?? initialColumnOrder,
  );
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(
    persistedState?.columnPinning ?? initialColumnPinning,
  );
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(persistedState?.columnSizing ?? {});
  const [columnVisibility, setColumnVisibilityInternal] = useState<VisibilityState>(
    persistedState?.columnVisibility ?? initialColumnVisibility,
  );
  const [rowSelection, setRowSelectionInternal] = useState<RowSelectionState>(initialRowSelection);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [grouping, setGrouping] = useState<string[]>(persistedState?.grouping ?? [...initialGrouping]);

  // Pagination state — the DataTable is the sole owner (no controlled pageIndex prop).
  const [internalPagination, setInternalPaginationRaw] = useState<PaginationState>({
    pageIndex: persistedState?.pageIndex ?? 0,
    pageSize: persistedState?.pageSize ?? initialPageSize,
  });

  const hasMounted = useRef(false);

  const pagination = internalPagination;

  // --- Refs that mirror current state, kept in sync via effects below.
  // Handlers read these refs (event-handler context) to resolve the next state
  // outside any setState updater function, so cross-component parent notifications
  // never run during render.
  const paginationRef = useRef(internalPagination);
  const sortingRef = useRef(sorting);
  const columnFiltersRef = useRef(columnFilters);
  const columnOrderRef = useRef(columnOrder);
  const rowSelectionRef = useRef(rowSelection);
  const columnVisibilityRef = useRef(columnVisibility);

  useEffect(() => {
    paginationRef.current = internalPagination;
  }, [internalPagination]);
  useEffect(() => {
    sortingRef.current = sorting;
  }, [sorting]);
  useEffect(() => {
    columnFiltersRef.current = columnFilters;
  }, [columnFilters]);
  useEffect(() => {
    columnOrderRef.current = columnOrder;
  }, [columnOrder]);
  useEffect(() => {
    rowSelectionRef.current = rowSelection;
  }, [rowSelection]);
  useEffect(() => {
    columnVisibilityRef.current = columnVisibility;
  }, [columnVisibility]);

  // --- Handlers: resolve next state from ref, then setState + notify parent in event-handler context ---

  const handlePaginationChange = useCallback(
    (updater: PaginationState | ((prev: PaginationState) => PaginationState)) => {
      const next = typeof updater === 'function' ? updater(paginationRef.current) : updater;
      paginationRef.current = next;
      setInternalPaginationRaw(next);
    },
    [],
  );

  // Reset to the first page. Called from the filter handlers so the page reset and
  // the filter change land in the SAME commit — the consolidated emit effect then
  // fires once with {newFilter, pageIndex: 0} instead of an intermediate emit
  // carrying the stale (pre-reset) page (which would trigger a redundant fetch).
  // Always commits a FRESH pagination object (even when already on page 0): the
  // table re-derives its filtered/paginated row model from the pagination state
  // reference, so without this the just-cleared filter can leave stale rows on screen.
  const resetToFirstPage = useCallback(() => {
    const next = {...paginationRef.current, pageIndex: 0};
    paginationRef.current = next;
    setInternalPaginationRaw(next);
  }, []);

  const handleSortingChange = useCallback((updater: SortingState | ((prev: SortingState) => SortingState)) => {
    const next = typeof updater === 'function' ? updater(sortingRef.current) : updater;
    sortingRef.current = next;
    setSortingInternal(next);
  }, []);

  const handleFiltersChange = useCallback(
    (updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
      const next = typeof updater === 'function' ? updater(columnFiltersRef.current) : updater;
      columnFiltersRef.current = next;
      setColumnFiltersInternal(next);
      resetToFirstPage();
    },
    [resetToFirstPage],
  );

  const handleGlobalFilterChange = useCallback(
    (value: string) => {
      setGlobalFilterInternal(value);
      resetToFirstPage();
    },
    [resetToFirstPage],
  );

  const handleColumnOrderChange = useCallback(
    (updater: ColumnOrderState | ((prev: ColumnOrderState) => ColumnOrderState)) => {
      const next = typeof updater === 'function' ? updater(columnOrderRef.current) : updater;
      columnOrderRef.current = next;
      setColumnOrderInternal(next);
      onColumnOrderChange?.(next);
    },
    [onColumnOrderChange],
  );

  const handleRowSelectionChange = useCallback(
    (updater: RowSelectionState | ((prev: RowSelectionState) => RowSelectionState)) => {
      const next = typeof updater === 'function' ? updater(rowSelectionRef.current) : updater;
      rowSelectionRef.current = next;
      setRowSelectionInternal(next);
      onRowSelectionChange?.(next);
    },
    [onRowSelectionChange],
  );

  const handleColumnVisibilityChange = useCallback(
    (updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => {
      const next = typeof updater === 'function' ? updater(columnVisibilityRef.current) : updater;
      columnVisibilityRef.current = next;
      setColumnVisibilityInternal(next);
      onColumnVisibilityChange?.(next);
    },
    [onColumnVisibilityChange],
  );

  const handleExpandedChange = useCallback((updater: ExpandedState | ((prev: ExpandedState) => ExpandedState)) => {
    setExpanded((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  const handleColumnSizingChange = useCallback(
    (updaterOrValue: ColumnSizingState | ((prev: ColumnSizingState) => ColumnSizingState)) => {
      setColumnSizing((prev) => (typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue));
    },
    [],
  );

  // --- Sync persisted column layout to parent callbacks on mount ---
  // Pagination/sorting/filters/globalFilter are surfaced to the parent via the
  // consolidated onServerStateChange emit below (the DataTable owns that state);
  // only column order/visibility still notify the parent through dedicated callbacks.
  const hasSyncedPersistedState = useRef(false);

  useEffect(() => {
    if (!isPersistenceEnabled || !persistedState) return;
    if (hasSyncedPersistedState.current) return;
    hasSyncedPersistedState.current = true;

    syncPersistedColumnLayout(persistedState, onColumnOrderChange, onColumnVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Consolidated server-state emit ("DataTable owns the state" model) ---
  // For parents that opt in via onServerStateChange, emit the full server-facing
  // state on mount (resolved from persisted ?? defaults) and on every change.
  // This lets the parent gate its query until the first emit, firing exactly one
  // request at the correct (persisted) page size instead of a redundant request
  // at the default size followed by a second at the persisted size.
  //
  // Notifying a parent from an effect is safe (runs in the commit phase, not
  // during render) — the same pattern the mount-sync effect above relies on.
  // Filter changes reset the page within the same event-handler commit (see
  // handleFiltersChange/handleGlobalFilterChange), so this fires exactly once per
  // settled state — never an intermediate emit with a stale page index.
  useEffect(() => {
    if (!onServerStateChange) return;
    onServerStateChange({
      pagination: internalPagination,
      sorting,
      columnFilters,
      globalFilter,
    });
  }, [onServerStateChange, internalPagination, sorting, columnFilters, globalFilter]);

  // --- Persistence effect (P1 fix: separate mount guard) ---
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    if (!isPersistenceEnabled) return;

    persistWholeState({
      sorting,
      columnFilters,
      globalFilter,
      columnOrder,
      columnPinning,
      columnSizing,
      columnVisibility,
      density,
      pageSize: internalPagination.pageSize,
      pageIndex: internalPagination.pageIndex,
      grouping,
    });
  }, [
    isPersistenceEnabled,
    persistWholeState,
    sorting,
    columnFilters,
    globalFilter,
    columnOrder,
    columnPinning,
    columnSizing,
    columnVisibility,
    density,
    internalPagination.pageSize,
    internalPagination.pageIndex,
    grouping,
  ]);

  // --- Clear selection on page change for server-side (P2 fix) ---
  const prevPageIndexRef = useRef(pagination.pageIndex);

  useEffect(() => {
    if (prevPageIndexRef.current !== pagination.pageIndex) {
      prevPageIndexRef.current = pagination.pageIndex;
      if (manualPagination && Object.keys(rowSelection).length > 0) {
        setRowSelectionInternal({});
        onRowSelectionChange?.({});
      }
    }
  }, [pagination.pageIndex, manualPagination, rowSelection, onRowSelectionChange]);

  // --- Reset to default ---
  // Uses refs captured on first mount so that reset always goes back to the true
  // defaults, even when the parent re-passes current state as initialFilters/etc.
  const handleResetToDefault = useCallback(() => {
    const defFilters = defaultFiltersRef.current;
    const defGlobalFilter = defaultGlobalFilterRef.current;
    const defSorting = defaultSortingRef.current;
    const defColumnOrder = defaultColumnOrderRef.current;
    const defColumnPinning = defaultColumnPinningRef.current;
    const defColumnVisibility = defaultColumnVisibilityRef.current;
    const defDensity = defaultDensityRef.current;
    const defPageSize = defaultPageSizeRef.current;
    const defRowSelection = defaultRowSelectionRef.current;
    const defGrouping = defaultGroupingRef.current;

    // Pagination/sorting/filters reset is surfaced to the parent via the
    // consolidated emit effect; column order/visibility/selection still notify
    // through their dedicated callbacks.
    setColumnFiltersInternal(defFilters);
    setGlobalFilterInternal(defGlobalFilter);

    setSortingInternal(defSorting);

    setColumnOrderInternal(defColumnOrder);
    onColumnOrderChange?.(defColumnOrder);

    setColumnSizing({});

    setColumnVisibilityInternal(defColumnVisibility);
    onColumnVisibilityChange?.(defColumnVisibility);

    setColumnPinning(defColumnPinning);

    setDensity(defDensity);

    const resetPagination = {pageIndex: 0, pageSize: defPageSize};
    setInternalPaginationRaw(resetPagination);

    setRowSelectionInternal(defRowSelection);
    onRowSelectionChange?.(defRowSelection);

    setExpanded({});
    setGrouping([...defGrouping]);

    clearPersistedState();
  }, [onColumnOrderChange, onColumnVisibilityChange, onRowSelectionChange, clearPersistedState]);

  return {
    // State values
    density,
    setDensity,
    sorting,
    columnFilters,
    globalFilter,
    columnOrder,
    columnPinning,
    columnSizing,
    columnVisibility,
    rowSelection,
    expanded,
    grouping,
    pagination,
    internalPagination,
    dataVersion,

    // Handlers
    handlePaginationChange,
    handleSortingChange,
    handleFiltersChange,
    handleGlobalFilterChange,
    handleColumnOrderChange,
    handleRowSelectionChange,
    handleColumnVisibilityChange,
    handleExpandedChange,
    handleColumnSizingChange,
    setColumnPinning,
    setGrouping,

    // Actions
    handleResetToDefault,

    // Persistence
    isPersistenceEnabled,
    clearPersistedState,
  };
}
