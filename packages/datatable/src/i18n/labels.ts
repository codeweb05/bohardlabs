import type {FilterOperator} from '../types';

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

  // Filter chips (`enableFilterChips`)
  /**
   * One chip's text. `operator` comes from `filterOperator` and `value` is already
   * formatted: an option's label, a date in `dateFormats.display`, or `filterRange`.
   */
  readonly filterChip: (column: string, operator: string, value: string) => string;
  /**
   * The words for the comparison a filter sends. A range with one end set reads as
   * `atLeast`/`atMost` for a number and `after`/`before` for a date. A translation written as
   * a full `Record` over these operators needs a new key whenever `FilterOperator` gains a
   * member, which can happen in a minor release.
   */
  readonly filterOperator: (operator: FilterOperator | 'atLeast' | 'atMost' | 'after' | 'before') => string;
  /** Both ends of a range, after the `between` operator: "10 and 50". */
  readonly filterRange: (from: string, to: string) => string;
  /** The chip for the search box. */
  readonly filterSearch: (term: string) => string;
  /** The accessible name of a chip's remove button. `chip` is the chip's text. */
  readonly removeFilter: (chip: string) => string;
  /** The button at the end of the chip row that clears every filter and the search. */
  readonly clearAllFilters: string;

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
  /** The search box at the top of the Columns menu: its placeholder and its accessible name. */
  readonly searchColumns: string;
  /** The count at the foot of the Columns menu of the columns the user can show again. */
  readonly hiddenCount: (count: number) => string;
  /** Puts the column order, visibility, widths and freezing back to the table's defaults. */
  readonly resetColumns: string;
  readonly resizeColumn: string;
  readonly sortAsc: string;
  readonly sortDesc: string;
  /**
   * The accessible name of a column's sort button. `action` is what the next click does,
   * already translated: `sortAsc`, `sortDesc` or `clearSort`.
   */
  readonly sortBy: (column: string, action: string) => string;
  /** The sort button above the cards on a phone, and the name of its menu, while nothing is sorted. */
  readonly sortMenu: string;
  /** The accessible name of that sort button once a column is sorted. `column` is the column's card label. */
  readonly sortedBy: (column: string, desc: boolean) => string;

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
  /** Tooltip on CSV and Excel when every visible column is hidden or has `enableExport: false`. */
  readonly exportNoColumns: string;
  /** Heads the formats that export the rows on screen, when `exportRows` is set. */
  readonly exportCurrentPage: (count: number) => string;
  /** Heads the formats that fetch every matching row through `exportRows`. `count` is `totalRows`. */
  readonly exportAllMatching: (count: number) => string;
  /** Heads the formats under server paging without `exportRows`, so the file is never silently one page. */
  readonly exportCurrentPageOnly: (count: number) => string;
  /** Under "All matching" when `count` is over `exportRowLimit`: the file will hold the first `limit` rows. */
  readonly exportRowLimitReached: (count: number, limit: number) => string;
  /** Shown in the menu while `exportRows` is fetching. */
  readonly exportPreparing: string;
  /** Shown in the menu after `exportRows` rejected. */
  readonly exportFailed: string;

  // Selection
  readonly selectAll: string;
  /** The accessible name of one row's checkbox. `id` is the row's id. */
  readonly selectRow: (id: string) => string;
  readonly selected: string;
  /**
   * Shown above the rows after a bulk action that returned a `BulkActionResult`. The rows
   * that failed stay selected, so the text can say so.
   */
  readonly bulkResult: (succeeded: number, failed: number) => string;
  /**
   * The sticky bulk bar's offer to widen a full page to every row the filters match. `count`
   * is `totalRows`.
   */
  readonly selectAllMatching: (count: number) => string;
  /** The sticky bulk bar's count once the user took that offer. */
  readonly allMatchingSelected: (count: number) => string;

  // Pagination
  readonly rowsPerPage: string;
  readonly pageOf: (current: number, total: number) => string;
  readonly totalRows: (count: number) => string;
  readonly rowsDisplayed: (from: number, to: number, count: number) => string;
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

