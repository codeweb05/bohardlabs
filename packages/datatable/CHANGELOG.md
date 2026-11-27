# @vt-labs/datatable

## 1.1.0

### Minor Changes

- f342aac: A bulk action can now report rows that failed on their own. Return a `BulkActionResult` (`{succeeded, failed}`, both lists of row ids as `getRowId` gives them) from a bulk action's `onClick`, and the rows that failed stay selected for a retry while the rest leave the selection. On desktop the bulk bar shows a message such as "8 updated, 2 failed. The 2 failed rows are still selected.", which closes from its button or once the selection changes. The new `onBulkActionResult(action, result)` prop hears every result, for logging or a toast; on mobile it is the only report. An action that returns nothing behaves exactly as before, and existing actions compile unchanged.

  The message is translatable through the new `bulkResult(succeeded, failed)` key in `labels`. A consumer passing a complete `DataTableLabels` object (rather than a `Partial`) has to add it.

- 5969cd9: The phone card layout gets the controls the table header has on desktop. A bar above the cards holds a select-all checkbox for the cards on the page (indeterminate when only some are selected), the selection count with a Clear button, and a Sort button. Sort opens a menu of the visible sortable columns, named as the cards name them, and once a column is picked, ascending and descending. It writes the same `sorting` state as the headers, so a sort carries across when the layout switches, and like a header sort it keeps the current page. The bar appears whenever the table selects or sorts, with `renderMobileCard` too; there is no prop to turn it off.

  Two new keys in `labels`: `sortMenu` ("Sort") and `sortedBy(column, desc)` ("Sorted by Placed, descending", the button's accessible name). The rest reuse `selectAll`, `selected`, `clearSelection`, `sortAsc` and `sortDesc`. A consumer passing a complete `DataTableLabels` object (rather than a `Partial`) has to add the two new keys.

- 90d1add: Cards in the phone layout can now open a row on a tap and do nothing else. Set `cardTapAction: 'open'` and a tap calls `onRowClick` without also selecting or expanding the row; selection stays on the card's checkbox, expansion on its chevron button, and a chevron on the right of the card shows that it opens. The default stays `'select'`, so a tap behaves as it always has. The next major makes `'open'` the default whenever `onRowClick` is set.

  Cards can also be reached from the keyboard, whichever mode is set. A card with `onRowClick` or a selection checkbox is a tab stop named by its title, with a focus ring in the theme's primary colour: Enter calls `onRowClick` and Space toggles the selection. A card with neither stays out of the tab order. A card drawn by `renderMobileCard` is your own and ignores the new prop. No new labels.

- 03b749c: The Columns menu copes with a long column list. A search box at the top matches a column's header text and its id, so `placed_at` finds a column headed "Placed". Give a column `meta: {group: 'Billing'}` and it is listed under a "Billing" heading; groups follow the ungrouped columns, in the order their first column appears, and a drag or an arrow key moves a column only inside its own group. The foot of the menu shows how many columns are hidden and a "Reset columns" button that puts the column order, visibility, widths and freezing back to the table's defaults, and with a `tableId` clears those saved preferences. Sorting, filters, density and the page are left alone; "Reset to default" in the toolbar still resets everything. The menu's list is now built only while it is open, and after an arrow-key move it shows the new order straight away.

  `meta.group` is read from TanStack's `meta`, and no type changes: if your app declares its own `ColumnMeta`, add `group?: string` to it. Groups are headings only, not collapsible sections.

  Three new keys in `labels`: `searchColumns` ("Search columns", the box's placeholder and accessible name), `hiddenCount(count)` ("Hidden (2)") and `resetColumns` ("Reset columns"). A consumer passing a complete `DataTableLabels` object (rather than a `Partial`) has to add them.

- 254f036: A Display menu in the toolbar, behind `enableDisplayMenu` (off by default). It has three items. "Wrap cells" lets long values break onto more lines instead of clipping: it switches `cellOverflow` to `'wrap'` and back, a column's own `overflow` still wins, and the choice is saved per `tableId` and cleared by Reset to Default. "Fullscreen" covers the screen with the table, with `Escape` to leave, and appears only where the browser allows fullscreen. "Fit columns to content" sizes every resizable column to its widest rendered cell, header included, within the column's `minSize` and `maxSize`; it needs `enableColumnResizing` and is not offered on the phone card view. Density keeps its own toolbar button.

  Five new keys in `labels`: `display`, `wrapCells`, `fullscreen`, `exitFullscreen` and `fitColumns`. A consumer passing a complete `DataTableLabels` object (rather than a `Partial`) has to add them.

- 6c47104: Export can now cover every row the filters match, not just the page on screen. Pass `exportRows`, a function that takes the table's current state (sorting, filters, search) and resolves to the rows, and the export menu offers each format twice: "Current page" and "All matching", the second counted from `totalRows`. While the rows load, the menu shows progress and a Cancel item; a failed fetch shows a message in the menu and reports `onExportComplete(format, false)`, as does a cancel. Above `exportRowLimit` (default 10,000) the "All matching" file holds the first 10,000 rows in the table's order, and the menu says so before the click. Fetched rows get the same columns and cell text as the page, and `onExport` receives them when set.

  Visible change: under `manualPagination` without `exportRows`, the export menu now carries a "Current page only · n rows" heading, so nobody mistakes the file for the whole list. The new strings are translatable through `exportCurrentPage`, `exportAllMatching`, `exportCurrentPageOnly`, `exportRowLimitReached`, `exportPreparing` and `exportFailed` in `labels`. A consumer passing a complete `DataTableLabels` object (rather than a `Partial`) has to add these keys.

- cae28ae: CSV and Excel exports now hold the columns on screen, in the order the user arranged them, so a reordered table exports in that order and a hidden column stays out. Set `enableExport: false` on a column to keep a visible one out of the file. Headings come from `meta.label`, then a string `header`, then the column id made readable (`payout_status` becomes "Payout status"), so a column with a component header no longer exports its raw id. When no column is left to write, the CSV and Excel items are disabled with a tooltip, translatable through the new `exportNoColumns` label. JSON export and `onExport` still receive the records whole.
- 11642ec: New prop `enableFilterChips` (default `false`) adds a row under the toolbar that says what is narrowing the list: one chip per active column filter and one for the search. Each chip reads the way the request sends it, with the operator the table infers, which is what `useServerSidePagination` sends: "Status is not Cancelled", "Total between 10 and 50", "Items at least 2", "Placed after 01/11/2026". A select shows the option's label, a yes/no shows `labels.yes` or `labels.no`, and a date is written in `dateFormats.display`. A chip's remove button clears that filter, "Clear all" clears every filter and the search, and both go back to page 1. The search chip has no remove button; the search box clears it. With the prop off, nothing changes.

  Six new keys in `labels`: `filterChip(column, operator, value)` (the chip text, so a language can reorder the three parts), `filterOperator(operator)` (the words for each operator, plus `atLeast`, `atMost`, `after` and `before` for a range with one end set), `filterRange(from, to)` ("10 and 50"), `filterSearch(term)`, `removeFilter(chip)` (the remove button's accessible name) and `clearAllFilters` ("Clear all"). A consumer passing a complete `DataTableLabels` object (rather than a `Partial`) has to add them.

- 2e7fe49: With a `tableId`, the saved column layout now holds only what the user changed. A column whose visibility matches its default is not written, and neither is a column order or a pinning equal to the one the props declare. So a default changed in a later release reaches every user who never touched that column, while a user who did keeps their choice. Columns that no longer exist are dropped from the saved entry when it loads, so a renamed or removed column falls back to its default instead of leaving a stray width or a hidden flag behind.

  The column prop `hidden` now works: a column declared `hidden: true` starts hidden, and that default is never saved. It was declared before but did nothing, so a table that already sets it will now hide that column. `initialColumnVisibility` still wins over it. A column with `enableHiding: false` ignores `hidden`, since the user could never show it again.

  `onColumnVisibilityChange` on mount reports the visibility that renders, with columns declared `hidden` as `false`, and fires only when the user has a saved visibility choice.

  The entry stays under the same key, `getTableStateStorageKey(tableId)`, and gains a `version: 2` field. An entry written by an earlier version is read as it is, never throws, and is written back once in the new shape. The migration keeps what each user saw: a value that differed from today's defaults is kept as their choice, so for those columns a later default change will not reach them. Sorting, filters, the search, density, page size, page index and grouping are saved exactly as before.

- 9745277: The bulk-action bar can float at the bottom of the viewport. Set `bulkActionsPosition: 'sticky'` and the bar appears there on the first selection, stays in view while the page scrolls, and keeps clear of a phone's home indicator. The default stays `'inline'`, the bar above the table as before. The partial-result message from a `BulkActionResult` shows inside the floating bar too. On mobile the actions stay in the toolbar menu.

  With `manualPagination`, once the whole page is selected and `totalRows` is larger, the sticky bar offers "Select all 137 matching". After that the count reads "All 137 matching selected", a confirmation message function receives 137, and the action's `onClick` gets `allMatching: true` in a new second argument, `BulkActionContext`, alongside `state`, the same `ServerTableState` that `onServerStateChange` reports. The rows passed are still the page, so act on `state`'s filters, not the ids. The choice drops as soon as the selection, the filters or the search change. Every action gets the second argument, with `allMatching: false` outside that case; existing actions compile unchanged.

  Two new keys in `labels`: `selectAllMatching(count)` and `allMatchingSelected(count)`. A consumer passing a complete `DataTableLabels` object (rather than a `Partial`) has to add them.

- acbb3a6: New `toolbarContent` prop: put your own controls in the toolbar, right after the search box. The table renders them as given and holds none of their state, so a status menu that drives your own query param works without touching the table's filters. `showToolbar={false}` hides them with the rest of the toolbar.
- 5809588: A footer row of column totals. Give a column `meta: {aggregate: 'sum'}` (or `'avg'`, `'count'`, `'min'`, `'max'`, `'median'`, `'distinct'`, or your own function over the values) and the table totals every row its filters keep, on every page, not just the one on screen. `meta.formatAggregate` formats a total; by default it is a plain number in the user's locale. The named aggregates read numbers only, so a `null` amount is skipped rather than counted as zero, and with no rows a total is empty rather than `0`. The `Aggregate` type is exported for annotating your own columns.

  In server mode (`manualPagination` or `manualFiltering`) the table never adds up the page it holds. Pass the totals your API computed as the new `aggregates` prop, `{amount: 18250.5}`; a column missing from it, or `null` in it, shows an empty cell. The footer appears only while at least one column has a total to show, and not on the phone card view. Subtotals per group are not part of this release.

### Patch Changes

- 33ea66b: `enableSorting={false}` now turns sorting off in the desktop headers too. Before, a header still sorted on click and showed the sort arrow.
- 2a17305: The Filters button now includes the active filter count in its accessible name ("Filters, 2 active filter(s)"), so screen readers announce the number its badge shows.
- 4e35e97: The select-all checkbox now sets the input's own indeterminate state when some rows on the page are selected, so screen readers and accessibility checkers agree that it is partly checked.

## 1.0.0

### Major Changes

- 1b30700: The optional `write-excel-file` peer is `^4`. The range used to allow `^3` as well, but
  `xlsx` export never worked with it: v3 hands back a promise where v4 hands back a writer,
  so the export failed at the click with "toFile is not a function". An app on v3 that
  offers `xlsx` needs `write-excel-file@^4`. Nothing changes for an app already on v4, or
  one that does not list `xlsx` in `exportFormats`.

### Minor Changes

- f423e5b: `onExport` may return a promise. `onExportComplete` waits for it and reports `false` if it
  rejects, so a page that asks its server for the file can show the outcome when the request
  ends instead of when the button is clicked. A handler that returns nothing works as before.
- 0a32725: CSV and Excel export write what the table shows, and a CSV is safe to open.

  - A column with its own `cell` exports the text that cell shows: a status chip exports its
    label, a formatted amount exports formatted. It used to export the raw value under the
    cell. A cell that shows no text (an icon, a switch) still exports the value. To read the
    text, the export mounts those cells once for every exported row, out of sight.
  - A `Date` in a column with no `cell` is written in `dateFormats.display` (`DD/MM/YYYY`
    unless you set it), never as an ISO string.
  - A CSV cell that opens with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading
    `'`, so a spreadsheet shows it as text instead of running it as a formula. Plain numbers
    such as `-5` are left alone. The new `enableCsvFormulaGuard={false}` switches this off
    for a file that a program reads.
  - A CSV opens with a UTF-8 byte-order mark, so Excel reads accented and non-Latin text
    correctly. A parser that does not expect one will see it at the start of the first heading.

  JSON export is unchanged: it writes the records as they came in. So is `onExport`.

- 0c0abbb: `useServerSidePagination` sends each column filter with the operator its control means.
  Every filter used to go out as `contains`, including a dropdown, a yes/no and a range.

  - Pass the table's `columns` to the hook and the operator follows each column's
    `filterConfig.type`: `contains` for text, `equals` for a dropdown or a yes/no, `in` for a
    list of dropdown values, `between` for a number or date range, `equals` for a single
    number or day.
  - New `filterConfig.operator` sets the operator for one column, for a server that wants
    something else (`startsWith` for a reference number).
  - Without `columns` the operator is read off the value: a yes/no and a number are `equals`,
    a range is `between`, a list is `in`. Text stays `contains`, and so does a dropdown, which
    the hook cannot tell from text until it has the columns.
  - `FilterOperator` gains `'in'`.

  If your server already accepted `contains` for a yes/no or a range filter, it now receives
  `equals` or `between` for those.

- e0dae7f: Two accessible names are now labels, so they can be translated and tell columns apart.

  - A column's sort button is named after its column: `Customer, Sort ascending` where every
    one of them used to be just `Sort ascending`. New `labels.sortBy(column, action)` builds the
    name; `action` is your `sortAsc`, `sortDesc` or `clearSort` text, so existing translations
    carry over and a language can put the column wherever its grammar wants it.
  - A row's checkbox, in the table and on a phone card, reads from the new
    `labels.selectRow(id)`. It was the hardcoded English `Select row <id>`, which is still the
    default.

  A test that finds a sort button by the exact name `Sort ascending` needs the column in the
  name now. An object typed as a complete `DataTableLabels` needs the two new keys;
  `Partial<DataTableLabels>`, which is what the `labels` prop takes, does not.

- 3ec8c80: Sorting no longer changes the page.

  - `useServerSidePagination().setSorting` keeps the current page. It used to return to page
    one, while a `DataTable` reporting through `onServerStateChange` kept the page, so the two
    ways of wiring a server-driven table disagreed.
  - A table holding the whole dataset keeps its page when it is sorted and when a new `data`
    array arrives (a refetch). It used to jump back to page one on both.
  - When rows go away under the current page (a delete, a refetch with fewer rows), the table
    moves to the last page that still has rows.

  A filter or a search still returns to page one.

### Patch Changes

- 2b1e8a6: Fixes found by a critical pass over the table. No prop, export or label key changed.

  Holding the whole dataset (no `manual*` flags):

  - Clicking a column header reorders the rows. The sort arrow moved and the rows stayed put.
  - The pager follows the data: the row count, page count and next button update when rows
    arrive, when a search narrows them, and when a filter does.
  - The search box still filters with `enableFiltering={false}`. That prop switches column
    filters off; it used to silence search too, client-side and in what `onServerStateChange`
    reported.
  - A `select` filter matches the whole value. Choosing "Open" used to keep "Reopened" rows as
    well, and a dropdown with numeric values matched everything. Case is still ignored.
  - A `date` filter filters. Every row used to drop out as soon as a date was picked. Rows are
    compared by calendar day, both ends of a range included. A column with its own `filterFn`
    keeps it.

  The filter drawer:

  - Opening it no longer reports a state change or sends the table back to page one.
  - A value chosen or typed just before the drawer is closed is applied. Text, dropdown,
    yes/no and date filters used to drop it if the drawer closed within half a second.
  - A number range no longer loses a digit typed at the moment the previous one is applied.
  - With `dateFormats.value` set to a day-first format, a stored date is read back in that
    format. `25/04/2026` used to clear the filter and `03/05/2026` flipped between two dates
    for as long as the drawer was open.
  - The drawer and every control in it has an accessible name: the drawer is "Filters", each
    control is named after its column, and the clear buttons say what they do.
  - The number range placeholders read from `labels.from` and `labels.to`, so they translate.
    They were the hardcoded words "Min" and "Max".

  Selection and bulk actions:

  - On a server-driven table, the header checkbox works on every page. Past page one it stayed
    unticked with every row selected, and a second click could not clear them.
  - With `enablePagination={false}`, the header checkbox is ticked once every row is. It used
    to read as ticked as soon as the first `pageSize` rows were.
  - On a phone, a bulk action with a `confirmMessage` asks before it runs, as it does on a
    desktop. The menu used to run it straight away.

  Export:

  - The file follows the sort on screen. Rows used to come out in the order they were loaded.
  - A `Date` cell is written as a date, in `dateFormats.display`. It was an empty cell.
  - CSV headings are quoted like cells, so a heading with a comma no longer shifts every
    column, and a cell holding a lone carriage return is quoted.
  - `onExportStart` and `onExportComplete` are called. They were accepted and never used. A
    failed export reports `onExportComplete(format, false)` and is logged, where it used to
    leave an unhandled promise rejection.

  Columns:

  - Resizing honours a column's own `minSize` and `maxSize`. A column allowed to be 800px wide
    snapped back to 500 on the first drag.
  - The table's width follows a resize straight away, so the last column no longer overlaps or
    leaves a gap until the next unrelated render.
  - A sortable header carries `aria-sort`, so a screen reader announces the direction.
  - The hidden heading of the actions column is one pixel wide. It was as wide as the column,
    and could be clicked through.

  State:

  - `onServerStateChange` written inline (`onServerStateChange={(s) => setState(s)}`) is
    called once per change. It used to be called again on every render of the page, which
    looped forever when the handler stored the state.
  - Saved state that the table did not write (an older version, a hand-edited entry) is
    ignored slice by slice. A wrong shape for the column order, pinning, sizing, visibility,
    grouping or density used to throw on mount, for that user, on every visit.
  - The toolbar and pager tint come from the theme's text colour. They were fixed black and
    white washes that ignored a branded palette. Under the stock themes nothing moves.

  Elsewhere:

  - `onSelectionChange` fires when the selection changes to different rows of the same count,
    which is every change in single-select mode.
  - A server-driven table keeps its pager when a page comes back empty, so there is a way back
    to a page that has rows.
  - The rows-per-page box shows the current size when `pageSize` is not one of
    `pageSizeOptions`. It was blank.

- da29bfc: A server-driven table whose saved page is beyond the server's new total (rows were deleted,
  or the page came back from storage) now moves to the last page that exists instead of
  showing "Page 5 of 2" over an empty table. A total of zero moves nothing, so a saved page
  survives the first request. `onSelectionChange` now fires for any row id, including an empty
  string and ids containing line breaks.
- 5094984: Four small fixes. No prop, export or label key changed.

  - A bulk action whose `onClick` rejects is logged and the selection is kept, so the same
    rows can be tried again. It used to leave an unhandled promise rejection.
  - `filterConfig.min` and `max` hold a number filter to those limits. A number typed past
    one is filtered as the limit, and the box shows the limit once it is left. `max` used to
    do nothing, and `min` only decided whether a minus sign could be typed.
  - The column menu casts the shadow the theme gives any other popover (`shadows[8]`). It
    had two fixed shadows of its own, one for light and one for dark, so it ignored a theme's
    `shadows` and did not match the export and density menus beside it. Under the stock MUI
    themes the shadow is a little heavier than before.
  - A table with truncating headers, which is the default, renders in a browser with no
    `ResizeObserver`. It used to throw on mount. An export format the menu has no label for
    is listed under its own name, where it was an empty menu item.

## 0.1.0

Initial release.
