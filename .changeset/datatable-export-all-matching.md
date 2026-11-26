---
'@vt-labs/datatable': minor
---

Export can now cover every row the filters match, not just the page on screen. Pass `exportRows`, a function that takes the table's current state (sorting, filters, search) and resolves to the rows, and the export menu offers each format twice: "Current page" and "All matching", the second counted from `totalRows`. While the rows load, the menu shows progress and a Cancel item; a failed fetch shows a message in the menu and reports `onExportComplete(format, false)`, as does a cancel. Above `exportRowLimit` (default 10,000) the "All matching" file holds the first 10,000 rows in the table's order, and the menu says so before the click. Fetched rows get the same columns and cell text as the page, and `onExport` receives them when set.

Visible change: under `manualPagination` without `exportRows`, the export menu now carries a "Current page only · n rows" heading, so nobody mistakes the file for the whole list. The new strings are translatable through `exportCurrentPage`, `exportAllMatching`, `exportCurrentPageOnly`, `exportRowLimitReached`, `exportPreparing` and `exportFailed` in `labels`. A consumer passing a complete `DataTableLabels` object (rather than a `Partial`) has to add these keys.
