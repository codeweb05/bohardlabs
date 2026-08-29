import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import type {SxProps, Theme} from '@mui/material';
import {Box, Checkbox, IconButton, TableCell, TableHead, TableRow, Tooltip} from '@mui/material';
import type {Header, SortDirection, Table} from '@tanstack/react-table';
import {flexRender} from '@tanstack/react-table';
import {useEffect, useMemo, useRef, useState} from 'react';

import {useTableCore, useTableUI} from '../DataTableContext.hooks';
import type {PinnedColumnInfo, SxSlot} from '../hooks/useColumnPinning';
import {getPinnedInfo, pinnedHeaderCellSx} from '../hooks/useColumnPinning';
import {useColumnResize} from '../hooks/useColumnResize';
import {useLabels} from '../i18n';
import type {CellOverflowMode, DataTableColumnDef, DensityConfig, HeaderCase, RowData} from '../types';
import {DEFAULT_HEADER_CASE, DENSITY_CONFIG} from '../types';
import {ResizeHandle} from './ResizeHandle';

/** The width a column can be dragged or nudged between. */
const RESIZE_MIN_WIDTH = 50;
const RESIZE_MAX_WIDTH = 500;

function descToDirection(desc: boolean): SortDirection {
  return desc ? 'desc' : 'asc';
}

/**
 * @returns Sort direction string when sorted, false otherwise.
 */
function getSortDirection(sortInfo: {id: string; desc: boolean} | undefined): false | SortDirection {
  return sortInfo ? descToDirection(sortInfo.desc) : false;
}

// Sort icon component - simple and clean
interface SortIconProps {
  readonly isSorted: false | SortDirection;
}

