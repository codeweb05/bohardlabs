---
'@vt-labs/datatable': minor
---

A footer row of column totals. Give a column `meta: {aggregate: 'sum'}` (or `'avg'`, `'count'`, `'min'`, `'max'`, `'median'`, `'distinct'`, or your own function over the values) and the table totals every row its filters keep, on every page, not just the one on screen. `meta.formatAggregate` formats a total; by default it is a plain number in the user's locale. The named aggregates read numbers only, so a `null` amount is skipped rather than counted as zero, and with no rows a total is empty rather than `0`. The `Aggregate` type is exported for annotating your own columns.

In server mode (`manualPagination` or `manualFiltering`) the table never adds up the page it holds. Pass the totals your API computed as the new `aggregates` prop, `{amount: 18250.5}`; a column missing from it, or `null` in it, shows an empty cell. The footer appears only while at least one column has a total to show, and not on the phone card view. Subtotals per group are not part of this release.
