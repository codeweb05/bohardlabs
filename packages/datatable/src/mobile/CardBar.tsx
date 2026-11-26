import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CheckIcon from '@mui/icons-material/Check';
import SortIcon from '@mui/icons-material/Sort';
import {Box, Button, Checkbox, ListItemIcon, ListItemText, Menu, MenuItem, Typography} from '@mui/material';
import type {Column, Row, Table} from '@tanstack/react-table';
import {useState} from 'react';

import {BOTTOM_RIGHT_ORIGIN} from '../AnchoredMenu';
import {useTableUI} from '../DataTableContext.hooks';
import {DEFAULT_LABELS, useLabels} from '../i18n';
import type {DataTableColumnDef, RowData} from '../types';

interface CardBarProps<TData extends RowData> {
  readonly table: Table<TData>;
  /** The rows on screen: the page the select-all checkbox acts on. */
  readonly rows: readonly Row<TData>[];
  /**
   * `DataTableProps.enableSorting`. The table option cannot stand in for it: TanStack
   * defaults `onSortingChange` and column sortability on whether or not the table sorts.
   */
  readonly enableSorting: boolean;
}

/** The name a card gives a column: the same one its label/value pairs show. */
function columnLabel<TData extends RowData>(column: Column<TData>): string {
  const def = column.columnDef as DataTableColumnDef<TData>;
  return def.mobileLabel ?? (typeof def.header === 'string' ? def.header : column.id);
}

/**
 * The card layout has no header row, so the select-all checkbox and the sort buttons that
 * live there get a bar of their own above the cards. Both write the same table state the
 * header writes, so a selection or a sort made here holds when the layout switches.
 */
export function CardBar<TData extends RowData>({table, rows, enableSorting}: Readonly<CardBarProps<TData>>) {
  // Columns, their sortability and `row.getCanSelect()` are read through the stable `table`,
  // which React Compiler would cache for the life of the mount.
  'use no memo';
  const labels = useLabels();
  const {rowSelection, sorting} = useTableUI();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const canSelect = !!table.options.enableRowSelection;
  // An empty string from a consumer would leave the checkbox unnamed; the header falls back the same way.
  const selectAllLabel = labels.selectAll || DEFAULT_LABELS.selectAll;
  const sortableColumns = enableSorting
    ? table.getAllLeafColumns().filter((column) => column.getIsVisible() && column.getCanSort())
    : [];

  if (!canSelect && sortableColumns.length === 0) return null;

  const selection = rowSelection ?? {};
  // Page-scoped, as the header checkbox is: it selects what is on screen.
  const selectableRows = rows.filter((row) => row.getCanSelect());
  const selectedOnPage = selectableRows.filter((row) => selection[row.id]).length;
  const isAllSelected = selectableRows.length > 0 && selectedOnPage === selectableRows.length;
  const isIndeterminate = selectedOnPage > 0 && !isAllSelected;
  // The whole selection, every page included, as the toolbar counts it.
  const selectedCount = Object.values(selection).filter(Boolean).length;

  // The first sort is the one a card bar shows; a multi-sort from the desktop headers is
  // replaced by whatever is picked here.
  const current = sorting?.[0];
  const sortedColumn = sortableColumns.find((column) => column.id === current?.id);
  const desc = !!current?.desc;

  const sortBy = (id: string, descending: boolean) => {
    table.setSorting([{id, desc: descending}]);
    setAnchorEl(null);
  };

  return (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, px: {xs: 1, sm: 1.5}, pt: {xs: 1, sm: 1.5}}}>
      {canSelect && (
        <>
          <Box component="label" sx={{display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer'}}>
            <Checkbox
              size="small"
              checked={isAllSelected}
              indeterminate={isIndeterminate}
              disabled={selectableRows.length === 0}
              onChange={() => table.toggleAllPageRowsSelected(!isAllSelected)}
              sx={{p: 0.5}}
              slotProps={{
                input: {
                  'aria-label': selectAllLabel,
                  // MUI sets `aria-checked="mixed"` but not the input's own flag; see SelectHeaderCell.
                  ref: (input: HTMLInputElement | null) => {
                    if (input) input.indeterminate = isIndeterminate;
                  },
                },
              }}
            />
            <Typography variant="body2" sx={{color: 'text.secondary'}}>
              {selectedCount > 0 ? `${selectedCount} ${labels.selected}` : selectAllLabel}
            </Typography>
          </Box>
          {selectedCount > 0 && (
            <Button size="small" onClick={() => table.resetRowSelection()}>
              {labels.clearSelection}
            </Button>
          )}
        </>
      )}

      <Box sx={{flex: 1}} />

      {sortableColumns.length > 0 && (
        <>
          <Button
            size="small"
            color="inherit"
            startIcon={<SortIcon />}
            endIcon={sortedColumn && (desc ? <ArrowDownwardIcon /> : <ArrowUpwardIcon />)}
            aria-label={sortedColumn ? labels.sortedBy(columnLabel(sortedColumn), desc) : labels.sortMenu}
            aria-haspopup="menu"
            aria-expanded={anchorEl ? true : undefined}
            onClick={(event) => setAnchorEl(event.currentTarget)}
          >
            {sortedColumn ? columnLabel(sortedColumn) : labels.sortMenu}
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            {...BOTTOM_RIGHT_ORIGIN}
            slotProps={{list: {'aria-label': labels.sortMenu}}}
          >
            {sortableColumns.map((column, index) => {
              const checked = column.id === sortedColumn?.id;
              return (
                <MenuItem
                  key={column.id}
                  role="menuitemradio"
                  aria-checked={checked}
                  divider={!!sortedColumn && index === sortableColumns.length - 1}
                  // Picking another column starts it ascending; picking the current one keeps its direction.
                  onClick={() => sortBy(column.id, checked && desc)}
                >
                  <ListItemIcon>{checked && <CheckIcon fontSize="small" />}</ListItemIcon>
                  <ListItemText>{columnLabel(column)}</ListItemText>
                </MenuItem>
              );
            })}
            {/* A direction means nothing until a column is picked. */}
            {sortedColumn &&
              [false, true].map((direction) => (
                <MenuItem
                  key={direction ? 'desc' : 'asc'}
                  role="menuitemradio"
                  aria-checked={direction === desc}
                  onClick={() => sortBy(sortedColumn.id, direction)}
                >
                  <ListItemIcon>{direction === desc && <CheckIcon fontSize="small" />}</ListItemIcon>
                  <ListItemText>{direction ? labels.sortDesc : labels.sortAsc}</ListItemText>
                </MenuItem>
              ))}
          </Menu>
        </>
      )}
    </Box>
  );
}
