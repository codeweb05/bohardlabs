---
'@vt-labs/datatable': minor
---

With a `tableId`, the saved column layout now holds only what the user changed. A column whose visibility matches its default is not written, and neither is a column order or a pinning equal to the one the props declare. So a default changed in a later release reaches every user who never touched that column, while a user who did keeps their choice. Columns that no longer exist are dropped from the saved entry when it loads, so a renamed or removed column falls back to its default instead of leaving a stray width or a hidden flag behind.

The column prop `hidden` now works: a column declared `hidden: true` starts hidden, and that default is never saved. It was declared before but did nothing, so a table that already sets it will now hide that column. `initialColumnVisibility` still wins over it. A column with `enableHiding: false` ignores `hidden`, since the user could never show it again.

`onColumnVisibilityChange` on mount reports the visibility that renders, with columns declared `hidden` as `false`, and fires only when the user has a saved visibility choice.

The entry stays under the same key, `getTableStateStorageKey(tableId)`, and gains a `version: 2` field. An entry written by an earlier version is read as it is, never throws, and is written back once in the new shape. The migration keeps what each user saw: a value that differed from today's defaults is kept as their choice, so for those columns a later default change will not reach them. Sorting, filters, the search, density, page size, page index and grouping are saved exactly as before.
