/**
 * Every type the package exports.
 *
 * Read {@link DataTableProps} first: it is the whole API surface of the component, grouped
 * by feature, and each group is opt-in. The four props that matter most in this package's
 * intended use are `manualPagination`, `totalRows`, `onServerStateChange` and `tableId`,
 * because they are what make the table server-driven and keep it that way across a
 * navigation.
 *
 * The table is designed server-first: it owns pagination, sorting, filter and search state,
 * persists that state per `tableId`, and reports it as one {@link ServerTableState} for the
 * page to turn into query params. Client-side mode is the same component with the manual
 * flags off, holding the whole dataset.
 */
import type {SxProps, Theme} from '@mui/material';
import type {
  Cell,
  CellContext,
  Column,
  ColumnDef,
  ColumnFiltersState,
  ColumnOrderState,
  ColumnPinningState,
  HeaderContext,
  PaginationState,
  Row,
  RowSelectionState,
  SortingState,
  Table,
  VisibilityState,
} from '@tanstack/react-table';
import type {ComponentType, ReactNode} from 'react';

import type {DataTableLabels} from './i18n';

// ============================================================================
// BASE TYPES
// ============================================================================

/**
 * What a row has to look like: an `id`, plus anything else.
 *
 * The `id` is how selection, expansion and edit state stay attached to a row across a
 * refetch. If the record's identity lives under another name, keep `id` and map it, or pass
 * `getRowId`.
 *
 * The index signature is what makes an interface assignable here, so a domain type usually
 * needs one to satisfy the constraint:
 *
 * @example
 * ```ts
 * interface Order {
 *   id: string;
 *   reference: string;
 *   total: number;
 *   readonly [key: string]: unknown; // required to satisfy RowData
 * }
 * ```
 */
export type RowData = {readonly id: string | number; readonly [key: string]: unknown};

/** Table density options */
export type TableDensity = 'comfortable' | 'compact' | 'spacious';

/** Cell overflow behavior options */
export type CellOverflowMode = 'ellipsis' | 'wrap' | 'truncate';

/**
 * Letter casing applied to column headers.
 * `none` renders the header string exactly as it was passed.
 */
export type HeaderCase = 'capitalize' | 'uppercase' | 'lowercase' | 'none';

/** Default header casing for every DataTable. */
export const DEFAULT_HEADER_CASE: HeaderCase = 'capitalize';

/** Export format options */
export type ExportFormat = 'csv' | 'xlsx' | 'json';

/** How row expansion is triggered */
export type ExpandTrigger = 'icon' | 'row' | 'both';

/** Mobile card content layout for non-primary columns */
export type MobileContentLayout = 'inline' | 'stacked';

/** Mobile card overflow behavior for content */
export type MobileOverflow = 'wrap' | 'ellipsis';

/** Filter types for columns */
export type FilterType = 'text' | 'number' | 'select' | 'date' | 'boolean' | 'custom';

/** Filter operator types */
export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'between'
  | 'isEmpty'
  | 'isNotEmpty';

// ============================================================================
// FILTER TYPES
// ============================================================================

/** Option type for select filters */
export interface FilterOption {
  readonly label: string;
  readonly value: string | number | boolean;
}

/** Column filter configuration */
export interface ColumnFilterConfig {
  readonly type: FilterType;
  readonly operators?: readonly FilterOperator[];
  readonly options?: readonly FilterOption[];
  readonly placeholder?: string;
  readonly min?: number;
  readonly max?: number;
  readonly renderFilter?: (props: CustomFilterProps) => ReactNode;
}

/** Custom filter props for custom renderers */
export interface CustomFilterProps<TData = unknown> {
  readonly column: Column<TData>;
  readonly value: unknown;
  readonly onChange: (value: unknown) => void;
}

// ============================================================================
// EDITING TYPES
// ============================================================================

/** Edit field type */
export type EditFieldType = 'text' | 'number' | 'select' | 'date' | 'boolean' | 'custom';

/** Edit configuration for a column */
export interface ColumnEditConfig<TData = unknown> {
  readonly type: EditFieldType;
  readonly options?: readonly FilterOption[];
  readonly validate?: (value: unknown, row: TData) => string | undefined;
  readonly renderEdit?: (props: EditCellProps<TData>) => ReactNode;
  readonly disabled?: boolean | ((row: TData) => boolean);
}

/** Edit cell props for custom edit renderers */
export interface EditCellProps<TData> {
  readonly row: Row<TData>;
  readonly column: Column<TData>;
  readonly value: unknown;
  readonly onChange: (value: unknown) => void;
  readonly onSave: () => void;
  readonly onCancel: () => void;
  readonly error?: string;
}

// ============================================================================
// COLUMN DEFINITION
// ============================================================================

/**
 * A column. TanStack's `ColumnDef` plus everything this table adds (filtering, alignment,
 * mobile placement, inline editing, per-column overflow).
 *
 * `id` is required, unlike in TanStack, because the id is what the persisted state,
 * the filters and the server params are keyed by. Keep it equal to the field name the API
 * sorts and filters by, and sorting works with no mapping layer.
 *
 * @example
 * ```tsx
 * const columns: DataTableColumnDef<Order>[] = [
 *   {id: 'reference', accessorKey: 'reference', header: 'Reference', size: 120},
 *   {
 *     id: 'status',
 *     accessorKey: 'status',
 *     header: 'Status',
 *     enableFiltering: true,
 *     filterConfig: {type: 'select', options: STATUS_OPTIONS},
 *     cell: ({row}) => <StatusChip status={row.original.status} />,
 *   },
 *   {
 *     id: 'total',
 *     accessorKey: 'total',
 *     header: 'Total',
 *     align: 'right',
 *     cell: ({row}) => formatCurrency(row.original.total),
 *   },
 * ];
 * ```
 */
