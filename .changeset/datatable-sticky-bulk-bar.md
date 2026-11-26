---
'@vt-labs/datatable': minor
---

The bulk-action bar can float at the bottom of the viewport. Set `bulkActionsPosition: 'sticky'` and the bar appears there on the first selection, stays in view while the page scrolls, and keeps clear of a phone's home indicator. The default stays `'inline'`, the bar above the table as before. The partial-result message from a `BulkActionResult` shows inside the floating bar too. On mobile the actions stay in the toolbar menu.

With `manualPagination`, once the whole page is selected and `totalRows` is larger, the sticky bar offers "Select all 137 matching". After that the count reads "All 137 matching selected", a confirmation message function receives 137, and the action's `onClick` gets `allMatching: true` in a new second argument, `BulkActionContext`, alongside `state`, the same `ServerTableState` that `onServerStateChange` reports. The rows passed are still the page, so act on `state`'s filters, not the ids. The choice drops as soon as the selection, the filters or the search change. Every action gets the second argument, with `allMatching: false` outside that case; existing actions compile unchanged.

Two new keys in `labels`: `selectAllMatching(count)` and `allMatchingSelected(count)`. A consumer passing a complete `DataTableLabels` object (rather than a `Partial`) has to add them.
