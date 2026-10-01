---
'@vt-labs/datatable': minor
---

Two accessible names are now labels, so they can be translated and tell columns apart.

- A column's sort button is named after its column: `Customer, Sort ascending` where every
  one of them used to be just `Sort ascending`. New `labels.sortBy(column, action)` builds the
  name; `action` is your `sortAsc`, `sortDesc` or `clearSort` text, so existing translations
  carry over and a language can put the column wherever its grammar wants it.
- A row's checkbox, in the table and on a phone card, reads from the new
  `labels.selectRow(id)`. It was the hardcoded English `Select row <id>`, which is still the
  default.

A test that finds a sort button by the exact name `Sort ascending` needs the column in the
name now. An object typed as a complete `DataTableLabels` needs the two new keys;
`Partial<DataTableLabels>`, which is what the `labels` prop takes, does not.
