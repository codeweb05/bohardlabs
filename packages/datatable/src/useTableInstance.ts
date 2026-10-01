import type {
  ColumnFiltersState,
  ExpandedState,
  PaginationState,
  Row,
  RowSelectionState,
  SortingState,
  Table,
  VisibilityState,
} from '@tanstack/react-table';
import {
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {useEffect, useMemo} from 'react';

import {resolveColumnOrder, resolveColumnPinning} from './hooks/useColumnPinning';
import type {DataTableColumnDef, RowData} from './types';
import type {useDataTableState} from './useDataTableState';

type DataTableState = ReturnType<typeof useDataTableState>;

/** What the table filters by when column filters are off: stored ones stay unapplied. */
const NO_FILTERS: ColumnFiltersState = [];

export interface UseTableInstanceOptions<TData extends RowData> {
  readonly data: readonly TData[];
  readonly tableColumns: readonly DataTableColumnDef<TData>[];
  readonly totalRows?: number;
  readonly getRowId?: (row: TData) => string;
  readonly state: DataTableState;

  readonly enablePagination: boolean;
  readonly manualPagination: boolean;

  readonly enableSorting: boolean;
  readonly manualSorting: boolean;
  readonly enableMultiSort: boolean;

  readonly enableFiltering: boolean;
  readonly enableGlobalFilter: boolean;
  readonly manualFiltering: boolean;

  readonly enableColumnPinning: boolean;
  readonly enableColumnResizing: boolean;

  readonly enableRowSelection: boolean | ((row: Row<TData>) => boolean);
  readonly enableMultiRowSelection: boolean;

  readonly enableExpanding: boolean;
  readonly enableGrouping: boolean;
}

export function useTableInstance<TData extends RowData>(options: UseTableInstanceOptions<TData>) {
  'use no memo';
  const {
    data,
    tableColumns,
    totalRows,
    getRowId,
    state,
    enablePagination,
    manualPagination,
    enableSorting,
    manualSorting,
    enableMultiSort,
    enableFiltering,
    enableGlobalFilter,
    manualFiltering,
    enableColumnPinning,
    enableColumnResizing,
    enableRowSelection,
    enableMultiRowSelection,
    enableExpanding,
    enableGrouping,
  } = options;

  const coreRowModel = useMemo(() => getCoreRowModel(), []);
  const paginationRowModel = useMemo(
    () => (enablePagination && !manualPagination ? getPaginationRowModel() : undefined),
    [enablePagination, manualPagination],
  );
  const sortedRowModel = useMemo(
    () => (enableSorting && !manualSorting ? getSortedRowModel() : undefined),
    [enableSorting, manualSorting],
  );
  // The search box is a filter too, and it stays on screen when column filters are off.
  const filters = enableFiltering || enableGlobalFilter;
  const filteredRowModel = useMemo(
    () => (filters && !manualFiltering ? getFilteredRowModel() : undefined),
    [filters, manualFiltering],
  );
  const expandedRowModel = useMemo(() => getExpandedRowModel(), []);
  const groupedRowModel = useMemo(() => (enableGrouping ? getGroupedRowModel() : undefined), [enableGrouping]);

  const allColumnIds = useMemo(
    () => tableColumns.map((column) => column.id).filter((id): id is string => Boolean(id)),
    [tableColumns],
  );

  // Normalize the stored order and pinned block against the columns the table actually
  // has. Doing it here rather than only at write time also repairs state persisted by an
  // earlier build, which could otherwise strand the selection checkbox mid-row.
  const columnOrder = useMemo(
    () => resolveColumnOrder(state.columnOrder, allColumnIds, state.columnPinning.left ?? []),
    [state.columnOrder, state.columnPinning.left, allColumnIds],
  );

  // Derived from the resolved order, never from the order the pins were added in: the
  // header renders the pinned array as-is while the body renders `columnOrder`.
  const columnPinning = useMemo(
    () => resolveColumnPinning(state.columnPinning, columnOrder),
    [state.columnPinning, columnOrder],
  );

  // TanStack mutates the table instance in place. `'use no memo'` above opts the hook
  // out of the compiler; this disable is the lint equivalent so CI does not annotate it.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: data as TData[],
    columns: tableColumns as DataTableColumnDef<TData>[],
    state: {
      sorting: state.sorting,
      columnFilters: enableFiltering ? state.columnFilters : NO_FILTERS,
      globalFilter: state.globalFilter,
      pagination: state.pagination,
      columnOrder,
      columnPinning,
      columnSizing: state.columnSizing,
      columnVisibility: state.columnVisibility,
      rowSelection: state.rowSelection,
      expanded: state.expanded,
      grouping: state.grouping,
    },
    getCoreRowModel: coreRowModel,
    getRowId: getRowId ? (row) => getRowId(row) : (row) => String(row.id),

    ...(enablePagination && {
      getPaginationRowModel: paginationRowModel,
      manualPagination,
      // TanStack would send the table to page one after every re-sort, re-filter and new
      // `data` array. A filter resets the page itself, a sort should not move it, and
      // rows that go away are handled below.
      autoResetPageIndex: false,
      pageCount: totalRows ? Math.ceil(totalRows / state.pagination.pageSize) : undefined,
      onPaginationChange: state.handlePaginationChange as (
        updater: PaginationState | ((prev: PaginationState) => PaginationState),
      ) => void,
    }),

    ...(enableSorting && {
      getSortedRowModel: sortedRowModel,
      manualSorting,
      enableMultiSort,
      enableSortingRemoval: true,
      onSortingChange: state.handleSortingChange as (
        updater: SortingState | ((prev: SortingState) => SortingState),
      ) => void,
    }),

    ...(filters && {
      getFilteredRowModel: filteredRowModel,
      manualFiltering,
      onColumnFiltersChange: state.handleFiltersChange,
      onGlobalFilterChange: state.handleGlobalFilterChange,
      globalFilterFn: 'includesString',
    }),

    onColumnOrderChange: state.handleColumnOrderChange,

    enableColumnPinning,
    onColumnPinningChange: state.setColumnPinning,

    onColumnVisibilityChange: state.handleColumnVisibilityChange as (
      updater: VisibilityState | ((prev: VisibilityState) => VisibilityState),
    ) => void,

    enableColumnResizing,
    columnResizeMode: 'onChange',
    columnResizeDirection: 'ltr',
    onColumnSizingChange: state.handleColumnSizingChange,

    enableRowSelection,
    enableMultiRowSelection,
    onRowSelectionChange: state.handleRowSelectionChange as (
      updater: RowSelectionState | ((prev: RowSelectionState) => RowSelectionState),
    ) => void,

    getExpandedRowModel: expandedRowModel,
    onExpandedChange: state.handleExpandedChange as (
      updater: ExpandedState | ((prev: ExpandedState) => ExpandedState),
    ) => void,
    getRowCanExpand: enableExpanding ? () => true : () => false,

    ...(enableGrouping && {
      getGroupedRowModel: groupedRowModel,
      onGroupingChange: state.setGrouping,
    }),
  });

  useLastPageWithRows(table, state.pagination.pageIndex, Boolean(paginationRowModel));

  return table;
}

/**
 * When the table does the paging and the rows under the current page go away (a delete, a
 * refetch that returns fewer), show the last page that still has rows instead of an empty
 * one. A server-driven table is left alone: its page is the server's to answer.
 */
function useLastPageWithRows<TData extends RowData>(table: Table<TData>, pageIndex: number, pagesItsOwnRows: boolean) {
  'use no memo';
  const lastPage = pagesItsOwnRows ? Math.max(table.getPageCount() - 1, 0) : pageIndex;
  useEffect(() => {
    if (pageIndex > lastPage) table.setPageIndex(lastPage);
  }, [table, pageIndex, lastPage]);
}
