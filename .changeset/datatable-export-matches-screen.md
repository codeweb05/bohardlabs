---
'@vt-labs/datatable': minor
---

CSV and Excel export write what the table shows, and a CSV is safe to open.

- A column with its own `cell` exports the text that cell shows: a status chip exports its
  label, a formatted amount exports formatted. It used to export the raw value under the
  cell. A cell that shows no text (an icon, a switch) still exports the value. To read the
  text, the export mounts those cells once for every exported row, out of sight.
- A `Date` in a column with no `cell` is written in `dateFormats.display` (`DD/MM/YYYY`
  unless you set it), never as an ISO string.
- A CSV cell that opens with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading
  `'`, so a spreadsheet shows it as text instead of running it as a formula. Plain numbers
  such as `-5` are left alone. The new `enableCsvFormulaGuard={false}` switches this off
  for a file that a program reads.
- A CSV opens with a UTF-8 byte-order mark, so Excel reads accented and non-Latin text
  correctly. A parser that does not expect one will see it at the start of the first heading.

JSON export is unchanged: it writes the records as they came in. So is `onExport`.