export interface DataTableColumnDef<TData extends RowData, TValue = unknown> extends Omit<
  ColumnDef<TData, TValue>,
  'id' | 'header'
> {
  /**
   * Unique column id, and the key everything else uses: persisted widths and visibility,
   * filter state, and the sort field reported through `onServerStateChange`. Match the API's
   * field name and no mapping is needed. Changing it later orphans persisted state.
   */
  readonly id: string;

  /** Field on the row to read. Use this or `accessorFn`, not both. */
  readonly accessorKey?: keyof TData;

  /**
   * Compute the value instead of reading a field, for a column that is derived
   * (`(row) => row.firstName + ' ' + row.lastName`). It feeds client-side sorting,
   * filtering and export, so a display-only transform belongs in `cell` instead.
   */
  readonly accessorFn?: (row: TData, index: number) => TValue;

  /**
   * Header text, or a render function for a header that needs its own markup.
   *
   * A string is title-cased by the table's `headerCase`; pass `headerCase="none"` on the
   * table when a header is an acronym or a product name that must survive verbatim.
   */
  readonly header: string | ((props: HeaderContext<TData, TValue>) => ReactNode);

  // Display options
  /** Initially hidden */
  readonly hidden?: boolean;
  /** Enable hiding for this column (default: true) */
  readonly enableHiding?: boolean;
  /** Column pinning position */
  readonly sticky?: 'left' | 'right';
  /** Text alignment */
  readonly align?: 'left' | 'center' | 'right';
  /** Enable text truncation with ellipsis */
  readonly truncate?: boolean;
  /** Max width for truncation */
  readonly maxWidth?: number;
  /** Cell overflow behavior (ellipsis, wrap, or truncate) */
  readonly overflow?: CellOverflowMode;

  // Sorting
  /** Enable sorting for this column */
  readonly enableSorting?: boolean;
  /** Sort descending first when clicked */
  readonly sortDescFirst?: boolean;

  // Filtering
  /** Give this column a filter control. The table also needs `enableFiltering`. */
  readonly enableFiltering?: boolean;
  /**
   * Which control, and what it offers. `{type: 'select', options}` for a known set,
   * `{type: 'text', placeholder}` for free text, `{type: 'custom', renderFilter}` for
   * anything else (a date range, a lookup).
   *
   * In server-side mode the value is passed through to `onServerStateChange` and the server
   * decides what it means; nothing is filtered locally.
   */
  readonly filterConfig?: ColumnFilterConfig;

  // Sizing
  /** Enable column resizing */
  readonly enableResizing?: boolean;
  /** Minimum column width */
  readonly minSize?: number;
  /** Maximum column width */
  readonly maxSize?: number;
  /** Default column width */
  readonly size?: number;

  // Grouping
  /** Enable grouping by this column */
  readonly enableGrouping?: boolean;

  // Mobile display
  /**
   * Include this column in the card view. A card that shows every column is a table again,
   * so pick the three or four that identify the record.
   */
  readonly showInMobileCard?: boolean;
  /** Shorter label for the card, where the header text is often too long. */
  readonly mobileLabel?: string;
  /** Position in the card, lowest first. The lowest becomes the card's title. */
  readonly mobileOrder?: number;
  /** Layout for this column's content in mobile card: 'inline' places label and value side-by-side, 'stacked' places value on a new line (default: 'inline') */
  readonly mobileContentLayout?: MobileContentLayout;
  /** Overflow behavior for this column's content in mobile card (default: 'wrap') */
  readonly mobileOverflow?: MobileOverflow;

  // Inline editing
  /** Enable inline editing for this column */
  readonly enableEditing?: boolean;
  /** Edit configuration */
  readonly editConfig?: ColumnEditConfig<TData>;

  // Custom cell renderer
  /**
   * Render the cell yourself. `props.row.original` is the record, `props.getValue()` the
   * accessed value.
   *
   * Presentation only: sorting, filtering and export read the accessor, not this. So a
   * `cell` that formats a number keeps sorting numeric, while a `cell` that invents a value
   * out of nothing will sort and export as something else.
   */
  readonly cell?: (props: CellContext<TData, TValue>) => ReactNode;

  // Footer
  /** Footer content */
  readonly footer?: string | ((props: HeaderContext<TData, TValue>) => ReactNode);
}

// ============================================================================
// ACTION TYPES
// ============================================================================

/**
 * One entry in a row's overflow menu.
 *
 * `hidden` and `disabled` take the row, which is the point: an action that cannot apply to
 * a row should not be offered, rather than offered and then refused.
 *
 * @example
 * ```tsx
 * const rowActions: RowAction<Order>[] = [
 *   {id: 'view', label: 'View', icon: <VisibilityIcon />, onClick: (o) => navigate(`/orders/${o.id}`)},
 *   {
 *     id: 'cancel',
 *     label: 'Cancel order',
 *     color: 'error',
 *     divider: true,                             // separates the destructive one
 *     hidden: (o) => o.status === 'cancelled',   // already cancelled, so do not offer it
 *     onClick: (o) => void cancelOrder(o.id),
 *   },
 * ];
 * ```
 */
