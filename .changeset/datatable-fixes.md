---
'@vt-labs/datatable': patch
---

Fixes found by a critical pass over the table. No prop, export or label key changed.

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
- A `Date` cell is written as an ISO string. It was an empty cell.
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
