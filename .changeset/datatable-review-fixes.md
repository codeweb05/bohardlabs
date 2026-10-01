---
'@vt-labs/datatable': patch
---

A server-driven table whose saved page is beyond the server's new total (rows were deleted,
or the page came back from storage) now moves to the last page that exists instead of
showing "Page 5 of 2" over an empty table. A total of zero moves nothing, so a saved page
survives the first request. `onSelectionChange` now fires for any row id, including an empty
string and ids containing line breaks.
