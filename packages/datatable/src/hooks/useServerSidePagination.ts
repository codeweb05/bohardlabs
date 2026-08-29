import {keepPreviousData} from '@tanstack/react-query';
import type {ColumnFiltersState, PaginationState, SortingState} from '@tanstack/react-table';
import {useCallback, useEffect, useMemo, useState} from 'react';

import {useTableQuery} from '../query/hooks';
import type {
  FilterOperator,
  ServerSideParams,
  ServerTableState,
  UseServerSidePaginationOptions,
  UseServerSidePaginationReturn,
} from '../types';
import {DEFAULT_PAGE_SIZE} from '../types';

/**
 * The batteries-included server-side path: owns the table state, debounces the search,
 * builds the request params and runs the React Query call, and hands back everything the
 * `DataTable` needs.
 *
 * Use it when the page has no data layer of its own. If the app already has typed API hooks,
 * prefer the plain route (`useTableServerState` + `onServerStateChange`), which leaves the
 * fetching where the rest of the app's fetching lives and does not pull React Query into
 * this package's dependency graph.
 *
 * Exported from `@bohardlabs/datatable/server`, not the root, because it is the only part that
 * needs `@tanstack/react-query`.
 *
 * @example
 * ```tsx
 * const table = useServerSidePagination<Order>({
 *   queryKey: ['orders'],                       // params are appended for you
 *   queryFn: (params) => api.get('/orders', {params}).then((r) => r.data),
 *   initialPageSize: 25,
 *   initialSorting: [{id: 'placedAt', desc: true}],
 *   transformers: {
 *     // ServerSideParams is this package's vocabulary; map it to the API's once, here.
 *     transformParams: (p) => ({page: p.page, limit: p.pageSize, search: p.globalFilter}),
 *   },
 * });
 *
 * <DataTable
 *   columns={columns}
 *   data={table.data}
 *   totalRows={table.totalRows}
 *   manualPagination
 *   manualSorting
 *   manualFiltering
 *   isLoading={table.isLoading}
 *   isFetching={table.isFetching}
 *   isError={table.isError}
 *   onRetry={table.refetch}
 *   onServerStateChange={table.onServerStateChange}
 *   ariaLabel="Orders"
 * />
 * ```
 *
 * @see {@link ServerSideParams} for what reaches `queryFn`.
 * @see {@link ServerSideTransformers} for adapting an API that names things differently.
 */
export function useServerSidePagination<TData>(
  options: UseServerSidePaginationOptions<TData>,
): UseServerSidePaginationReturn<TData> {
  const {
    queryKey,
    queryFn,
    initialPageSize = DEFAULT_PAGE_SIZE,
    initialPageIndex = 0,
    initialSorting = [],
    initialFilters = [],
    initialGlobalFilter = '',
    transformers,
    enabled = true,
    staleTime = 30000,
    debounceMs = 300,
  } = options;

  // Table state
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: initialPageIndex,
    pageSize: initialPageSize,
  });
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initialFilters);
  const [globalFilter, setGlobalFilter] = useState<string>(initialGlobalFilter);

  // Debounced global filter
  const [debouncedGlobalFilter, setDebouncedGlobalFilter] = useState<string>(globalFilter);

  // Debounce effect for global filter
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedGlobalFilter(globalFilter);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [globalFilter, debounceMs]);

  // Build server params
  const serverParams = useMemo<ServerSideParams>(() => {
    const params: ServerSideParams = {
      page: pagination.pageIndex + 1, // API usually expects 1-indexed
      pageSize: pagination.pageSize,
    };

    // Add sorting
    if (sorting.length > 0) {
      if (sorting.length === 1) {
        params.sortBy = sorting[0].id;
        params.sortOrder = sorting[0].desc ? 'desc' : 'asc';
      } else {
        params.multiSort = sorting.map((s) => ({
          field: s.id,
          order: s.desc ? 'desc' : 'asc',
        }));
      }
    }

    // Add global filter
    if (debouncedGlobalFilter) {
      params.globalFilter = debouncedGlobalFilter;
    }

    // Add column filters
    if (columnFilters.length > 0) {
      params.filters = columnFilters.map((f) => ({
        field: f.id,
        operator: 'contains' as FilterOperator, // Default operator
        value: f.value,
      }));
    }

    return params;
  }, [pagination, sorting, debouncedGlobalFilter, columnFilters]);

  // Transform params if transformer provided. These are what actually go to the server,
  // not just what keys the cache: a transformer that renames fields for the API would
  // otherwise cache a correctly-keyed entry holding a response to a request the server
  // never understood.
  const transformedParams = useMemo<ServerSideParams | Record<string, unknown>>(() => {
    if (transformers?.transformParams) {
      return transformers.transformParams(serverParams);
    }
    return serverParams;
  }, [serverParams, transformers]);

  // Query key with all dependencies
  const fullQueryKey = useMemo(() => [...queryKey, transformedParams], [queryKey, transformedParams]);

  // Fetch data
  const query = useTableQuery({
    queryKey: fullQueryKey,
    queryFn: async () => {
      const response = await queryFn(transformedParams);
      if (transformers?.transformResponse) {
        return transformers.transformResponse(response);
      }
      return response;
    },
    enabled,
    staleTime,
    placeholderData: keepPreviousData,
  });

  // Reset to first page when filters/sorting change
  const handleFiltersChange = useCallback((filters: ColumnFiltersState) => {
    setColumnFilters(filters);
    setPagination((prev) => ({...prev, pageIndex: 0}));
  }, []);

  const handleGlobalFilterChange = useCallback((value: string) => {
    setGlobalFilter(value);
    setPagination((prev) => ({...prev, pageIndex: 0}));
  }, []);

  const handleSortingChange = useCallback((newSorting: SortingState) => {
    setSorting(newSorting);
    setPagination((prev) => ({...prev, pageIndex: 0}));
  }, []);

  // The DataTable owns pagination, sorting and filter state and reports all four slices
  // in one object, so this is the handler that plugs this hook into it. The slices are
  // applied wholesale and the page is NOT reset here: the table already resets its own
  // page in the same commit that changes a filter, and resetting again would fight it.
  const handleServerStateChange = useCallback((next: ServerTableState) => {
    setPagination(next.pagination);
    setSorting(next.sorting);
    setColumnFilters(next.columnFilters);
    setGlobalFilter(next.globalFilter);
    // The table debounces its search box before emitting, so the value arriving here has
    // already waited. Debouncing it a second time would make every keystroke cost both
    // delays before a request goes out.
    setDebouncedGlobalFilter(next.globalFilter);
  }, []);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setColumnFilters([]);
    setGlobalFilter('');
    setDebouncedGlobalFilter('');
    setPagination((prev) => ({...prev, pageIndex: 0}));
  }, []);

  // Calculate derived values
  const data = query.data?.data ?? [];
  const total = query.data?.meta?.total ?? 0;
  const totalPages = query.data?.meta?.totalPages ?? Math.ceil(total / pagination.pageSize);

  return {
    // Data
    data,
    totalRows: total,
    totalPages,

    // Loading states
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,

    // State
    pagination,
    sorting,
    columnFilters,
    globalFilter,

    // Handlers
    setPagination,
    setSorting: handleSortingChange,
    setColumnFilters: handleFiltersChange,
    setGlobalFilter: handleGlobalFilterChange,
    onServerStateChange: handleServerStateChange,
    resetFilters,

    // Actions
    refetch: query.refetch,
  };
}
