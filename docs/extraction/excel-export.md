# Proposal: `@bohardlabs/excel-export`

**Status:** deferred, 2026-08-28. **Source:** `skipwash-admin/src/lib/excel/index.ts`, 67 loc
plus 109 lines of tests. **Apps using it:** 1 of 4.

## What it is

Three functions over `write-excel-file/browser`:

- `createHeaderRow(headers: string[])` returns cells with `fontWeight: 'bold'`.
- `createDataRow(values: string[])` returns plain cells.
- `writeExcelFile(rows, {fileName, sheetName?, columns?})` calls the library, defaulting
  the sheet name to `Sheet1`.

That is the whole surface. It is a naming layer over one dependency, and the tests are
mostly asserting that the arguments arrive in the right order.

## Why it is deferred

It is the wrong shape, not the wrong idea.

Everything a caller passes is already a string. Which means the interesting work, turning a
row of typed domain objects into a row of formatted strings, choosing column widths from
content, formatting dates in the viewer's locale, is done at every call site instead of
once here. A package published in this shape would standardise the boring part and leave the
part that actually differs between four apps unstandardised.

The place that work belongs is the table. `@bohardlabs/datatable` already knows the columns, the
header labels, the accessors, the current filter and sort, and the visible column set. An
export that lives beside the table has to be handed all of that again by the caller; an
export that lives inside it has all of it already. The roadmap in
[`../packages/datatable/roadmap.md`](../packages/datatable/roadmap.md) is where this lands.

The size settles it either way. 67 lines is below the threshold where a package pays for its
own README, versioning, changesets and peer matrix.

## What would change the answer

- The datatable export feature ships and needs xlsx output. Then this code moves into
  `@bohardlabs/datatable` as an internal module, `write-excel-file` becomes an optional peer of
  that package so consumers who only export CSV do not pay for it, and this proposal is
  closed rather than promoted.
- Something other than a table needs xlsx output in two apps. An invoice or a scheduled
  report generator would want a real cell model: number and date and currency types, merged
  cells, column widths, multiple sheets. That is a genuinely different package from this
  one, and it would be worth building, but it would not start from these 67 lines.

## What is worth keeping either way

The tests. 109 lines covering empty rows, empty strings surviving as cells rather than being
dropped, header order preservation, and the sheet name default. Whichever home the code
finds, those cases move with it.

Also worth carrying forward: `write-excel-file/browser`, not `write-excel-file`. The root
entry pulls in a Node path that a bundler cannot tree-shake away, and it is an easy thing to
lose in a move.

## Recommendation

Fold into `@bohardlabs/datatable`'s export feature when that is built. Do not publish separately.
