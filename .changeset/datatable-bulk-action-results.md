---
'@vt-labs/datatable': minor
---

A bulk action can now report rows that failed on their own. Return a `BulkActionResult` (`{succeeded, failed}`, both lists of row ids as `getRowId` gives them) from a bulk action's `onClick`, and the rows that failed stay selected for a retry while the rest leave the selection. On desktop the bulk bar shows a message such as "8 updated, 2 failed. The 2 failed rows are still selected.", which closes from its button or once the selection changes. The new `onBulkActionResult(action, result)` prop hears every result, for logging or a toast; on mobile it is the only report. An action that returns nothing behaves exactly as before, and existing actions compile unchanged.

The message is translatable through the new `bulkResult(succeeded, failed)` key in `labels`. A consumer passing a complete `DataTableLabels` object (rather than a `Partial`) has to add it.
