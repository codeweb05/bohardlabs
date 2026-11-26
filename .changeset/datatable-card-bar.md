---
'@vt-labs/datatable': minor
---

The phone card layout gets the controls the table header has on desktop. A bar above the cards holds a select-all checkbox for the cards on the page (indeterminate when only some are selected), the selection count with a Clear button, and a Sort button. Sort opens a menu of the visible sortable columns, named as the cards name them, and once a column is picked, ascending and descending. It writes the same `sorting` state as the headers, so a sort carries across when the layout switches, and like a header sort it keeps the current page. The bar appears whenever the table selects or sorts, with `renderMobileCard` too; there is no prop to turn it off.

Two new keys in `labels`: `sortMenu` ("Sort") and `sortedBy(column, desc)` ("Sorted by Placed, descending", the button's accessible name). The rest reuse `selectAll`, `selected`, `clearSelection`, `sortAsc` and `sortDesc`. A consumer passing a complete `DataTableLabels` object (rather than a `Partial`) has to add the two new keys.
