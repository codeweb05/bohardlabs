import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import type {ColumnFiltersState, Table} from '@tanstack/react-table';
import {useState} from 'react';

import {useLabels} from '../i18n';
import type {BulkAction, DataTableColumnDef, ExportFormat, RowData, TableDensity} from '../types';
import {ColumnVisibility} from './ColumnVisibility';
import {DensityToggle} from './DensityToggle';
import {ExportMenu} from './ExportMenu';
import {FilterPanel} from './FilterPanel';
import {GlobalSearch} from './GlobalSearch';

interface DataTableToolbarProps<TData extends RowData> {
  readonly table: Table<TData>;
  // Latest column definitions — passed explicitly so that React Compiler
  // re-renders this component (and its children, like FilterPanel) whenever the
  // caller updates a columnDef field such as `filterConfig.options`.
  // The `table` prop alone is a stable reference and does not signal these changes.
  readonly columns: readonly DataTableColumnDef<TData>[];

  // Global filter
  readonly enableGlobalFilter?: boolean;
  readonly globalFilterPlaceholder?: string;
  readonly globalFilterHelperText?: string;
  readonly globalFilter?: string;
  readonly onGlobalFilterChange?: (value: string) => void;

  // Column ordering
  readonly enableColumnOrdering?: boolean;

  // Column visibility
  readonly enableColumnVisibility?: boolean;

  // Column pinning
  readonly enableColumnPinning?: boolean;

  // Density
  readonly enableDensityToggle?: boolean;
  readonly density?: TableDensity;
  readonly onDensityChange?: (density: TableDensity) => void;

  // Filtering
  readonly enableFiltering?: boolean;
  readonly columnFilters?: ColumnFiltersState;
  readonly onFiltersReset?: () => void;

  // Reset to default
  readonly onResetToDefault?: () => void;

  // Export
  readonly enableExport?: boolean;
  readonly exportFormats?: readonly ExportFormat[];
  readonly exportFileName?: string;
  readonly onExport?: (format: ExportFormat, data: TData[]) => void;

  // Mobile bulk actions
  readonly isMobile?: boolean;
  readonly bulkActions?: readonly BulkAction<TData>[];
  readonly selectedRows?: readonly TData[];
}