export interface RowAction<TData> {
  /** Stable identity for the menu item. Not shown. */
  readonly id: string;
  /** Menu text. Also the accessible name, so make it a verb phrase. */
  readonly label: string;
  /** Optional leading icon. Import it deep-path (`@mui/icons-material/Edit`), never from the barrel. */
  readonly icon?: ReactNode;
  /**
   * What the action does. Return type is `void | Promise<void>`, and the table does not
   * await it: an async handler owns its own errors and its own toast.
   */
  readonly onClick: (row: TData) => void | Promise<void>;
  /** Greyed out but still visible, which tells the user the action exists and why it is unavailable. */
  readonly disabled?: boolean | ((row: TData) => boolean);
  /** Removed from the menu entirely. Use for actions that make no sense for this row. */
  readonly hidden?: boolean | ((row: TData) => boolean);
  /** Theme colour for the item. `'error'` for destructive ones. */
  readonly color?: 'inherit' | 'primary' | 'secondary' | 'error' | 'warning' | 'success' | 'info';
  /** Draw a divider above this item, to separate a destructive action from the routine ones. */
  readonly divider?: boolean;
}

/**
 * One button in the bar that replaces the toolbar while rows are selected.
 *
 * Receives the selected rows. In server-side mode "select all" means the current page, so
 * an action meant to apply to every matching row should send the filter state to the server
 * instead of a list of ids.
 *
 * @example
 * ```tsx
 * const bulkActions: BulkAction<Order>[] = [
 *   {id: 'assign', label: 'Assign driver', onClick: (rows) => void assign(rows.map((r) => r.id))},
 *   {
 *     id: 'cancel',
 *     label: 'Cancel',
 *     color: 'error',
 *     confirmMessage: (count) => `Cancel ${count} orders? This cannot be undone.`,
 *     onClick: (rows) => void cancelMany(rows.map((r) => r.id)),
 *   },
 * ];
 * ```
 */
export interface BulkAction<TData> {
  /** Stable identity for the button. Not shown. */
  readonly id: string;
  /** Button text, and its accessible name. */
  readonly label: string;
  /** Optional leading icon. Deep-path import only. */
  readonly icon?: ReactNode;
  /** Runs over every selected row at once. Not awaited by the table. */
  readonly onClick: (selectedRows: TData[]) => void | Promise<void>;
  /** Disable based on the selection, e.g. a limit on how many rows the endpoint takes. */
  readonly disabled?: boolean | ((selectedRows: TData[]) => boolean);
  /**
   * Show a confirmation dialog first. Pass a function to put the count in the message, which
   * is the difference between "Are you sure?" and "Cancel 34 orders?".
   */
  readonly confirmMessage?: string | ((count: number) => string);
  /** Theme colour for the button. `'error'` for destructive ones. */
  readonly color?: 'inherit' | 'primary' | 'secondary' | 'error' | 'warning' | 'success' | 'info';
}

// ============================================================================
// SERVER-SIDE TYPES
// ============================================================================

/**
 * What {@link useServerSidePagination} sends to a `queryFn`, before any transform.
 *
 * This is the package's own vocabulary, not any particular API's. Almost no backend takes
 * exactly these names, which is what `transformParams` in {@link ServerSideTransformers} is
 * for: map once, in one place, instead of at every call site.
 *
 * Only relevant when using the `@bohardlabs/datatable/server` entry point. Driving the table from
 * `onServerStateChange` gives you {@link ServerTableState} instead, and you build the params
 * yourself.
 */
export interface ServerSideParams {
  /** Page number, 1-INDEXED, unlike TanStack's `pageIndex`. */
  page: number;
  /** Rows per page. */
  pageSize: number;
  /** Column id of the active sort, when single-sorting. */
  sortBy?: string;
  /** Direction of the active sort. */
  sortOrder?: 'asc' | 'desc';
  /** Every active sort, in priority order, when multi-sort is on. */
  multiSort?: {field: string; order: 'asc' | 'desc'}[];
  /** The search box's debounced value. Which fields it matches is the server's decision. */
  globalFilter?: string;
  /** Per-column filters, each carrying the operator the control produced. */
  filters?: {
    field: string;
    operator: FilterOperator;
    value: unknown;
  }[];
}

/**
 * The response shape {@link useServerSidePagination} expects. An API that returns something
 * else is adapted with `transformResponse` rather than by reshaping the API.
 *
 * `meta.total` is what the pager needs; the rest is convenience. Treat every field as
 * possibly missing when you write the transform: a partial envelope is a normal failure.
 */
export interface ServerSideResponse<TData> {
  readonly data: TData[];
  readonly meta: {
    readonly total: number;
    readonly page: number;
    readonly limit: number;
    readonly totalPages: number;
    readonly hasNextPage: boolean;
    readonly hasPreviousPage: boolean;
  };
}

/**
 * The adapter between this package's vocabulary and a real API's.
 *
 * @example
 * ```ts
 * const transformers: ServerSideTransformers<Order> = {
 *   transformParams: (p) => ({page: p.page, limit: p.pageSize, search: p.globalFilter}),
 *   transformResponse: (raw) => {
 *     const body = raw as {items?: Order[]; count?: number};
 *     return {
 *       data: body.items ?? [],
 *       meta: {total: body.count ?? 0, page: 1, limit: 25, totalPages: 1,
 *              hasNextPage: false, hasPreviousPage: false},
 *     };
 *   },
 * };
 * ```
 */
export interface ServerSideTransformers<TData> {
  readonly transformParams?: (params: ServerSideParams) => Record<string, unknown>;
  readonly transformResponse?: (response: unknown) => ServerSideResponse<TData>;
}

// ============================================================================
// EVENT HANDLER TYPES
// ============================================================================

/** Cell event handlers */
export interface CellEventHandlers<TData> {
  readonly onCellClick?: (row: TData, columnId: string, cell: Cell<TData, unknown>) => void;
  readonly onCellDoubleClick?: (row: TData, columnId: string, cell: Cell<TData, unknown>) => void;
}

/** Row event handlers */
export interface RowEventHandlers<TData> {
  readonly onRowClick?: (row: TData) => void;
  readonly onRowDoubleClick?: (row: TData) => void;
}

