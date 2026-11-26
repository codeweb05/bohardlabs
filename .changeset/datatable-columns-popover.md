---
'@vt-labs/datatable': minor
---

The Columns menu copes with a long column list. A search box at the top matches a column's header text and its id, so `placed_at` finds a column headed "Placed". Give a column `meta: {group: 'Billing'}` and it is listed under a "Billing" heading; groups follow the ungrouped columns, in the order their first column appears, and a drag or an arrow key moves a column only inside its own group. The foot of the menu shows how many columns are hidden and a "Reset columns" button that puts the column order, visibility, widths and freezing back to the table's defaults, and with a `tableId` clears those saved preferences. Sorting, filters, density and the page are left alone; "Reset to default" in the toolbar still resets everything. The menu's list is now built only while it is open, and after an arrow-key move it shows the new order straight away.

`meta.group` is read from TanStack's `meta`, and no type changes: if your app declares its own `ColumnMeta`, add `group?: string` to it. Groups are headings only, not collapsible sections.

Three new keys in `labels`: `searchColumns` ("Search columns", the box's placeholder and accessible name), `hiddenCount(count)` ("Hidden (2)") and `resetColumns` ("Reset columns"). A consumer passing a complete `DataTableLabels` object (rather than a `Partial`) has to add them.
