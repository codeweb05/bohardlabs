/**
 * Every user-facing string the table can render.
 *
 * The table ships English defaults and takes overrides through the `labels` prop, so a
 * consumer wires its own i18n by passing translated values in. The package itself has no
 * i18n runtime: adding one would force every consumer onto the same library.
 *
 * Strings that interpolate are functions rather than templates with placeholders. A
 * function is type-checked at the call site, and it lets a consumer reorder or pluralize
 * for languages whose grammar does not match English.
 *
 * Only the keys passed are replaced; the rest fall back to {@link DEFAULT_LABELS}.
 *
 * @example
 * ```tsx
 * // A module constant, not an inline object: `labels` is compared by identity, and a
 * // literal in JSX is a new object on every render.
 * const FRENCH: Partial<DataTableLabels> = {
 *   globalSearch: 'Rechercher...',
 *   rowsPerPage: 'Lignes par page',
 *   noData: 'Aucune donnée',
 *   pageOf: (current, total) => `Page ${current} sur ${total}`,
 * };
 *
 * <DataTable labels={FRENCH} columns={columns} data={rows} />
 * ```
 *
 * With a runtime i18n library, memoize on the active locale:
 *
 * ```tsx
 * const labels = useMemo(() => ({noData: t('table.empty')}), [t]);
 * ```
 */
export interface DataTableLabels {
  // Generic
  readonly actions: string;
  readonly all: string;
  readonly apply: string;
  readonly cancel: string;
  readonly close: string;
  readonly collapseRow: string;
  readonly confirm: string;
  readonly enterValue: string;
  readonly expandRow: string;
  readonly from: string;
  readonly no: string;
  readonly reset: string;
  readonly save: string;
  readonly search: string;
  readonly select: string;
  readonly to: string;
  readonly yes: string;

  // Toolbar
  readonly activeFilters: (count: number) => string;
  readonly clearAll: string;
  readonly clearSearch: string;
  readonly clearSelection: string;
  readonly clearSort: string;
  readonly columns: string;
  readonly dragToReorder: string;
  readonly filters: string;
  readonly globalSearch: string;
  readonly hideAll: string;
  readonly noActiveFilters: string;
  readonly reorderHint: string;
  readonly resetFilters: string;
  readonly resetToDefault: string;
  readonly resetToDefaultTooltip: string;
  readonly showAll: string;

  // Density
  readonly densityLabel: string;
  readonly densityCompact: string;
  readonly densityComfortable: string;
  readonly densitySpacious: string;

  // Columns
  readonly pinColumn: string;
  readonly pinColumnLabel: (column: string) => string;
  readonly unpinColumn: string;
  readonly unpinColumnLabel: (column: string) => string;
  readonly reorderColumn: (column: string, position: number, total: number) => string;
  readonly resizeColumn: string;
  readonly sortAsc: string;
  readonly sortDesc: string;

  // Expansion
  readonly expandAll: string;
  readonly expandAllTooltip: string;
  readonly collapseAll: string;
  readonly collapseAllTooltip: string;

  // Export
  readonly exportLabel: string;
  readonly exportCsv: string;
  readonly exportExcel: string;
  readonly exportJson: string;

  // Selection
  readonly selectAll: string;
  readonly selected: string;

  // Pagination
  readonly rowsPerPage: string;
  readonly pageOf: (current: number, total: number) => string;
  readonly totalRows: (count: number) => string;
  readonly firstPage: string;
  readonly previousPage: string;
  readonly nextPage: string;
  readonly lastPage: string;

  // States
  readonly loading: string;
  readonly noData: string;
  readonly error: string;
  readonly retry: string;

  // Inline editing
  readonly saveChanges: string;
  readonly discardChanges: string;
  readonly saveFailed: string;
}

export const DEFAULT_LABELS: DataTableLabels = {
  actions: 'Actions',
  all: 'All',
  apply: 'Apply',
  cancel: 'Cancel',
  close: 'Close',
  collapseRow: 'Collapse row',
  confirm: 'Confirm',
  enterValue: 'Enter value',
  expandRow: 'Expand row',
  from: 'From',
  no: 'No',
  reset: 'Reset',
  save: 'Save',
  search: 'Search...',
  select: 'Select...',
  to: 'To',
  yes: 'Yes',

  activeFilters: (count) => `${count} active filter(s)`,
  clearAll: 'Clear All',
  clearSearch: 'Clear search',
  clearSelection: 'Clear selection',
  clearSort: 'Clear sort',
  columns: 'Columns',
  dragToReorder: 'Reorder columns',
  filters: 'Filters',
  globalSearch: 'Search all columns...',
  hideAll: 'Hide All',
  noActiveFilters: 'No active filters',
  reorderHint: 'Drag to reorder columns',
  resetFilters: 'Reset filters',
  resetToDefault: 'Reset to Default',
  resetToDefaultTooltip: 'Reset all filters, column visibility, and column sizes to default',
  showAll: 'Show All',

  densityLabel: 'Density',
  densityCompact: 'Compact',
  densityComfortable: 'Comfortable',
  densitySpacious: 'Spacious',

  pinColumn: 'Freeze to the left',
  pinColumnLabel: (column) => `Freeze ${column} to the left`,
  unpinColumn: 'Unfreeze',
  unpinColumnLabel: (column) => `Unfreeze ${column}`,
  reorderColumn: (column, position, total) => `Reorder ${column}, position ${position} of ${total}`,
  resizeColumn: 'Resize column',
  sortAsc: 'Sort ascending',
  sortDesc: 'Sort descending',

  expandAll: 'Expand All',
  expandAllTooltip: 'Expand all rows',
  collapseAll: 'Collapse All',
  collapseAllTooltip: 'Collapse all rows',

  exportLabel: 'Export',
  exportCsv: 'Export CSV',
  exportExcel: 'Export Excel',
  exportJson: 'Export JSON',

  selectAll: 'Select all rows',
  selected: 'selected',

  rowsPerPage: 'Rows per page',
  pageOf: (current, total) => `Page ${current} of ${total}`,
  totalRows: (count) => `${count} row(s) total.`,
  firstPage: 'First page',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  lastPage: 'Last page',

  loading: 'Loading data...',
  noData: 'No data found',
  error: 'Failed to load data',
  retry: 'Retry',

  saveChanges: 'Save changes',
  discardChanges: 'Discard changes',
  saveFailed: 'Failed to save changes',
};
