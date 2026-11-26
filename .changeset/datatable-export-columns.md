---
'@vt-labs/datatable': minor
---

CSV and Excel exports now hold the columns on screen, in the order the user arranged them, so a reordered table exports in that order and a hidden column stays out. Set `enableExport: false` on a column to keep a visible one out of the file. Headings come from `meta.label`, then a string `header`, then the column id made readable (`payout_status` becomes "Payout status"), so a column with a component header no longer exports its raw id. When no column is left to write, the CSV and Excel items are disabled with a tooltip, translatable through the new `exportNoColumns` label. JSON export and `onExport` still receive the records whole.