/** Table event handlers */
export interface TableEventHandlers<TData> extends CellEventHandlers<TData>, RowEventHandlers<TData> {
  readonly onSelectionChange?: (selectedRows: TData[]) => void;
  readonly onEditStart?: (row: TData) => void;
  readonly onEditEnd?: (row: TData, saved: boolean) => void;
  readonly onExportStart?: (format: ExportFormat) => void;
  readonly onExportComplete?: (format: ExportFormat, success: boolean) => void;
}

// ============================================================================
// MAIN TABLE CONFIG
// ============================================================================

/**
 * Consolidated server-facing table state, emitted via `onServerStateChange`.
 *
 * This is the single source of truth a parent uses to build server query params.
 * The DataTable owns this state internally (including any persisted values);
 * the parent only observes it. It is emitted once on mount with the resolved
 * initial state (persisted ?? defaults) so the parent can fire exactly one
 * request at the correct page size, then again whenever any slice changes.
 */
export interface ServerTableState {
  readonly pagination: PaginationState;
  readonly sorting: SortingState;
  readonly columnFilters: ColumnFiltersState;
  readonly globalFilter: string;
}

/** Persisted table state (saved to localStorage) */
export interface PersistedTableState {
  readonly sorting?: SortingState;
  readonly columnFilters?: ColumnFiltersState;
  readonly globalFilter?: string;
  readonly columnOrder?: ColumnOrderState;
  readonly columnPinning?: ColumnPinningState;
  readonly columnSizing?: Record<string, number>;
  readonly columnVisibility?: VisibilityState;
  readonly density?: TableDensity;
  readonly pageSize?: number;
  readonly pageIndex?: number;
  readonly grouping?: string[];
}

/** Main table configuration props */
export interface DataTableProps<TData extends RowData> extends TableEventHandlers<TData> {
  // Data
  /**
   * Column definitions. Stable identity matters: build this array as a module constant or
   * memoize it, because a new array on every parent render rebuilds the table instance.
   *
   * @see {@link DataTableColumnDef} for the per-column options.
   */
  readonly columns: readonly DataTableColumnDef<TData>[];
  /**
   * The rows to render.
   *
   * In server-side mode this is ONE PAGE, not the dataset. Anything the table derives from
   * `data` (a footer total, a "select all" set, an export of "everything") is therefore
   * derived from that page only. Pass `totalRows` so the pager knows the real size.
   */
  readonly data: readonly TData[];
  /**
   * Total number of rows on the server, across all pages. Required whenever
   * `manualPagination` is on, since `data.length` is one page and the pager would otherwise
   * report "1 of 1".
   *
   * Read it defensively from the response (`response?.meta?.total ?? 0`); a partial envelope
   * is a normal failure mode, not an exceptional one.
   */
  readonly totalRows?: number;

  // Identification
  /**
   * Stable, unique id for this table. It is the persistence key: sorting, filters, column
   * order/sizing/visibility, density and page size are written to `localStorage` under it
   * and restored on the next mount.
   *
   * Omit it and the table keeps working, statelessly, which is what a story or a modal
   * usually wants. Two tables that share an id share their state, so a detail-page sub-list
   * gets its own id even when it reuses the same columns.
   *
   * @see {@link getTableStateStorageKey} for the exact key, if an app has to migrate one.
   */
  readonly tableId?: string;
  /**
   * How to identify a row. Defaults to `row.id`, which {@link RowData} requires.
   * Override only when the stable identity lives somewhere else (a composite key, a uuid
   * under another name). Row selection and expansion state are keyed by this.
   */
  readonly getRowId?: (row: TData) => string;

  // Loading/Error states
  /**
   * First load, when there is nothing to show yet. Renders the skeleton in place of the
   * body and keeps the toolbar mounted so the layout does not jump when rows arrive.
   */
  readonly isLoading?: boolean;
  /**
   * A refetch is in flight while rows are already on screen (page change, filter change,
   * background revalidation). Shows a subtle indicator instead of replacing the table, so
   * the user does not lose their place. With React Query, this is `isFetching`.
   */
  readonly isFetching?: boolean;
  /** The request failed. Renders the error state in place of the body. */
  readonly isError?: boolean;
  /** Message for the error state. Keep it about the data, not the exception. */
  readonly error?: string | null;
  /**
   * Retry handler. Without it the error state is a dead end with no button; with it the
   * user can retry in place. With React Query, pass `refetch`.
   */
  readonly onRetry?: () => void;

  // Server-side mode
  /**
   * The server paginates. The table stops slicing `data` and renders it as-is, and the
   * pager sizes itself from `totalRows`.
   *
   * Turn this on together with `totalRows` and `onServerStateChange`. Leaving it off while
   * feeding one page at a time is the classic bug: the table paginates the page it was
   * given and shows "1 to 10 of 10" over a set of thousands.
   */
  readonly manualPagination?: boolean;
  /**
   * The server sorts. Header clicks still update the sort state and the arrows, but the
   * table does not reorder the rows it was handed; the new state arrives through
   * `onServerStateChange` and the next response is expected to be sorted.
   */
  readonly manualSorting?: boolean;
  /**
   * The server filters. The filter UI and the global search still drive state and emit it,
   * but rows are not removed locally; the next response is expected to be filtered.
   */
  readonly manualFiltering?: boolean;

