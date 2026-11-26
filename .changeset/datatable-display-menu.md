---
'@vt-labs/datatable': minor
---

A Display menu in the toolbar, behind `enableDisplayMenu` (off by default). It has three items. "Wrap cells" lets long values break onto more lines instead of clipping: it switches `cellOverflow` to `'wrap'` and back, a column's own `overflow` still wins, and the choice is saved per `tableId` and cleared by Reset to Default. "Fullscreen" covers the screen with the table, with `Escape` to leave, and appears only where the browser allows fullscreen. "Fit columns to content" sizes every resizable column to its widest rendered cell, header included, within the column's `minSize` and `maxSize`; it needs `enableColumnResizing` and is not offered on the phone card view. Density keeps its own toolbar button.

Five new keys in `labels`: `display`, `wrapCells`, `fullscreen`, `exitFullscreen` and `fitColumns`. A consumer passing a complete `DataTableLabels` object (rather than a `Partial`) has to add them.
