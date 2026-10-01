import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import KeyboardDoubleArrowLeft from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRight from '@mui/icons-material/KeyboardDoubleArrowRight';
import type {SelectChangeEvent} from '@mui/material';
import {
  Box,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type {Table} from '@tanstack/react-table';
import {useEffect} from 'react';

import {useTableCore, useTableUI} from '../DataTableContext.hooks';
import {useLabels} from '../i18n';
import type {RowData} from '../types';
import {DEFAULT_PAGE_SIZE_OPTIONS} from '../types';

interface DataTablePaginationProps<TData extends RowData> {
  readonly table: Table<TData>;
  readonly totalRows?: number;
  readonly pageSizeOptions?: readonly number[];
  readonly showRowsPerPage?: boolean;
  readonly showPageInfo?: boolean;
  readonly showFirstLastButtons?: boolean;
}

export function DataTablePagination<TData extends RowData>({
  table,
  totalRows,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  showRowsPerPage = true,
  showPageInfo = true,
  showFirstLastButtons = true,
}: Readonly<DataTablePaginationProps<TData>>) {
  // The page count and the row count are read off the table, which TanStack mutates in
  // place. The compiler sees one stable `table` and would serve the counts from mount.
  'use no memo';
  const labels = useLabels();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // P0 fix (1.1): Use granular hook instead of merged context
  const {pagination} = useTableUI();
  // Read for the subscription alone: rows arriving change the counts below and nothing
  // else this component is given.
  useTableCore<TData>();

  // Use pagination from context if available, otherwise fall back to table state
  const {pageIndex, pageSize} = pagination ?? table.getState().pagination;
  const pageCount = table.getPageCount();

  // For manual pagination/filtering (server-side), use totalRows from parent
  // For client-side pagination/filtering, always use filtered row count from table
  const isManualMode = (table.options.manualPagination ?? false) || (table.options.manualFiltering ?? false);
  const filteredRowCount = table.getFilteredRowModel().rows.length;
  const rowCount = isManualMode ? (totalRows ?? filteredRowCount) : filteredRowCount;

  // A persisted page or a deletion can leave a server table beyond its new last page.
  // Move it back so the next request asks for a page that exists. Clamp the values painted
  // before the effect runs as well, so the footer never says e.g. "Page 5 of 2".
  //
  // Only a count above zero says where the last page is. Zero is also what a consumer passes
  // before the first response (`totalRows={data?.meta?.total ?? 0}`), and moving the page
  // then would throw away the one that was stored.
  const hasPages = pageCount > 0;
  const lastPageIndex = Math.max(pageCount - 1, 0);
  const displayedPageIndex = hasPages ? Math.min(pageIndex, lastPageIndex) : pageIndex;
  useEffect(() => {
    if (table.options.manualPagination && hasPages && pageIndex > lastPageIndex) {
      table.setPageIndex(lastPageIndex);
    }
  }, [table, hasPages, pageIndex, lastPageIndex]);

  const currentPage = displayedPageIndex + 1;
  const totalPages = pageCount > 0 ? pageCount : 1;

  // Compute can navigate based on current page index and total pages
  // This ensures correct state even after key-based remounts
  const canPreviousPage = pageIndex > 0;
  const canNextPage = pageIndex < pageCount - 1;

  const handlePageSizeChange = (event: SelectChangeEvent<number>) => {
    const newPageSize = Number(event.target.value);

    // Deselect rows that fall out of the visible page after a size change (typically
    // when shrinking). Rows that remain visible keep their selection, and selections on
    // rows that were already off-screen on other pages are preserved.
    const allRows = table.getPrePaginationRowModel().rows;
    const oldStart = pageIndex * pageSize;
    const oldVisibleIds = allRows.slice(oldStart, oldStart + pageSize).map((row) => row.id);

    const maxPageIndex = allRows.length > 0 ? Math.ceil(allRows.length / newPageSize) - 1 : 0;
    const clampedPageIndex = Math.max(0, Math.min(pageIndex, maxPageIndex));
    const newStart = clampedPageIndex * newPageSize;
    const newVisibleIds = new Set(allRows.slice(newStart, newStart + newPageSize).map((row) => row.id));

    const droppedIds = oldVisibleIds.filter((id) => !newVisibleIds.has(id));

    table.setPageSize(newPageSize);
    if (droppedIds.length > 0) {
      table.setRowSelection((prev) => {
        const next = {...prev};
        for (const id of droppedIds) {
          delete next[id];
        }
        return next;
      });
    }
  };

  // A size that came from the `pageSize` prop or from storage may not be among the options,
  // and a select whose value matches no item renders blank.
  const sizes = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b);

  // Calculate showing range
  const emptyManualPage = Boolean(table.options.manualPagination) && filteredRowCount === 0;
  const startRow = rowCount === 0 || emptyManualPage ? 0 : displayedPageIndex * pageSize + 1;
  const endRow = startRow === 0 ? 0 : Math.min((displayedPageIndex + 1) * pageSize, rowCount);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: {xs: 'column', sm: 'row'},
        alignItems: {xs: 'stretch', sm: 'center'},
        justifyContent: 'space-between',
        gap: {xs: 1.5, sm: 2},
        px: {xs: 1.5, sm: 2},
        py: {xs: 1, sm: 1.25},
        // A wash of the theme's own text colour, so the tint follows a branded palette.
        bgcolor: (muiTheme) => alpha(muiTheme.palette.text.primary, muiTheme.palette.mode === 'dark' ? 0.02 : 0.01),
        borderTop: (muiTheme) => `1px solid ${muiTheme.palette.divider}`,
      }}
    >
      {/* Left side - Row count and page size */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: {xs: 1.5, sm: 2},
          flexWrap: 'wrap',
          justifyContent: {xs: 'space-between', sm: 'flex-start'},
        }}
      >
        {/* Total rows info */}
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            fontSize: {xs: '0.75rem', sm: '0.8125rem'},
            whiteSpace: 'nowrap',
          }}
        >
          {labels.totalRows(rowCount)}
        </Typography>

        {/* Rows per page selector */}
        {showRowsPerPage && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontSize: {xs: '0.75rem', sm: '0.8125rem'},
                display: {xs: 'none', sm: 'block'},
              }}
            >
              {labels.rowsPerPage}
            </Typography>
            <FormControl size="small" sx={{minWidth: 70}}>
              <Select
                value={pageSize}
                onChange={handlePageSizeChange}
                variant="outlined"
                // The "Rows per page" text next to it is hidden below `sm`, and it was
                // never tied to this control anyway, so without an explicit name a screen
                // reader announces only the number.
                slotProps={{input: {'aria-label': labels.rowsPerPage}}}
                sx={{
                  '& .MuiSelect-select': {
                    py: 0.5,
                    fontSize: {xs: '0.75rem', sm: '0.8125rem'},
                  },
                }}
              >
                {sizes.map((size) => (
                  <MenuItem key={size} value={size}>
                    {size}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
      </Box>

      {/* Right side - Page navigation */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: {xs: 0.5, sm: 1},
          justifyContent: {xs: 'center', sm: 'flex-end'},
        }}
      >
        {/* Page info */}
        {showPageInfo && !isMobile && (
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontSize: {xs: '0.75rem', sm: '0.8125rem'},
              whiteSpace: 'nowrap',
              mr: 1,
            }}
          >
            {labels.rowsDisplayed(startRow, endRow, rowCount)}
          </Typography>
        )}

        {/* First page button */}
        {showFirstLastButtons && (
          <IconButton
            size="small"
            onClick={() => table.setPageIndex(0)}
            disabled={!canPreviousPage}
            aria-label={labels.firstPage}
            sx={{
              p: {xs: 0.5, sm: 1},
            }}
          >
            <KeyboardDoubleArrowLeft sx={{fontSize: {xs: '1.25rem', sm: '1.5rem'}}} />
          </IconButton>
        )}

        {/* Previous page button */}
        <IconButton
          size="small"
          onClick={() => table.previousPage()}
          disabled={!canPreviousPage}
          aria-label={labels.previousPage}
          sx={{
            p: {xs: 0.5, sm: 1},
          }}
        >
          <KeyboardArrowLeft sx={{fontSize: {xs: '1.25rem', sm: '1.5rem'}}} />
        </IconButton>

        {/* Page number display */}
        <Typography
          variant="body2"
          sx={{
            fontSize: {xs: '0.75rem', sm: '0.8125rem'},
            px: {xs: 1, sm: 2},
            whiteSpace: 'nowrap',
            fontWeight: 500,
          }}
        >
          {labels.pageOf(currentPage, totalPages)}
        </Typography>

        {/* Next page button */}
        <IconButton
          size="small"
          onClick={() => table.nextPage()}
          disabled={!canNextPage}
          aria-label={labels.nextPage}
          sx={{
            p: {xs: 0.5, sm: 1},
          }}
        >
          <KeyboardArrowRight sx={{fontSize: {xs: '1.25rem', sm: '1.5rem'}}} />
        </IconButton>

        {/* Last page button */}
        {showFirstLastButtons && (
          <IconButton
            size="small"
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!canNextPage}
            aria-label={labels.lastPage}
            sx={{
              p: {xs: 0.5, sm: 1},
            }}
          >
            <KeyboardDoubleArrowRight sx={{fontSize: {xs: '1.25rem', sm: '1.5rem'}}} />
          </IconButton>
        )}
      </Box>
    </Box>
  );
}