  // Pagination
  /** Render the pager and page the rows. Default `true`. */
  readonly enablePagination?: boolean;
  /**
   * Page size for the first render. Ignored when a persisted size exists for this
   * `tableId`, which is why a page hook seeds its query from
   * {@link useTableServerState} rather than from this value.
   *
   * @defaultValue {@link DEFAULT_PAGE_SIZE}
   */
  readonly pageSize?: number;
  /**
   * Choices in the rows-per-page menu.
   *
   * @defaultValue {@link DEFAULT_PAGE_SIZE_OPTIONS}
   */
  readonly pageSizeOptions?: readonly number[];
  /**
   * The one way to observe server-facing state. Fires once on mount with the resolved
   * initial state (persisted values if any, otherwise the defaults), then on every
   * pagination, sorting, column-filter or global-filter change.
   *
   * The table OWNS this state. Do not mirror it back in as props: build query params from
   * what the callback reports, and gate the query until the first emit so a persisted page
   * size cannot cause a throwaway fetch at the default size.
   *
   * Pass a stable function ({@link useTableServerState} returns one).
   *
   * @example
   * ```tsx
   * const {serverState, onServerStateChange} = useTableServerState('orders', {pageSize: 25});
   *
   * const params = useMemo(() => ({
   *   page: serverState.pagination.pageIndex + 1, // most APIs are 1-indexed
   *   limit: serverState.pagination.pageSize,
   *   search: serverState.globalFilter || undefined,
   *   sortBy: serverState.sorting[0]?.id,
   *   sortOrder: serverState.sorting[0]?.desc ? 'desc' : 'asc',
   * }), [serverState]);
   *
   * const {data, isLoading, isFetching, isError, refetch} = useQuery({
   *   queryKey: ['orders', params],
   *   queryFn: () => fetchOrders(params),
   *   placeholderData: keepPreviousData, // keeps rows on screen while the next page loads
   * });
   *
   * return (
   *   <DataTable
   *     tableId="orders"
   *     columns={columns}
   *     data={data?.data ?? []}
   *     totalRows={data?.meta?.total ?? 0}
   *     manualPagination
   *     manualSorting
   *     manualFiltering
   *     isLoading={isLoading}
   *     isFetching={isFetching}
   *     isError={isError}
   *     onRetry={refetch}
   *     onServerStateChange={onServerStateChange}
   *   />
   * );
   * ```
   */
  readonly onServerStateChange?: (state: ServerTableState) => void;

  // Sorting
  /** Sortable headers. Default `true`. Individual columns can opt out with `enableSorting: false`. */
  readonly enableSorting?: boolean;
  /**
   * Shift-click adds a second and third sort instead of replacing the first. Most APIs take
   * one sort field, so leave this off unless the endpoint accepts a list.
   */
  readonly enableMultiSort?: boolean;
  /**
   * Sort for the first render, overridden by a persisted sort for this `tableId`.
   * A list almost always wants one (newest first), or the first page is in insertion order.
   */
  readonly initialSorting?: SortingState;

  // Filtering
  /**
   * Per-column filters. A column also needs `enableFiltering` and a `filterConfig` to get a
   * control; this prop only turns the feature on for the table.
   */
  readonly enableFiltering?: boolean;
  /** The single search box in the toolbar. Debounced before it reaches `onServerStateChange`. */
  readonly enableGlobalFilter?: boolean;
  /** Placeholder for the search box. Also its accessible name, so make it say what it searches. */
  readonly globalFilterPlaceholder?: string;
  /**
   * Helper text under the search box. Worth setting in server-side mode, where only the
   * backend knows which fields it actually matches ("Searches reference, customer, status").
   */
  readonly globalFilterHelperText?: string;
  /**
   * Column filters for the first render, overridden by persisted filters. Use it to seed a
   * deep link ("show me the failed ones") without making the filter permanent.
   */
  readonly initialFilters?: ColumnFiltersState;
  /** Search term for the first render, overridden by a persisted one. */
  readonly initialGlobalFilter?: string;

  // Column management
  /** Drag a header to reorder. Persisted per `tableId`. */
  readonly enableColumnOrdering?: boolean;
  /** Drag a header edge to resize. Persisted per `tableId`. */
  readonly enableColumnResizing?: boolean;
  /** Pin columns left or right; pinned cells stay put while the rest scrolls horizontally. */
  readonly enableColumnPinning?: boolean;
  /** The show/hide columns menu in the toolbar. Persisted per `tableId`. */
  readonly enableColumnVisibility?: boolean;
  /** Column order for the first render, overridden by a persisted order. */
  readonly initialColumnOrder?: ColumnOrderState;
  /** Pinned columns for the first render, e.g. `{left: ['reference'], right: []}`. */
  readonly initialColumnPinning?: ColumnPinningState;
  /** Hidden columns for the first render: `{internalId: false}`. */
  readonly initialColumnVisibility?: VisibilityState;
  /** Notification only. The table already persists the order; nothing needs feeding back. */
  readonly onColumnOrderChange?: (order: ColumnOrderState) => void;
  /** Notification only. The table already persists visibility; nothing needs feeding back. */
  readonly onColumnVisibilityChange?: (visibility: VisibilityState) => void;

  // Row selection
  /**
   * Checkbox column. Pass a predicate to make it conditional, so a row that cannot take the
   * bulk action is not selectable rather than selectable and then rejected.
   *
   * @example `enableRowSelection={(row) => row.original.status !== 'cancelled'}`
   */
  readonly enableRowSelection?: boolean | ((row: Row<TData>) => boolean);
  /** Allow more than one row selected. Default `true`; `false` gives radio-like behaviour. */
  readonly enableMultiRowSelection?: boolean;
  /**
   * Header checkbox.
   *
   * In server-side mode it selects the CURRENT PAGE, because that is all the table holds.
   * If the action needs to mean "all 4,000 matching rows", send the filter state to the
   * server instead of a list of ids.
   */
  readonly enableSelectAll?: boolean;
  /** Rows selected on the first render, keyed by row id: `{'ord_1': true}`. */
  readonly initialRowSelection?: RowSelectionState;
  /**
   * Selection changed. Gives the raw `{[rowId]: true}` map; for the row objects themselves
   * use `onSelectionChange`, which is passed the selected `TData[]`.
   */
  readonly onRowSelectionChange?: (selection: RowSelectionState) => void;