export function DataTableToolbar<TData extends RowData>({
  table,
  columns,
  enableGlobalFilter = true,
  globalFilterPlaceholder,
  globalFilterHelperText,
  globalFilter = '',
  onGlobalFilterChange,
  enableColumnVisibility = false,
  enableColumnOrdering = false,
  enableColumnPinning = false,
  enableDensityToggle = false,
  density = 'comfortable',
  onDensityChange,
  enableFiltering = true,
  columnFilters = [],
  onFiltersReset,
  onResetToDefault,
  enableExport = false,
  exportFormats = ['csv'],
  exportFileName = 'export',
  onExport,
  isMobile = false,
  bulkActions,
  selectedRows,
}: Readonly<DataTableToolbarProps<TData>>) {
  const labels = useLabels();
  const [bulkMenuAnchor, setBulkMenuAnchor] = useState<HTMLElement | null>(null);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);

  const hasActiveFilters = columnFilters.length > 0 || globalFilter.length > 0;
  const activeFilterCount = columnFilters.length + (globalFilter ? 1 : 0);
  const showMobileBulkMenu =
    isMobile && bulkActions && bulkActions.length > 0 && selectedRows && selectedRows.length > 0;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: {xs: 'column', sm: 'row'},
        alignItems: {xs: 'stretch', sm: 'center'},
        justifyContent: 'space-between',
        gap: {xs: 2.75, sm: 2},
        px: {xs: 1.5, sm: 2},
        pt: {xs: 1, sm: 1.25},
        pb: {xs: 1, sm: globalFilterHelperText ? 2.5 : 1.25},
        bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)'),
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      {/* Left side - Search and filters */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: {xs: 1, sm: 1.5},
          flex: 1,
          flexWrap: 'wrap',
        }}
      >
        {/* Global Search */}
        {enableGlobalFilter && (
          <GlobalSearch
            value={globalFilter}
            onChange={onGlobalFilterChange ?? (() => {})}
            placeholder={globalFilterPlaceholder}
            helperText={globalFilterHelperText}
          />
        )}

        {/* Active filters indicator */}
        {enableFiltering && hasActiveFilters && (
          <Chip
            label={labels.activeFilters(activeFilterCount)}
            size="small"
            color="primary"
            variant="outlined"
            sx={{
              height: 28,
              fontSize: '0.75rem',
            }}
          />
        )}

        {/* Reset filters button */}
        {enableFiltering && hasActiveFilters && onFiltersReset && (
          <Button
            size="small"
            startIcon={<FilterAltOffIcon sx={{fontSize: '1rem'}} />}
            onClick={onFiltersReset}
            sx={{
              fontSize: {xs: '0.75rem', sm: '0.8125rem'},
              minWidth: 'auto',
              px: 1.5,
            }}
          >
            {labels.resetFilters}
          </Button>
        )}

        {/* Mobile bulk actions menu */}
        {showMobileBulkMenu && (
          <>
            <Chip
              label={`${selectedRows.length} ${labels.selected}`}
              size="small"
              color="primary"
              variant="filled"
              sx={{height: 24, fontSize: '0.75rem', fontWeight: 600}}
            />
            {isBulkActionLoading && <CircularProgress size={18} />}
            <IconButton
              size="small"
              onClick={(e) => setBulkMenuAnchor(e.currentTarget)}
              aria-label={labels.actions}
              disabled={isBulkActionLoading}
              sx={{p: 0.5}}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
            <Menu
              anchorEl={bulkMenuAnchor}
              open={Boolean(bulkMenuAnchor)}
              onClose={() => setBulkMenuAnchor(null)}
              anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
              transformOrigin={{vertical: 'top', horizontal: 'right'}}
              slotProps={{paper: {sx: {minWidth: 160, maxWidth: 280}}}}
            >
              {bulkActions.map((action) => {
                const disabled =
                  isBulkActionLoading ||
                  (typeof action.disabled === 'function'
                    ? action.disabled(selectedRows as TData[])
                    : (action.disabled ?? false));
                return (
                  <MenuItem
                    key={action.id}
                    disabled={disabled}
                    onClick={async () => {
                      setBulkMenuAnchor(null);
                      setIsBulkActionLoading(true);
                      try {
                        await action.onClick(selectedRows as TData[]);
                        // Same as the desktop bar: on success the rows are gone, so the
                        // count chip and the next action must not still point at them.
                        // Left alone on failure so the user can retry the same selection.
                        table.resetRowSelection();
                      } finally {
                        setIsBulkActionLoading(false);
                      }
                    }}
                    sx={{color: action.color ? `${action.color}.main` : undefined}}
                  >
                    {action.icon && (
                      <ListItemIcon sx={{color: action.color ? `${action.color}.main` : undefined, minWidth: 36}}>
                        {action.icon}
                      </ListItemIcon>
                    )}
                    <ListItemText>{action.label}</ListItemText>
                  </MenuItem>
                );
              })}
            </Menu>
          </>
        )}
      </Box>

      {/* Right side - Actions */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          flexShrink: 0,
        }}
      >
        {/* Density toggle */}
        {enableDensityToggle && onDensityChange && <DensityToggle density={density} onChange={onDensityChange} />}

        {/* Column Visibility */}
        {enableColumnVisibility && (
          <>
            {enableDensityToggle && <Divider orientation="vertical" flexItem sx={{mx: 0.5}} />}
            <ColumnVisibility
              table={table}
              enableReordering={enableColumnOrdering}
              enablePinning={enableColumnPinning}
              isMobile={isMobile}
            />
          </>
        )}

        {/* Filter Panel */}
        {enableFiltering && (
          <>
            {(enableDensityToggle || enableColumnVisibility) && (
              <Divider orientation="vertical" flexItem sx={{mx: 0.5}} />
            )}
            <FilterPanel table={table} columns={columns} onReset={onFiltersReset} columnFilters={columnFilters} />
          </>
        )}

        {/* Export */}
        {enableExport && (
          <>
            <Divider orientation="vertical" flexItem sx={{mx: 0.5}} />
            <ExportMenu table={table} formats={exportFormats} fileName={exportFileName} onExport={onExport} />
          </>
        )}

        {/* Reset to Default */}
        {onResetToDefault && (
          <>
            <Divider orientation="vertical" flexItem sx={{mx: 0.5}} />
            <Tooltip title={labels.resetToDefaultTooltip}>
              <IconButton
                size="small"
                onClick={onResetToDefault}
                aria-label={labels.resetToDefault}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'primary.main',
                  },
                }}
              >
                <RestartAltIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>
    </Box>
  );
}
