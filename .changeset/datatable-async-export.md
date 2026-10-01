---
'@vt-labs/datatable': minor
---

`onExport` may return a promise. `onExportComplete` waits for it and reports `false` if it
rejects, so a page that asks its server for the file can show the outcome when the request
ends instead of when the button is clicked. A handler that returns nothing works as before.
