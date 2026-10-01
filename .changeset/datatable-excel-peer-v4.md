---
'@vt-labs/datatable': major
---

The optional `write-excel-file` peer is `^4`. The range used to allow `^3` as well, but
`xlsx` export never worked with it: v3 hands back a promise where v4 hands back a writer,
so the export failed at the click with "toFile is not a function". An app on v3 that
offers `xlsx` needs `write-excel-file@^4`. Nothing changes for an app already on v4, or
one that does not list `xlsx` in `exportFormats`.
