import {Box, LinearProgress, Paper, useMediaQuery, useTheme} from '@mui/material';
import {useEffect, useMemo, useRef} from 'react';

import {DataTableConfigProvider} from './config/ConfigContext';
import {TableContainer} from './core/TableContainer';
import {DataTableProvider} from './DataTableContext';
import {DataTableLabelsProvider} from './i18n';
import {CardView} from './mobile/CardView';
import {DataTablePagination} from './pagination/DataTablePagination';
import {EmptyState} from './states/EmptyState';
import {ErrorState} from './states/ErrorState';
import {LoadingState} from './states/LoadingState';
import {BulkActions} from './toolbar/BulkActions';
import {DataTableToolbar} from './toolbar/DataTableToolbar';
import type {DataTableColumnDef, DataTableProps, RowData} from './types';
import {DEFAULT_HEADER_CASE, DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE_OPTIONS} from './types';
import {useDataTableState} from './useDataTableState';
import {useTableInstance} from './useTableInstance';

/**
 * A server-driven data table: TanStack Table for the engine, MUI for the shell.
 *
 * It owns its own pagination, sorting, filter, search, column and density state, persists
 * that state per `tableId`, and reports the server-facing part as one object through
 * `onServerStateChange`. The consumer turns that into query params and hands back one page
 * of rows plus a total. Nothing about that state is passed in as controlled props, which is
 * what keeps a filter change from fetching twice.
 *
 * Client-side is the same component with the manual flags off, holding the whole dataset.
 *
 * ```tsx
 * // Client-side: hand it everything, it does the rest.
 * <DataTable columns={columns} data={orders} ariaLabel="Orders" />
 * ```
 *
 * ```tsx
 * // Server-side, the intended use.
 * const {serverState, onServerStateChange} = useTableServerState('orders');
 * const {data, isLoading, isFetching, isError, refetch} = useOrders(toParams(serverState));
 *
 * <DataTable
 *   tableId="orders"                       // same id as the hook: it is the persistence key
 *   columns={columns}
 *   data={data?.data ?? []}                // one page
 *   totalRows={data?.meta?.total ?? 0}     // the real size
 *   manualPagination
 *   manualSorting
 *   manualFiltering
 *   isLoading={isLoading}
 *   isFetching={isFetching}
 *   isError={isError}
 *   onRetry={refetch}
 *   onServerStateChange={onServerStateChange}
 *   ariaLabel="Orders"
 * />
 * ```
 *
 * Its parts (headers, cells, toolbar, pager) are deliberately not exported. Everything a
 * consumer influences is a prop, a column definition, or a theme token.
 *
 * @see {@link DataTableProps} for every option, grouped by feature.
 * @see {@link useTableServerState} for the state seeding that avoids a double fetch.
 */
