# @vt-labs/datatable

## 1.0.0-next.0

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
