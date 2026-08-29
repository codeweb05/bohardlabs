import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import {
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type {Column, ColumnFiltersState, Table} from '@tanstack/react-table';
import {useState} from 'react';

import {BooleanFilter} from '../filters/BooleanFilter';
import {DateFilter} from '../filters/DateFilter';
import {NumberFilter} from '../filters/NumberFilter';
import {SelectFilter} from '../filters/SelectFilter';
import {TextFilter} from '../filters/TextFilter';
import {useLabels} from '../i18n';
import type {DataTableColumnDef, RowData} from '../types';

interface FilterPanelProps<TData extends RowData> {
  readonly table: Table<TData>;
  // Latest column definitions. Read filterConfig from these (rather than from
  // `column.columnDef` on the cached table column instance) so that updates to
  // dynamic options (e.g. async-loaded select options) take effect on re-render.
  readonly columns: readonly DataTableColumnDef<TData>[];
  readonly onReset?: () => void;
  readonly columnFilters?: ColumnFiltersState;
}

export function FilterPanel<TData extends RowData>({
  table,
  columns,
  onReset,
  columnFilters = [],
}: Readonly<FilterPanelProps<TData>>) {
  const labels = useLabels();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [open, setOpen] = useState(false);

  // Build a lookup of fresh columnDefs keyed by id so renderFilter sees latest
  // filterConfig (e.g. async-loaded select options) on each render. The table's
  // cached column instance may hold a stale columnDef.
  const columnDefById = new Map<string, DataTableColumnDef<TData>>();
  for (const def of columns) {
    if (def.id != null) columnDefById.set(def.id, def);
  }

  // Get filterable columns
  const filterableColumns = table.getAllLeafColumns().filter((col) => {
    const columnDef = (columnDefById.get(col.id) ?? col.columnDef) as DataTableColumnDef<TData>;
    return columnDef.enableFiltering !== false && col.id !== 'select' && col.id !== 'actions';
  });

  // Count active column filters (global filter is shown separately in toolbar)
  const activeFilterCount = columnFilters.length;

  // Render filter for a column based on its type
  const renderFilter = (column: Column<TData>) => {
    const columnDef = (columnDefById.get(column.id) ?? column.columnDef) as DataTableColumnDef<TData>;
    const filterConfig = columnDef.filterConfig;
    const filterType = filterConfig?.type ?? 'text';

    switch (filterType) {
      case 'select':
        return (
          <SelectFilter column={column} options={filterConfig?.options ?? []} placeholder={filterConfig?.placeholder} />
        );
      case 'number':
        return (
          <NumberFilter
            column={column}
            min={filterConfig?.min}
            max={filterConfig?.max}
            placeholder={filterConfig?.placeholder}
          />
        );
      case 'date':
        return <DateFilter column={column} placeholder={filterConfig?.placeholder} />;
      case 'boolean':
        return <BooleanFilter column={column} />;
      case 'custom':
        if (filterConfig?.renderFilter) {
          return (
            <>
              {filterConfig.renderFilter({
                column: column as Column<unknown>,
                value: column.getFilterValue(),
                onChange: (value) => column.setFilterValue(value),
              })}
            </>
          );
        }
        return <TextFilter column={column} placeholder={filterConfig?.placeholder} />;
      case 'text':
      default:
        return <TextFilter column={column} placeholder={filterConfig?.placeholder} />;
    }
  };

  const isClearButtonVisible = activeFilterCount > 0 && onReset;

  const filterContent = (
    <Box sx={{p: 2}}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
          <IconButton onClick={() => setOpen(false)} size="small" aria-label={labels.close}>
            <CloseIcon fontSize="small" />
          </IconButton>
          <Typography variant="subtitle1" fontWeight={600}>
            {labels.filters}
          </Typography>
        </Box>
        <Button size="small" onClick={onReset} sx={{visibility: isClearButtonVisible ? 'visible' : 'hidden'}}>
          {labels.clearAll}
        </Button>
      </Box>

      <Divider sx={{mb: 2}} />

      {/* Filter fields */}
      {filterableColumns.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {labels.noActiveFilters}
        </Typography>
      ) : (
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
          {filterableColumns.map((column) => {
            const columnDef = (columnDefById.get(column.id) ?? column.columnDef) as DataTableColumnDef<TData>;
            const label = typeof columnDef.header === 'string' ? columnDef.header : column.id;

            return (
              <Box key={column.id}>
                <Typography variant="caption" color="text.secondary" sx={{mb: 0.5, display: 'block'}}>
                  {label}
                </Typography>
                {renderFilter(column)}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );

  return (
    <>
      <Tooltip title={labels.filters}>
        <IconButton
          onClick={() => setOpen(true)}
          size="small"
          aria-label={labels.filters}
          sx={{
            p: {xs: 0.5, sm: 1},
          }}
        >
          <Badge
            badgeContent={activeFilterCount}
            color="primary"
            sx={{
              '& .MuiBadge-badge': {
                fontSize: '0.625rem',
                height: 16,
                minWidth: 16,
              },
            }}
          >
            <FilterListIcon sx={{fontSize: {xs: '1.25rem', sm: '1.5rem'}}} />
          </Badge>
        </IconButton>
      </Tooltip>

      <Drawer
        anchor={isMobile ? 'bottom' : 'right'}
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: isMobile ? '100%' : 320,
              maxHeight: isMobile ? '80vh' : '100%',
              borderRadius: isMobile ? '16px 16px 0 0' : 0,
            },
          },
        }}
      >
        {filterContent}
      </Drawer>
    </>
  );
}