function SortIcon({isSorted}: SortIconProps) {
  // Unsorted state - show neutral icon
  if (isSorted === false) {
    return (
      <UnfoldMoreIcon
        sx={{
          fontSize: '1.125rem',
          color: 'text.disabled',
          ml: 0.5,
        }}
      />
    );
  }

  // Sorted state - show unicode arrow
  return (
    <Box
      component="span"
      sx={{
        ml: 0.5,
        fontSize: '1.125rem',
        color: 'primary.main',
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {isSorted === 'asc' ? '↑' : '↓'}
    </Box>
  );
}

// Sortable header button component
interface SortableHeaderProps {
  readonly children: React.ReactNode;
  readonly isSorted: false | SortDirection;
  readonly onClick: ((event: unknown) => void) | undefined;
}

function SortableHeader({children, isSorted, onClick}: SortableHeaderProps) {
  const labels = useLabels();

  // Determine aria-label based on current sort state
  const getAriaLabel = () => {
    if (isSorted === 'asc') return labels.sortDesc;
    if (isSorted === 'desc') return labels.clearSort;
    return labels.sortAsc;
  };

  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 0.5,
        background: 'none',
        border: 'none',
        padding: 0,
        margin: 0,
        font: 'inherit',
        // The UA stylesheet forces `text-transform: none` on <button>, which would make
        // sortable headers render in a different case from non-sortable ones.
        textTransform: 'inherit',
        color: 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
        minWidth: 0, // CRITICAL: Allow flex children to shrink
        '&:hover': {
          color: 'primary.main',
        },
        '&:focus-visible': {
          outline: (theme) => `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 2,
          borderRadius: 0.5,
        },
        transition: 'color 0.15s ease',
      }}
      aria-label={getAriaLabel()}
    >
      <Box component="span" sx={{fontWeight: isSorted ? 600 : 'inherit', minWidth: 0, flex: 1}}>
        {children}
      </Box>
      <SortIcon isSorted={isSorted} />
    </Box>
  );
}

/**
 * A primitive that changes whenever any row opens or closes. TanStack stores `expanded`
 * either as `true` (everything open) or as a map of the open rows, so both shapes have
 * to collapse into one comparable string.
 */
function expansionKey(expanded: Record<string, boolean> | boolean | undefined): string {
  if (typeof expanded === 'boolean') return String(expanded);
  if (!expanded) return '';
  return Object.keys(expanded)
    .filter((id) => expanded[id])
    .sort((a, b) => a.localeCompare(b))
    .join('|');
}

interface TableHeaderProps<TData extends RowData> {
  readonly table: Table<TData>;
  readonly enableColumnResizing?: boolean;
  readonly enableColumnOrdering?: boolean;
  readonly columnStyles?: Record<string, React.CSSProperties>;
  readonly onColumnDragStart?: (columnId: string) => void;
  readonly onColumnDragOver?: (columnId: string) => void;
  readonly onColumnDragEnd?: () => void;
  readonly defaultOverflow?: CellOverflowMode;
  readonly stickyHeader?: boolean;
  readonly headerCase?: HeaderCase;
  /** Frozen columns, serialized in visual order (see `useColumnPinning`). */
  readonly pinnedColumns?: string;
}

export function TableHeader<TData extends RowData>({
  table,
  enableColumnResizing = false,
  enableColumnOrdering = false,
  columnStyles = {},
  onColumnDragStart,
  onColumnDragOver,
  onColumnDragEnd,
  defaultOverflow = 'ellipsis',
  stickyHeader = false,
  headerCase = DEFAULT_HEADER_CASE,
  pinnedColumns = '',
}: Readonly<TableHeaderProps<TData>>) {
  // P0 fix (1.1): Use granular hook instead of merged context.
  // We also destructure rowSelection and pagination so the React Compiler tracks them
  // as inputs to this component's JSX. Without this, the mapped HeaderCell tree is
  // returned from cache when only pagination/selection changes, and SelectHeaderCell
  // never re-runs to recompute its checked/indeterminate state.
  // `columnOrder` is destructured for the same reason: `table.getHeaderGroups()` reads
  // through the stable `table` reference, so without an order-derived input the compiler
  // serves the cached header row and a reorder moves the cells but not the headers.
  const {sorting: contextSorting, columnVisibility, rowSelection, pagination, columnOrder, expanded} = useTableUI();
  // `columnsVersion` for the same reason again, on the other axis: `header.column.columnDef`
  // is reached through the stable `table`, so swapping the column definitions (a language
  // change, a different set of columns on the same page) leaves the cached header row on
  // screen. The counter is the input that invalidates it.
  const {columnsVersion} = useTableCore<TData>();
  const pageIndex = pagination?.pageIndex ?? 0;
  const pageSize = pagination?.pageSize ?? 0;
  const selectionSignature = rowSelection ? Object.keys(rowSelection).length : 0;
  const orderSignature = columnOrder?.join('|') ?? '';
  // `expanded` for the same reason: the expand-all cell reads `row.getIsExpanded()`
  // through the stable `table`, which the compiler cannot see changing, so without a
  // derived input here the cached header row keeps the button on "expand all" forever.
  const expansionSignature = expansionKey(expanded);

  // Custom resize hook for handling column resize
  const {resizingColumnId, handleResizeStart, resizeColumnBy} = useColumnResize({
    table,
    minWidth: RESIZE_MIN_WIDTH,
    maxWidth: RESIZE_MAX_WIDTH,
  });

  const sortingState = contextSorting || [];
  const isColumnVisible = (columnId: string): boolean => {
    if (!columnVisibility) return true;
    return columnVisibility[columnId] !== false;
  };

  return (
    <TableHead
      data-page-index={pageIndex}
      data-page-size={pageSize}
      data-selection-size={selectionSignature}
      data-column-order={orderSignature}
      data-expansion={expansionSignature}
      data-columns-version={columnsVersion}
      data-pinned-columns={pinnedColumns}
    >
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id}>
          {headerGroup.headers.map((header) => {
            if (!isColumnVisible(header.column.id)) return null;
            return (
              <HeaderCell
                key={header.id}
                header={header}
                table={table}
                enableColumnResizing={enableColumnResizing}
                enableColumnOrdering={enableColumnOrdering}
                columnStyle={columnStyles[header.id]}
                resizingColumnId={resizingColumnId}
                onResizeStart={handleResizeStart}
                onResizeBy={resizeColumnBy}
                onColumnDragStart={onColumnDragStart}
                onColumnDragOver={onColumnDragOver}
                onColumnDragEnd={onColumnDragEnd}
                sortingState={sortingState}
                defaultOverflow={defaultOverflow}
                stickyHeader={stickyHeader}
                pageIndex={pageIndex}
                pageSize={pageSize}
                selectionSignature={selectionSignature}
                orderSignature={orderSignature}
                expansionSignature={expansionSignature}
                columnsVersion={columnsVersion}
                headerCase={headerCase}
                pinnedColumns={pinnedColumns}
              />
            );
          })}
        </TableRow>
      ))}
    </TableHead>
  );
}

interface HeaderCellProps<TData extends RowData> {
  readonly header: Header<TData, unknown>;
  readonly table: Table<TData>;
  readonly enableColumnResizing?: boolean;
  readonly enableColumnOrdering?: boolean;
  readonly columnStyle?: React.CSSProperties;
  readonly resizingColumnId: string | null;
  readonly onResizeStart: (columnId: string, startWidth: number) => (e: React.MouseEvent | React.TouchEvent) => void;
  /** Applies a width delta in one step. The keyboard path on the resize handle. */
  readonly onResizeBy: (columnId: string, currentWidth: number, delta: number) => void;
  readonly onColumnDragStart?: (columnId: string) => void;
  readonly onColumnDragOver?: (columnId: string) => void;
  readonly onColumnDragEnd?: () => void;
  readonly sortingState: Array<{id: string; desc: boolean}>;
  readonly defaultOverflow?: CellOverflowMode;
  readonly stickyHeader?: boolean;
  readonly pageIndex?: number;
  readonly pageSize?: number;
  readonly selectionSignature?: number;
  /** Serialized column order — a render input so a reorder re-renders this cell. */
  readonly orderSignature?: string;
  /** Serialized expansion state — a render input so opening a row re-renders this cell. */
  readonly expansionSignature?: string;
  /** Column-definition counter — a render input so a `columns` swap re-renders this cell. */
  readonly columnsVersion?: number;
  readonly headerCase?: HeaderCase;
  /** Frozen columns, serialized in visual order (see `useColumnPinning`). */
  readonly pinnedColumns?: string;
}

const HEADER_OVERFLOW_STYLES: Record<CellOverflowMode, SxProps<Theme>> = {
  ellipsis: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
    flex: 1,
  },
  wrap: {
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    whiteSpace: 'normal',
    flex: 1,
  },
  truncate: {
    overflow: 'hidden',
    maxWidth: '100%',
    flex: 1,
  },
};

function useHeaderTruncation(
  headerRef: React.RefObject<HTMLTableCellElement | null>,
  overflowMode: CellOverflowMode,
  columnWidth: number,
) {
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    if (overflowMode !== 'ellipsis' && overflowMode !== 'truncate') return;
    const node = headerRef.current;
    if (!node) return;

    const checkTruncation = () => {
      const element = node.querySelector('.header-content');
      if (element) {
        setIsTruncated(element.scrollWidth > element.clientWidth);
      }
    };

    const timeoutId = setTimeout(checkTruncation, 0);
    const initialElement = node.querySelector('.header-content');

    if (!initialElement) {
      return () => clearTimeout(timeoutId);
    }

    const resizeObserver = new ResizeObserver(checkTruncation);
    resizeObserver.observe(initialElement);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [overflowMode, columnWidth, headerRef]);

  return isTruncated;
}

function SelectHeaderCell<TData extends RowData>({
  table,
  densityConfig,
  stickyHeader,
  pageIndex,
  pageSize,
  selectionSignature,
  pinnedSx,
}: Readonly<{
  table: Table<TData>;
  densityConfig: DensityConfig;
  stickyHeader: boolean;
  pageIndex: number;
  pageSize: number;
  selectionSignature: number;
  pinnedSx: SxSlot;
}>) {
  const labels = useLabels();
  // table.getRowModel() / row.getCanSelect() are opaque to React Compiler. The parent
  // (TableHeader) reads pagination + rowSelection from context and passes them in as
  // primitive props so the compiler invalidates this component's cached output whenever
  // page size, page index, or selection changes. Without that, the cached JSX would be
  // returned and the checkbox state would drift out of sync with the visible rows.
  const {rowSelection} = useTableUI();
  // Wrap in useMemo with explicit deps so the React Compiler is forced to recompute when
  // pagination or selection changes. Without this, table.getRowModel() / row.getCanSelect()
  // are opaque to the compiler and it caches the result against the stable `table` reference,
  // leaving the checkbox state stale after page-size changes.
  const {isAllSelected, isIndeterminate} = useMemo(() => {
    const selection = rowSelection ?? {};
    // Compute page rows manually from the pre-pagination row model. table.getRowModel()
    // and table.getPaginationRowModel() can both return stale rows on the same render
    // immediately after a pageSize change due to TanStack's internal memoization, but
    // getPrePaginationRowModel() reflects the post-filter/sort row set correctly. We
    // slice with the current pageIndex/pageSize props (which the parent sources from
    // context) so the result is always in sync with the visible page.
    const allRows = table.getPrePaginationRowModel().rows;
    const start = pageIndex * pageSize;
    const pageRows = pageSize > 0 ? allRows.slice(start, start + pageSize) : allRows;
    const selectableRows = pageRows.filter((row) => row.getCanSelect());
    const selectedOnPage = selectableRows.filter((row) => selection[row.id]).length;
    return {
      isAllSelected: selectableRows.length > 0 && selectedOnPage === selectableRows.length,
      isIndeterminate: selectedOnPage > 0 && selectedOnPage < selectableRows.length,
    };
  }, [table, rowSelection, pageIndex, pageSize]);

  const handleToggle = () => {
    table.toggleAllPageRowsSelected(!isAllSelected);
  };

  return (
    <TableCell
      data-column-id="select"
      data-page-index={pageIndex}
      data-page-size={pageSize}
      data-selection-size={selectionSignature}
      sx={[
        {
          width: 48,
          minWidth: 48,
          maxWidth: 48,
          p: densityConfig.cellPadding,
          textAlign: 'center',
          ...(stickyHeader && {
            position: 'sticky',
            zIndex: 10,
            bgcolor: 'background.paper',
          }),
        },
        pinnedSx,
      ]}
    >
      <Checkbox
        indeterminate={isIndeterminate}
        checked={isAllSelected}
        onChange={handleToggle}
        slotProps={{
          input: {
            'aria-label': labels.selectAll || 'Select all rows',
          },
        }}
        size="small"
        sx={{p: 0, m: '-4px'}}
      />
    </TableCell>
  );
}

function ExpandHeaderCell<TData extends RowData>({
  table,
  densityConfig,
  stickyHeader,
  expansionSignature,
  pinnedSx,
}: Readonly<{
  table: Table<TData>;
  densityConfig: DensityConfig;
  stickyHeader: boolean;
  expansionSignature: string;
  pinnedSx: SxSlot;
}>) {
  const labels = useLabels();
  const hasSelectColumn = table.getAllLeafColumns().some((col) => col.id === 'select');
  const expandLeft = hasSelectColumn ? 48 : 0;

  // Same shape as SelectHeaderCell above. `row.getIsExpanded()` reads through the stable
  // `table`, which the compiler cannot see changing, so the open rows are read off the
  // context state instead: that is a real input and the memo recomputes with it. The
  // signature prop is what gets this component re-rendered in the first place. Without
  // either, `allExpanded` is fixed at its mount value of false, leaving the button
  // labelled "expand all" over already-open rows and making it one-way.
  const {expanded} = useTableUI();
  const allExpanded = useMemo(() => {
    if (typeof expanded === 'boolean') return expanded;
    const openRows = expanded ?? {};
    const rows = table.getRowModel().rows;
    return rows.length > 0 && rows.every((row) => openRows[row.id] === true);
  }, [table, expanded]);

  const handleToggleAllExpand = () => {
    table.toggleAllRowsExpanded(!allExpanded);
  };

  return (
    <TableCell
      data-column-id="expand"
      data-expansion={expansionSignature}
      sx={[
        {
          width: 48,
          minWidth: 48,
          maxWidth: 48,
          p: densityConfig.cellPadding,
          textAlign: 'center',
          ...(stickyHeader && {
            position: 'sticky',
            left: expandLeft,
            zIndex: 10,
            bgcolor: 'background.paper',
          }),
        },
        pinnedSx,
      ]}
    >
      <IconButton
        size="small"
        onClick={handleToggleAllExpand}
        aria-label={allExpanded ? labels.collapseAll : labels.expandAll}
        title={allExpanded ? labels.collapseAllTooltip : labels.expandAllTooltip}
        sx={{p: 0, m: '-4px'}}
      >
        <KeyboardDoubleArrowRightIcon
          fontSize="small"
          sx={{
            transform: allExpanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.2s ease-in-out',
          }}
        />
      </IconButton>
    </TableCell>
  );
}

function ActionsHeaderCell({
  densityConfig,
  stickyHeader,
}: Readonly<{
  densityConfig: DensityConfig;
  stickyHeader: boolean;
}>) {
  const labels = useLabels();

  return (
    <TableCell
      data-column-id="actions"
      sx={{
        width: 56,
        minWidth: 56,
        maxWidth: 56,
        p: densityConfig.cellPadding,
        ...(stickyHeader && {
          position: 'sticky',
          zIndex: 10,
          bgcolor: 'background.paper',
        }),
      }}
    >
      {/* The column is a row of icon buttons and needs no visible heading, but a header
          cell with no text at all reads as an unlabelled column. */}
      <Box
        component="span"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clipPath: 'inset(50%)',
          whiteSpace: 'nowrap',
        }}
      >
        {labels.actions}
      </Box>
    </TableCell>
  );
}

interface RegularHeaderCellProps<TData extends RowData> extends HeaderCellProps<TData> {
  readonly densityConfig: DensityConfig;
  readonly pinnedInfo: PinnedColumnInfo;
  readonly pinnedSx: SxSlot;
}

function RegularHeaderCell<TData extends RowData>({
  header,
  table,
  enableColumnResizing,
  enableColumnOrdering,
  columnStyle,
  resizingColumnId,
  onResizeStart,
  onResizeBy,
  onColumnDragStart,
  onColumnDragOver,
  onColumnDragEnd,
  sortingState,
  defaultOverflow = 'ellipsis',
  stickyHeader = false,
  densityConfig,
  headerCase = DEFAULT_HEADER_CASE,
  pinnedInfo,
  pinnedSx,
}: Readonly<RegularHeaderCellProps<TData>>) {
  const labels = useLabels();
  const columnDef = header.column.columnDef as DataTableColumnDef<TData>;
  const overflowMode = columnDef.overflow ?? defaultOverflow;

  const headerRef = useRef<HTMLTableCellElement>(null);
  const columnWidth = (columnStyle?.width as number) ?? header.getSize();
  const isTruncated = useHeaderTruncation(headerRef, overflowMode, columnWidth);

  const canSort = header.column.getCanSort();
  const canResize = enableColumnResizing && columnDef.enableResizing !== false;
  const isResizing = resizingColumnId === header.id;

  const sortInfo = sortingState.find((s) => s.id === header.id);
  const isSorted: false | SortDirection = getSortDirection(sortInfo);

  const cellContent = header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext());

  const handleResetSize = () => {
    table.setColumnSizing((prev) => {
      const newSizing = {...prev};
      delete newSizing[header.id];
      return newSizing;
    });
  };

  const cellSx: SxSlot = {
    width: columnWidth,
    minWidth: columnDef.minSize ?? 50,
    maxWidth: columnDef.maxSize ?? 500,
    p: densityConfig.cellPadding,
    fontSize: densityConfig.fontSize,
    fontWeight: 600,
    // Overrides the theme's blanket uppercase on `MuiTableCell.head`
    textTransform: headerCase === 'none' ? 'none' : headerCase,
    ...(!stickyHeader && {position: 'relative'}),
    overflow: 'hidden',
    userSelect: 'none',
    textAlign: columnDef.align ?? 'left',
    ...(stickyHeader && {bgcolor: 'background.paper'}),
    // Static per-column pinning. Runtime pinning goes through `pinnedSx` below, which
    // is appended after this object and therefore wins.
    ...(columnDef.sticky &&
      !pinnedInfo.isPinned && {
        position: 'sticky',
        [columnDef.sticky]: 0,
        zIndex: 2,
      }),
  };

  return (
    <TableCell
      ref={headerRef}
      data-column-id={header.column.id}
      colSpan={header.colSpan}
      sx={[cellSx, pinnedSx]}
      draggable={enableColumnOrdering}
      onDragStart={() => onColumnDragStart?.(header.id)}
      onDragOver={(e) => {
        e.preventDefault();
        onColumnDragOver?.(header.id);
      }}
      onDragEnd={onColumnDragEnd}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          pr: canResize ? 1 : 0,
          minWidth: 0,
          width: '100%',
        }}
      >
        {enableColumnOrdering && (
          <Tooltip title={labels.dragToReorder}>
            <DragIndicatorIcon
              sx={{
                fontSize: '1rem',
                color: 'text.secondary',
                cursor: 'grab',
                '&:active': {cursor: 'grabbing'},
              }}
            />
          </Tooltip>
        )}

        <RegularHeaderContent
          headerRef={headerRef}
          cellContent={cellContent}
          overflowMode={overflowMode}
          isTruncated={isTruncated}
          canSort={canSort}
          isSorted={isSorted}
          onSortClick={header.column.getToggleSortingHandler()}
        />
      </Box>

      {canResize && (
        <ResizeHandle
          isResizing={isResizing}
          onMouseDown={onResizeStart(header.id, columnWidth)}
          onTouchStart={onResizeStart(header.id, columnWidth)}
          onDoubleClick={handleResetSize}
          onResizeBy={(delta) => onResizeBy(header.id, columnWidth, delta)}
          width={columnWidth}
          minWidth={RESIZE_MIN_WIDTH}
          maxWidth={RESIZE_MAX_WIDTH}
        />
      )}
    </TableCell>
  );
}

function RegularHeaderContent({
  headerRef,
  cellContent,
  overflowMode,
  isTruncated,
  canSort,
  isSorted,
  onSortClick,
}: Readonly<{
  headerRef: React.RefObject<HTMLTableCellElement | null>;
  cellContent: React.ReactNode;
  overflowMode: CellOverflowMode;
  isTruncated: boolean;
  canSort: boolean;
  isSorted: false | SortDirection;
  onSortClick: ((event: unknown) => void) | undefined;
}>) {
  const tooltipText = getHeaderTooltipText({headerRef, isTruncated, cellContent});
  const supportsTooltip = overflowMode === 'ellipsis' || overflowMode === 'truncate';

  const contentBox = (
    <Box className="header-content" sx={HEADER_OVERFLOW_STYLES[overflowMode]}>
      {cellContent}
    </Box>
  );

  const wrappedContent =
    supportsTooltip && isTruncated && tooltipText ? (
      <Tooltip title={tooltipText} placement="top" arrow>
        <span>{contentBox}</span>
      </Tooltip>
    ) : (
      contentBox
    );

  if (canSort) {
    return (
      <SortableHeader isSorted={isSorted} onClick={onSortClick}>
        {wrappedContent}
      </SortableHeader>
    );
  }
  return wrappedContent;
}

function getHeaderTooltipText({
  headerRef,
  isTruncated,
  cellContent,
}: {
  readonly headerRef: React.RefObject<HTMLTableCellElement | null>;
  readonly isTruncated: boolean;
  readonly cellContent: React.ReactNode;
}): string {
  if (!isTruncated) return '';
  if (typeof cellContent === 'string') return cellContent;
  if (typeof cellContent === 'number') return String(cellContent);
  const node = headerRef.current;
  if (!node) return '';
  const element = node.querySelector('.header-content');
  return element?.textContent ?? '';
}

function HeaderCell<TData extends RowData>(props: Readonly<HeaderCellProps<TData>>) {
  const {density} = useTableUI();
  const densityConfig = DENSITY_CONFIG[density];
  const {
    header,
    table,
    stickyHeader = false,
    pageIndex = 0,
    pageSize = 0,
    selectionSignature = 0,
    expansionSignature = '',
  } = props;

  const columnId = header.column.id;
  const pinnedInfo = getPinnedInfo(props.pinnedColumns, columnId);
  const pinnedSx = pinnedHeaderCellSx(columnId, pinnedInfo);

  if (header.id === 'select') {
    return (
      <SelectHeaderCell
        table={table}
        densityConfig={densityConfig}
        stickyHeader={stickyHeader}
        pageIndex={pageIndex}
        pageSize={pageSize}
        selectionSignature={selectionSignature}
        pinnedSx={pinnedSx}
      />
    );
  }
  if (header.id === 'expand') {
    return (
      <ExpandHeaderCell
        table={table}
        densityConfig={densityConfig}
        stickyHeader={stickyHeader}
        expansionSignature={expansionSignature}
        pinnedSx={pinnedSx}
      />
    );
  }
  if (header.id === 'actions') {
    return <ActionsHeaderCell densityConfig={densityConfig} stickyHeader={stickyHeader} />;
  }

  return <RegularHeaderCell {...props} densityConfig={densityConfig} pinnedInfo={pinnedInfo} pinnedSx={pinnedSx} />;
}