  // Row actions
  /**
   * Per-row actions, rendered in an overflow menu in the last column.
   *
   * @see {@link RowAction}, whose `hidden`/`disabled` take the row.
   */
  readonly rowActions?: readonly RowAction<TData>[];
  /**
   * Actions over the current selection. The bar replaces the toolbar while anything is
   * selected. Requires `enableRowSelection`.
   *
   * @see {@link BulkAction}, whose `confirmMessage` gates destructive ones.
   */
  readonly bulkActions?: readonly BulkAction<TData>[];

  // Inline editing
  /**
   * Edit in place. Columns opt in individually with `enableEditing` and an `editConfig`.
   * Requires `onRowEdit`; without it an edit has nowhere to go.
   */
  readonly enableInlineEdit?: boolean;
  /**
   * Persist an edit. Receives the row id and only the CHANGED fields, so it maps onto a
   * PATCH. Reject the promise to keep the row in edit mode and surface the error; resolve it
   * and the table exits edit mode. The table does not mutate `data`, so refetch or update
   * the cache in here.
   */
  readonly onRowEdit?: (rowId: string, data: Partial<TData>) => Promise<void>;
  /**
   * `'row'` puts the whole row into edit mode with one save; `'cell'` commits each cell on
   * blur. Default `'row'`, which is the one that maps to a single request.
   */
  readonly editMode?: 'row' | 'cell';

  // Expanding rows
  /** Expandable rows. Needs `renderExpandedRow` to have anything to show. */
  readonly enableExpanding?: boolean;
  /**
   * Content for an expanded row, rendered in a full-width cell under it. Receives the
   * TanStack row, so `row.original` is the record.
   *
   * It renders only while expanded, which makes it a reasonable place to mount a small
   * detail query rather than over-fetching every row up front.
   */
  readonly renderExpandedRow?: (row: Row<TData>) => ReactNode;
  /** Keep other rows expanded when one opens. Default `true`; `false` makes it accordion-like. */
  readonly allowMultipleExpanded?: boolean;
  /**
   * What opens a row: the chevron, a click anywhere on the row, or both.
   * `'row'` and `'both'` conflict with `onRowClick` navigation, so pick one job for a click.
   *
   * @defaultValue `'icon'`
   */
  readonly expandTrigger?: ExpandTrigger;
  /** Collapse/expand transition. Default `true`; turn off for very long expanded panels. */
  readonly animateExpansion?: boolean;

  // Grouping
  /**
   * Group rows under collapsible headers.
   *
   * Client-side only. It groups the rows the table holds, so with `manualPagination` it
   * groups one page, which is rarely what a user reads it as.
   */
  readonly enableGrouping?: boolean;
  /** Column ids to group by on the first render, outermost first. */
  readonly initialGrouping?: readonly string[];

  // Export
  /**
   * Export menu in the toolbar.
   *
   * The built-in export writes the rows the table HOLDS. In server-side mode that is the
   * current page, which is a footgun on a filtered list of thousands: pass `onExport` and
   * have the server produce the file.
   */
  readonly enableExport?: boolean;
  /**
   * Formats offered. CSV alone by default, because it is the only one of the three that
   * needs nothing installed: `xlsx` needs the optional `write-excel-file` peer, and without
   * it the menu still lists the item and the export fails at click time. Opt into the rest.
   *
   * @defaultValue `['csv']`
   */
  readonly exportFormats?: readonly ExportFormat[];
  /** File name without extension. Defaults to the table's id, or `table`. */
  readonly exportFileName?: string;
  /**
   * Take over the export. Called instead of the built-in writer, with the format and the
   * rows currently held, which is the hook for "ask the server for the full file instead".
   */
  readonly onExport?: (format: ExportFormat, data: TData[]) => void;

  // Virtualization
  /**
   * Render only the visible window of rows.
   *
   * For long unpaginated lists: it needs `maxHeight` to have something to scroll inside, and
   * it pairs with `enablePagination={false}`. Below {@link VIRTUALIZATION_THRESHOLD} rows it
   * costs more than it saves.
   */
  readonly enableVirtualization?: boolean;
  /**
   * Fixed row height in pixels, used to size the scroll area. A wrong value makes the
   * scrollbar drift, so keep it in step with `density`.
   */
  readonly virtualRowHeight?: number;
  /** Rows rendered beyond the viewport, trading memory for fewer blank frames while scrolling. */
  readonly virtualOverscan?: number;

