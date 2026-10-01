---
'@vt-labs/datatable': minor
---

Sorting no longer changes the page.

- `useServerSidePagination().setSorting` keeps the current page. It used to return to page
  one, while a `DataTable` reporting through `onServerStateChange` kept the page, so the two
  ways of wiring a server-driven table disagreed.
- A table holding the whole dataset keeps its page when it is sorted and when a new `data`
  array arrives (a refetch). It used to jump back to page one on both.
- When rows go away under the current page (a delete, a refetch with fewer rows), the table
  moves to the last page that still has rows.

A filter or a search still returns to page one.