/** `1 row`, `1,284 rows`. */
function rowCount(count: number): string {
  return `${count.toLocaleString('en')} ${count === 1 ? 'row' : 'rows'}`;
}

const FILTER_OPERATOR_WORDS: Record<Parameters<DataTableLabels['filterOperator']>[0], string> = {
  equals: 'is',
  in: 'is any of',
  notEquals: 'is not',
  contains: 'contains',
  startsWith: 'starts with',
  endsWith: 'ends with',
  greaterThan: 'is greater than',
  lessThan: 'is less than',
  between: 'between',
  isEmpty: 'is empty',
  isNotEmpty: 'is not empty',
  atLeast: 'at least',
  atMost: 'at most',
  after: 'after',
  before: 'before',
};

function bulkResult(succeeded: number, failed: number): string {
  if (failed === 0) return `${succeeded} updated.`;
  const stillSelected =
    failed === 1 ? 'The failed row is still selected.' : `The ${failed} failed rows are still selected.`;
  return `${succeeded} updated, ${failed} failed. ${stillSelected}`;
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

  filterChip: (column, operator, value) => `${column} ${operator} ${value}`,
  filterOperator: (operator) => FILTER_OPERATOR_WORDS[operator],
  filterRange: (from, to) => `${from} and ${to}`,
  filterSearch: (term) => `Search: “${term}”`,
  removeFilter: (chip) => `Remove filter: ${chip}`,
  clearAllFilters: 'Clear all',

  densityLabel: 'Density',
  densityCompact: 'Compact',
  densityComfortable: 'Comfortable',
  densitySpacious: 'Spacious',

  pinColumn: 'Freeze to the left',
  pinColumnLabel: (column) => `Freeze ${column} to the left`,
  unpinColumn: 'Unfreeze',
  unpinColumnLabel: (column) => `Unfreeze ${column}`,
  reorderColumn: (column, position, total) => `Reorder ${column}, position ${position} of ${total}`,
  searchColumns: 'Search columns',
  hiddenCount: (count) => `Hidden (${count})`,
  resetColumns: 'Reset columns',
  resizeColumn: 'Resize column',
  sortAsc: 'Sort ascending',
  sortDesc: 'Sort descending',
  sortBy: (column, action) => `${column}, ${action}`,
  sortMenu: 'Sort',
  sortedBy: (column, desc) => `Sorted by ${column}, ${desc ? 'descending' : 'ascending'}`,

  expandAll: 'Expand All',
  expandAllTooltip: 'Expand all rows',
  collapseAll: 'Collapse All',
  collapseAllTooltip: 'Collapse all rows',

  exportLabel: 'Export',
  exportCsv: 'Export CSV',
  exportExcel: 'Export Excel',
  exportJson: 'Export JSON',
  exportNoColumns: 'No columns to export',
  exportCurrentPage: (count) => `Current page · ${rowCount(count)}`,
  exportAllMatching: (count) => `All matching · ${rowCount(count)}`,
  exportCurrentPageOnly: (count) => `Current page only · ${rowCount(count)}`,
  exportRowLimitReached: (count, limit) =>
    `${count.toLocaleString('en')} rows match. Only the first ${limit.toLocaleString('en')} will be exported.`,
  exportPreparing: 'Preparing export...',
  exportFailed: 'The export failed. Try again.',

  selectAll: 'Select all rows',
  selectRow: (id) => `Select row ${id}`,
  selected: 'selected',
  bulkResult,
  selectAllMatching: (count) => `Select all ${count} matching`,
  allMatchingSelected: (count) => `All ${count} matching selected`,

  rowsPerPage: 'Rows per page',
  pageOf: (current, total) => `Page ${current} of ${total}`,
  totalRows: (count) => `${count} row(s) total.`,
  rowsDisplayed: (from, to, count) => `${from}-${to} of ${count}`,
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
