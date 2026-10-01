---
'@vt-labs/datatable': patch
---

Fixes found by a critical pass over the table. No prop, export or label key changed.

Holding the whole dataset (no `manual*` flags):

- Clicking a column header reorders the rows. The sort arrow moved and the rows stayed put.
  A sort now also returns to the first page, as a filter does.
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

Elsewhere:

- `onSelectionChange` fires when the selection changes to different rows of the same count,
  which is every change in single-select mode.
- A server-driven table keeps its pager when a page comes back empty, so there is a way back
  to a page that has rows.
- The rows-per-page box shows the current size when `pageSize` is not one of
  `pageSizeOptions`. It was blank.
