/**
 * Public surface.
 *
 * `DataTable` is the product. Its parts (headers, cells, filters, toolbar buttons, the
 * resize handle) stay internal: exporting them would freeze the internal composition into
 * the contract, and every rearrangement inside would become a breaking change for someone.
 * Anything a consumer needs to influence comes in as a prop or a column definition.
 *
 * The table is server-first. It owns pagination, sorting, filter and search state, persists
 * it per `tableId`, and reports it through one `onServerStateChange` callback that a page
 * turns into query params.
 *
 * @example Server-driven, which is what this package is for
 * ```tsx
 * import {DataTable, useTableServerState} from '@bohar/datatable';
 * import type {DataTableColumnDef} from '@bohar/datatable';
 *
 * const columns: DataTableColumnDef<Order>[] = [
 *   {id: 'reference', accessorKey: 'reference', header: 'Reference'},
 *   {id: 'total', accessorKey: 'total', header: 'Total', align: 'right'},
 * ];
 *
 * function OrdersPage() {
 *   const {serverState, onServerStateChange} = useTableServerState('orders', {pageSize: 25});
 *   const {data, isLoading, isFetching, isError, refetch} = useOrders({
 *     page: serverState.pagination.pageIndex + 1,
 *     limit: serverState.pagination.pageSize,
 *     search: serverState.globalFilter || undefined,
 *     sortBy: serverState.sorting[0]?.id,
 *     sortOrder: serverState.sorting[0]?.desc ? 'desc' : 'asc',
 *   });
 *
 *   return (
 *     <DataTable
 *       tableId="orders"
 *       columns={columns}
 *       data={data?.data ?? []}
 *       totalRows={data?.meta?.total ?? 0}
 *       manualPagination
 *       manualSorting
 *       manualFiltering
 *       isLoading={isLoading}
 *       isFetching={isFetching}
 *       isError={isError}
 *       onRetry={refetch}
 *       onServerStateChange={onServerStateChange}
 *       ariaLabel="Orders"
 *     />
 *   );
 * }
 * ```
 *
 * @example Client-side, when the whole dataset is already in the browser
 * ```tsx
 * <DataTable columns={columns} data={orders} ariaLabel="Orders" />
 * ```
 *
 * React Query is not required to use this package, including in server mode. The table
 * reports state and renders rows; how those rows are fetched is the consumer's business.
 * One convenience hook, `useServerSidePagination`, does run the query for you, and it is
 * the only thing in the package that needs React Query, which is why it lives behind a
 * separate entry point: `@bohar/datatable/server`.
 */

// The component
export {DataTable} from './DataTable';

// Inline row editing. No React Query: `onSave` is the consumer's own write.
export {useInlineEdit} from './hooks/useInlineEdit';
export type {UseInlineEditOptions, UseInlineEditReturn} from './types';

// Server-state seeding. A page hook calls these to build its list query at the persisted
// page size on the very first render, before the table has mounted and reported its state.
export {getInitialServerState} from './getInitialServerState';
export {useTableServerState} from './useTableServerState';
export type {UseTableServerStateOptions, UseTableServerStateResult} from './useTableServerState';

// Storage. Only needed to migrate an app's existing persisted keys onto the package.
export {DEFAULT_STORAGE_PREFIX, getTableStateStorageKey} from './storage/storageKey';

// Strings. The table ships English and takes overrides; it has no i18n runtime of its own.
export {DEFAULT_LABELS} from './i18n';
export type {DataTableLabels} from './i18n';

// Context, for a consumer rendering custom cells that need the table's own state.
export {
  useDataTable,
  useDataTableContext,
  useTableCore,
  useTableDensity,
  useTableEditing,
  useTableEditingContext,
  useTableMobile,
  useTableUI,
} from './DataTableContext.hooks';

export type {
  BulkAction,
  CellEventHandlers,
  ColumnEditConfig,
  ColumnFilterConfig,
  CustomFilterProps,
  DataTableColumnDef,
  DataTableConfirmProps,
  DataTableContextValue,
  DataTableDateFormats,
  DataTableProps,
  DataTableSlots,
  DensityConfig,
  EditCellProps,
  EditFieldType,
  ExportFormat,
  FilterComponentProps,
  FilterOperator,
  FilterOption,
  FilterType,
  HeaderCase,
  MobileContentLayout,
  MobileOverflow,
  RowAction,
  RowData,
  RowEventHandlers,
  ServerTableState,
  TableDensity,
  TableEventHandlers,
} from './types';

export {
  DEFAULT_HEADER_CASE,
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGE_SIZE_OPTIONS,
  DENSITY_CONFIG,
  VIRTUALIZATION_THRESHOLD,
} from './types';