  // UI customization
  /**
   * Row height and padding preset. Persisted per `tableId` once the user picks one.
   *
   * @defaultValue `'comfortable'`
   * @see {@link DENSITY_CONFIG} for the exact heights.
   */
  readonly density?: TableDensity;
  /** Let the user switch density from the toolbar. */
  readonly enableDensityToggle?: boolean;
  /** Header stays visible while the body scrolls. Needs `maxHeight` to have a scroll container. */
  readonly stickyHeader?: boolean;
  /** Cap on the scroll container: `480`, `'60vh'`. What `stickyHeader` and virtualization scroll inside. */
  readonly maxHeight?: number | string;
  /**
   * Shown when there are no rows. Say what is missing in this context ("No orders in this
   * date range") rather than "No data", which tells the user nothing about what to change.
   */
  readonly emptyMessage?: string;
  /** Overrides the loading label. Defaults to the `loading` entry in {@link DataTableLabels}. */
  readonly loadingMessage?: string;
  /**
   * Render the toolbar (search, filters, column menu, density, export). Default `true`.
   * Turning it off does not disable the features, it only hides their controls.
   */
  readonly showToolbar?: boolean;
  /** Render the pager. Default `true`. `enablePagination={false}` is what stops the paging itself. */
  readonly showPagination?: boolean;
  /** `sx` for the outer container. For layout only (height, margins); style the look through the theme. */
  readonly containerSx?: Record<string, unknown>;
  /**
   * What a cell does with content wider than its column: ellipsis, wrap to more lines, or
   * hard truncate. Per-column `overflow` wins over this.
   *
   * @defaultValue `'ellipsis'`
   */
  readonly cellOverflow?: CellOverflowMode;
  /** Letter casing applied to column headers (default: 'capitalize'). Use 'none' to render header strings verbatim. */
  readonly headerCase?: HeaderCase;
  /**
   * Overrides for the table's own strings. Only the keys given are replaced; the rest
   * fall back to `DEFAULT_LABELS`. Pass a stable object (module constant, or memoized on
   * the active locale) so the table is not re-rendered on every parent render.
   */
  readonly labels?: Partial<DataTableLabels>;
  /**
   * Replaces a piece of chrome the table would otherwise render itself.
   *
   * The one slot today is `confirmDialog`, used before a destructive bulk action. Most
   * apps already have a confirmation dialog of their own, and two dialogs that look
   * different in the same product is the tell that a component was dropped in rather than
   * fitted. Pass yours and the table calls it instead.
   *
   * Pass a stable component reference: a function declared inside render is a new
   * component type every render, which remounts the dialog and loses its state.
   *
   * @example
   * ```tsx
   * const slots = {confirmDialog: AppConfirmDialog}; // module constant
   *
   * <DataTable slots={slots} bulkActions={bulkActions} … />
   * ```
   */
  readonly slots?: DataTableSlots;
  /**
   * Date formats for the date column filter.
   *
   * `display` is what the picker shows and parses, so it follows the app's locale:
   * `'MM/DD/YYYY'` in the US, `'YYYY-MM-DD'` where that reads as normal. `value` is what
   * the filter puts into the filter state and therefore what reaches the server, so it
   * changes only when the API wants something other than ISO.
   *
   * Both are dayjs format strings.
   *
   * @defaultValue `{display: 'DD/MM/YYYY', value: 'YYYY-MM-DD'}`
   */
  readonly dateFormats?: DataTableDateFormats;
  /**
   * Per-row styling from the row's own data: a tint for an overdue order, a strikethrough
   * for a cancelled one. Read theme tokens rather than hex values so it follows the
   * consumer's palette, and do not carry meaning in colour alone.
   *
   * @example `getRowSx={(row) => (row.isOverdue ? {bgcolor: 'error.light'} : undefined)}`
   */
  readonly getRowSx?: (row: TData) => SxProps<Theme> | undefined;

  // Mobile
  /**
   * Breakpoint below which the card view replaces the table.
   *
   * @defaultValue `'sm'`
   */
  readonly mobileBreakpoint?: 'xs' | 'sm' | 'md';
  /**
   * Below `mobileBreakpoint`, render one card per row instead of a horizontally scrolling
   * table. Columns choose whether they appear with `showInMobileCard` and in what order with
   * `mobileOrder`; the first one is the card title.
   */
  readonly enableMobileCardView?: boolean;
  /**
   * Replace the built-in card entirely. Receives the record and the row actions, and owns
   * the whole card, including rendering those actions.
   */
  readonly renderMobileCard?: (row: TData, actions?: readonly RowAction<TData>[]) => ReactNode;

  // Accessibility
  /**
   * Accessible name for the table, announced when a screen reader enters it. Always set it:
   * a page with two tables that are both called "table" is not navigable. Name the content
   * ("Orders"), not the widget.
   */
  readonly ariaLabel?: string;
  /** Id of an element describing the table, for a caption or a note that sits outside it. */
  readonly ariaDescribedBy?: string;
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

/** DataTable context value */
/**
 * What the table passes to whatever renders a confirmation, and the props of the exported
 * `ConfirmDialog`. One type for both: the built-in dialog and a replacement are the same
 * contract, which is what makes swapping one for the other a substitution.
 *
 * A replacement has to honour three things or bulk actions break: call `onConfirm` on
 * confirm and `onClose` on dismissal, await `onConfirm` (it returns a promise while the
 * action runs), and stay closed while `open` is false. `isLoading` is true for the length
 * of the action; blocking dismissal during it is the polite behaviour but not required.
 */
export interface DataTableConfirmProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void | Promise<void>;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly confirmColor?: 'primary' | 'error' | 'warning' | 'success';
  readonly isLoading?: boolean;
}

/** Components the consumer supplies in place of the table's own. See {@link DataTableProps.slots}. */
export interface DataTableSlots {
  readonly confirmDialog?: ComponentType<DataTableConfirmProps>;
}

/** dayjs format strings for the date filter. See {@link DataTableProps.dateFormats}. */
export interface DataTableDateFormats {
  /** What the picker shows and parses. @defaultValue `'DD/MM/YYYY'` */
  readonly display?: string;
  /** What lands in filter state, and so in the request. @defaultValue `'YYYY-MM-DD'` */
  readonly value?: string;
}