export function DataTable<TData extends RowData>(props: Readonly<DataTableProps<TData>>) {
  const {
    // Data
    columns,
    data,
    totalRows,
    tableId,
    getRowId,

    // Loading/Error states
    isLoading = false,
    isFetching = false,
    isError = false,
    error,
    onRetry,

    // Server-side mode
    manualPagination = false,
    manualSorting = false,
    manualFiltering = false,

    // Pagination
    enablePagination = true,
    pageSize: initialPageSize = DEFAULT_PAGE_SIZE,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    onServerStateChange,

    // Sorting
    enableSorting = true,
    enableMultiSort = false,
    initialSorting = [],

    // Filtering
    enableFiltering = true,
    enableGlobalFilter = true,
    globalFilterPlaceholder,
    globalFilterHelperText,
    initialFilters = [],
    initialGlobalFilter = '',

    // Column management
    enableColumnOrdering = true,
    enableColumnResizing = false,
    enableColumnPinning = true,
    enableColumnVisibility = true,
    initialColumnOrder = [],
    initialColumnPinning = {left: [], right: []},
    initialColumnVisibility = {},
    onColumnOrderChange,
    onColumnVisibilityChange,

    // Row selection
    enableRowSelection = false,
    enableMultiRowSelection = true,
    initialRowSelection = {},
    onRowSelectionChange,
    onSelectionChange,

    // Row actions
    rowActions,
    bulkActions,

    // Inline editing
    onRowEdit,

    // Expanding
    enableExpanding = false,
    renderExpandedRow,
    expandTrigger = 'icon',
    animateExpansion = true,

    // Grouping
    enableGrouping = false,
    initialGrouping = [],

    // Export
    enableExport = false,
    exportFormats = ['csv'],
    exportFileName = 'export',
    onExport,

    // UI
    density: initialDensity = 'comfortable',
    enableDensityToggle = false,
    stickyHeader = false,
    maxHeight,
    emptyMessage,
    showToolbar = true,
    showPagination = true,
    containerSx,
    labels,
    slots,
    dateFormats,
    cellOverflow = 'ellipsis',
    headerCase = DEFAULT_HEADER_CASE,
    getRowSx,

    // Mobile
    mobileBreakpoint = 'sm',
    enableMobileCardView = true,
    renderMobileCard,

    // Events
    onRowClick,
    onRowDoubleClick,
    // Accessibility
    ariaLabel,
  } = props;

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down(mobileBreakpoint));

  // All state management extracted to hook
  const state = useDataTableState({
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
  });

  // Build columns with selection column if enabled
  const tableColumns = useMemo(() => {
    const cols: DataTableColumnDef<TData>[] = [];

    if (enableExpanding) {
      cols.push({
        id: 'expand',
        header: () => null,
        cell: () => null,
        enableSorting: false,
        enableFiltering: false,
        enableResizing: false,
        enableHiding: false,
        size: 48,
        minSize: 48,
        maxSize: 48,
      } as DataTableColumnDef<TData>);
    }

    if (enableRowSelection) {
      cols.push({
        id: 'select',
        header: () => null,
        cell: () => null,
        enableSorting: false,
        enableFiltering: false,
        enableResizing: false,
        enableHiding: false,
        size: 48,
        minSize: 48,
        maxSize: 48,
      } as DataTableColumnDef<TData>);
    }

    const columnsWithDefaults = columns.map((col) => ({
      ...col,
      size: col.size ?? 150,
      minSize: col.minSize ?? 50,
      maxSize: col.maxSize ?? 500,
      enableResizing: col.enableResizing !== false,
      enableHiding: col.enableHiding !== false,
    }));
    cols.push(...columnsWithDefaults);

    if (rowActions && rowActions.length > 0) {
      cols.push({
        id: 'actions',
        header: '',
        cell: () => null,
        enableSorting: false,
        enableFiltering: false,
        enableResizing: false,
        enableHiding: false,
        size: 56,
        minSize: 56,
        maxSize: 56,
      } as DataTableColumnDef<TData>);
    }

    return cols;
  }, [columns, enableExpanding, enableRowSelection, rowActions]);

  // A counter over `tableColumns` identity, mirroring `dataVersion` in useDataTableState.
  // Headers and cell renderers both come off the column definitions and are read through
  // the stable `table` reference, which gives the React Compiler nothing that changes when
  // an app swaps its columns (translating them, or showing a different set on the same
  // page). Without this, the old headers stay on screen over the new data.
  const columnsVersionRef = useRef(0);
  const prevColumnsRef = useRef(tableColumns);
  if (prevColumnsRef.current !== tableColumns) {
    prevColumnsRef.current = tableColumns;
    columnsVersionRef.current += 1;
  }
  const columnsVersion = columnsVersionRef.current;

  const table = useTableInstance({
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
    manualFiltering,
    enableColumnPinning,
    enableColumnResizing,
    enableRowSelection,
    enableMultiRowSelection,
    enableExpanding,
    enableGrouping,
  });

  // Compute selected rows lazily — only when bulk actions or onSelectionChange exist
  const needsSelectedRows = (bulkActions && bulkActions.length > 0) || !!onSelectionChange;
  const selectedRows = useMemo(() => {
    if (!needsSelectedRows) return [];
    return table.getFilteredSelectedRowModel().rows.map((row) => row.original);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, state.rowSelection, needsSelectedRows]);

  // Track previous selection size to detect changes efficiently
  const prevSelectionSizeRef = useRef(0);

  // Notify about selection changes
  useEffect(() => {
    if (!onSelectionChange) return;
    const currentSize = Object.keys(state.rowSelection).length;
    if (currentSize !== prevSelectionSizeRef.current) {
      prevSelectionSizeRef.current = currentSize;
      onSelectionChange(selectedRows);
    }
  }, [state.rowSelection, selectedRows, onSelectionChange]);

  // Handle filters reset from toolbar
  const handleFiltersReset = () => {
    state.handleFiltersChange([]);
    state.handleGlobalFilterChange('');
  };

  // Determine what to render
  const showMobileView = isMobile && enableMobileCardView;
  const hasData = data.length > 0;
  const hasSelection = Object.keys(state.rowSelection).length > 0;
  const showBulkActions = bulkActions && bulkActions.length > 0 && hasSelection && selectedRows.length > 0;

  // Compute visible column count for loading state (fix 3.1)
  const visibleColumnCount = useMemo(() => {
    let count = 0;
    for (const col of tableColumns) {
      const colId = col.id;
      if (colId && state.columnVisibility[colId] === false) continue;
      count++;
    }
    return count;
  }, [tableColumns, state.columnVisibility]);

  return (
    <DataTableLabelsProvider labels={labels}>
      <DataTableConfigProvider slots={slots} dateFormats={dateFormats}>
        <DataTableProvider
          table={table}
          density={state.density}
          setDensity={state.setDensity}
          isMobile={isMobile}
          onRowEdit={onRowEdit}
          rowSelection={state.rowSelection}
          pagination={state.pagination}
          columnSizing={state.columnSizing}
          columnVisibility={state.columnVisibility}
          columnOrder={state.columnOrder}
          columnPinning={state.columnPinning}
          sorting={state.sorting}
          expanded={state.expanded}
          dataVersion={state.dataVersion}
          columnsVersion={columnsVersion}
        >
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              overflow: 'hidden',
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              bgcolor: 'background.paper',
              ...containerSx,
            }}
          >
            {/* Toolbar */}
            {showToolbar && (
              <DataTableToolbar
                table={table}
                columns={tableColumns}
                enableGlobalFilter={enableGlobalFilter}
                globalFilterPlaceholder={globalFilterPlaceholder}
                globalFilterHelperText={globalFilterHelperText}
                globalFilter={state.globalFilter}
                onGlobalFilterChange={state.handleGlobalFilterChange}
                enableColumnOrdering={enableColumnOrdering}
                enableColumnPinning={enableColumnPinning}
                enableDensityToggle={enableDensityToggle}
                density={state.density}
                onDensityChange={state.setDensity}
                enableFiltering={enableFiltering}
                columnFilters={state.columnFilters}
                onFiltersReset={handleFiltersReset}
                onResetToDefault={state.handleResetToDefault}
                enableColumnVisibility={enableColumnVisibility}
                enableExport={enableExport}
                exportFormats={exportFormats}
                exportFileName={exportFileName}
                onExport={onExport}
                isMobile={isMobile}
                bulkActions={bulkActions}
                selectedRows={selectedRows}
              />
            )}

            {/* Bulk Actions Bar (desktop only) */}
            {showBulkActions && !isMobile && <BulkActions table={table} actions={bulkActions} />}

            {/* Main Content */}
            <Box sx={{position: 'relative'}} data-testid="data-table-content">
              {/* Background fetch indicator */}
              {isFetching && !isLoading && (
                <LinearProgress
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    zIndex: 1,
                  }}
                />
              )}

              {/* Loading State — render skeleton rows at the resolved page size so the scroll
                container keeps full height during the load. Without this, server-side tables
                collapse to a short skeleton on the first render after a back-navigation, and
                the router restores scroll against the short container (jumping toward the top)
                before the real rows render a tick later. */}
              {isLoading && (
                <LoadingState columns={visibleColumnCount} rows={state.pagination.pageSize} density={state.density} />
              )}

              {/* Error State */}
              {!isLoading && isError && <ErrorState error={error} onRetry={onRetry} />}

              {/* Empty State */}
              {!isLoading && !isError && !hasData && <EmptyState message={emptyMessage} />}

              {/* Data Display */}
              {!isLoading && !isError && hasData && (
                <>
                  {showMobileView ? (
                    <CardView
                      table={table}
                      rowActions={rowActions}
                      renderCard={renderMobileCard}
                      onRowClick={onRowClick}
                      enableExpanding={enableExpanding}
                      renderExpandedRow={renderExpandedRow}
                      animateExpansion={animateExpansion}
                      ariaLabel={ariaLabel}
                    />
                  ) : (
                    <TableContainer
                      table={table}
                      stickyHeader={stickyHeader}
                      maxHeight={maxHeight}
                      enableColumnResizing={enableColumnResizing}
                      enableColumnPinning={enableColumnPinning}
                      columnSizing={state.columnSizing}
                      rowActions={rowActions}
                      onRowClick={onRowClick}
                      onRowDoubleClick={onRowDoubleClick}
                      defaultOverflow={cellOverflow}
                      headerCase={headerCase}
                      enableExpanding={enableExpanding}
                      expandTrigger={expandTrigger}
                      renderExpandedRow={renderExpandedRow}
                      animateExpansion={animateExpansion}
                      getRowSx={getRowSx}
                      ariaLabel={ariaLabel}
                    />
                  )}
                </>
              )}
            </Box>

            {/* Pagination */}
            {showPagination && enablePagination && hasData && !isLoading && !isError && (
              <DataTablePagination table={table} totalRows={totalRows} pageSizeOptions={pageSizeOptions} />
            )}
          </Paper>
        </DataTableProvider>
      </DataTableConfigProvider>
    </DataTableLabelsProvider>
  );
}