export interface DataTableContextValue<TData extends RowData> {
  readonly table: Table<TData>;
  readonly density: TableDensity;
  readonly setDensity: (density: TableDensity) => void;
  readonly editingRowId: string | null;
  readonly editingData: Partial<TData>;
  readonly isEditing: (rowId: string) => boolean;
  readonly startEdit: (row: Row<TData>) => void;
  readonly cancelEdit: () => void;
  readonly saveEdit: () => Promise<void>;
  readonly updateEditField: (field: keyof TData, value: unknown) => void;
  readonly isSaving: boolean;
  readonly editError: string | null;
  readonly isMobile: boolean;
  /** Current row selection state - used to trigger re-renders when selection changes */
  readonly rowSelection?: Record<string, boolean>;
  /** Current pagination state - used to trigger re-renders */
  readonly pagination?: {pageIndex: number; pageSize: number};
  /** Current sorting state - used to trigger re-renders */
  readonly sorting?: Array<{id: string; desc: boolean}>;
  /** Current expanded state - used to trigger re-renders when row expansion changes */
  readonly expanded?: Record<string, boolean> | boolean;
  /** Current column visibility state - used to trigger re-renders when visibility changes */
  readonly columnVisibility?: VisibilityState;
  /** Counter that increments when data changes - used to trigger row recomputation */
  readonly dataVersion?: number;
}

// ============================================================================
// HOOK RETURN TYPES
// ============================================================================

/** useServerSidePagination options */
export interface UseServerSidePaginationOptions<TData> {
  readonly queryKey: readonly unknown[];
  /**
   * Receives whatever `transformers.transformParams` produced, or the raw
   * `ServerSideParams` when no transformer is configured.
   */
  readonly queryFn: (params: ServerSideParams | Record<string, unknown>) => Promise<ServerSideResponse<TData>>;
  readonly initialPageSize?: number;
  readonly initialPageIndex?: number;
  readonly initialSorting?: SortingState;
  readonly initialFilters?: ColumnFiltersState;
  readonly initialGlobalFilter?: string;
  readonly transformers?: ServerSideTransformers<TData>;
  readonly enabled?: boolean;
  readonly staleTime?: number;
  readonly debounceMs?: number;
}

/** useServerSidePagination return type */
export interface UseServerSidePaginationReturn<TData> {
  // Data
  readonly data: TData[];
  readonly totalRows: number;
  readonly totalPages: number;

  // Loading states
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly isError: boolean;
  readonly error: string | null;

  // State
  readonly pagination: PaginationState;
  readonly sorting: SortingState;
  readonly columnFilters: ColumnFiltersState;
  readonly globalFilter: string;

  // Handlers
  readonly setPagination: (pagination: PaginationState | ((prev: PaginationState) => PaginationState)) => void;
  readonly setSorting: (sorting: SortingState) => void;
  readonly setColumnFilters: (filters: ColumnFiltersState) => void;
  readonly setGlobalFilter: (value: string) => void;
  /**
   * Pass straight to `<DataTable onServerStateChange={...} />`. This is the one wire between
   * the two: the table reports all four slices at once and this applies them.
   *
   * The per-slice setters above are for a page driving the table from its own controls (a
   * tab strip, a date range outside the table). Do not use both for the same slice.
   */
  readonly onServerStateChange: (state: ServerTableState) => void;
  readonly resetFilters: () => void;

  // Actions
  readonly refetch: () => void;
}

/** useInlineEdit options */
export interface UseInlineEditOptions<TData> {
  readonly onSave: (rowId: string, data: Partial<TData>) => Promise<void>;
  readonly onError?: (error: Error, rowId: string) => void;
  readonly onSuccess?: (rowId: string) => void;
}

/** useInlineEdit return type */
export interface UseInlineEditReturn<TData> {
  readonly editingRowId: string | null;
  readonly editingData: Partial<TData>;
  readonly isEditing: (rowId: string) => boolean;
  readonly isSaving: boolean;
  readonly error: string | null;
  readonly startEdit: (row: Row<TData>) => void;
  readonly cancelEdit: () => void;
  readonly updateField: (field: keyof TData, value: unknown) => void;
  readonly saveEdit: () => Promise<void>;
  readonly clearError: () => void;
}

/** useColumnOrdering return type */
export interface UseColumnOrderingReturn {
  readonly draggedColumn: string | null;
  readonly dragOverColumn: string | null;
  readonly isDragging: boolean;
  readonly handleDragStart: (columnId: string) => void;
  readonly handleDragOver: (columnId: string) => void;
  readonly handleDragEnd: (dropEffect?: string) => void;
  readonly handleDragCancel: () => void;
  /** Move `columnId` to the current position of `targetId`. Used by drag-drop and keyboard reordering. */
  readonly moveColumn: (columnId: string, targetId: string) => void;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/** Props for filter components */
export interface FilterComponentProps<TData = unknown> {
  readonly column: Column<TData>;
  readonly table: Table<TData>;
}

/** Props for cell components */
export interface CellComponentProps<TData extends RowData, TValue = unknown> {
  readonly cell: Cell<TData, TValue>;
  readonly row: Row<TData>;
  readonly column: Column<TData, TValue>;
  readonly table: Table<TData>;
  readonly isEditing?: boolean;
}

/** Density config for styling */
export interface DensityConfig {
  readonly rowHeight: number;
  readonly cellPadding: string;
  readonly fontSize: string;
}

/** Density configurations */
export const DENSITY_CONFIG: Record<TableDensity, DensityConfig> = {
  compact: {
    rowHeight: 36,
    cellPadding: '4px 8px',
    fontSize: '0.75rem',
  },
  comfortable: {
    rowHeight: 52,
    cellPadding: '10px 14px',
    fontSize: '0.8125rem',
  },
  spacious: {
    rowHeight: 64,
    cellPadding: '14px 18px',
    fontSize: '0.875rem',
  },
};

/** Default page size options */
export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/** Default page size */
export const DEFAULT_PAGE_SIZE = 50;

/** Virtualization threshold (rows) */
export const VIRTUALIZATION_THRESHOLD = 100;
