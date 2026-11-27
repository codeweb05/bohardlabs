# Datatable on React Table 9 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `@vt-labs/datatable` from `@tanstack/react-table` 8.21.3 to 9.3.1 and ship it as `@vt-labs/datatable@2.0.0`.

**Architecture:** One module-level `tableFeatures({...})` object registers every feature, row model and
built-in filter and sort function the package uses, and every public type is baked to it, so a
consumer still writes `DataTableColumnDef<Order>[]`. `useTableInstance` moves from
`useReactTable` to `useTable` with a memoized options object. Column pinning moves from
`{left, right}` to `{start, end}` everywhere, and the stored preferences migrate on read.

**Tech Stack:** `@tanstack/react-table` 9.3.1 (depends on `@tanstack/table-core` 9.3.1 and
`@tanstack/react-store` ^0.11.2), React 19, MUI 7/9, Vitest, Storybook with
`@storybook/addon-vitest`.

**Spec:** none written. The plan argues from the upstream migration guide and the 9.3.1 type
declarations. Both ship in the tarball: `pnpm pack @tanstack/react-table@9.3.1` and read
`package/skills/migrate-v8-to-v9/` and `package/dist/*.d.ts`, plus the same for
`@tanstack/table-core@9.3.1`. The ledger entry that asked for this plan is
[`repo/dependency-upgrades.md`](../../../repo/dependency-upgrades.md#tanstackreact-table-923-on-8213).

**Sequencing:** this is queued after the approved mocked features (backlog items 1/5, 6/8,
10/20). Start it on a fresh `main` once those land, and re-run the inventory greps in the API map
first, because line numbers below are from commit `999faae`.

## Global Constraints

- Peer range: `"@tanstack/react-table": "^9.3.1"` in `packages/datatable/package.json`, written out in full, never `catalog:`.
- Catalog: `'@tanstack/react-table': ^9.3.1` in `pnpm-workspace.yaml`.
- Package version after release: `2.0.0`, from a `major` changeset. No other package gets a changeset.
- `react` peer stays `^19.0.0`. v9 itself accepts `react >=18`, so nothing forces a change.
- v9 requires Node `>=20` (`engines` in the tarball). The repo already builds on 20+; the README says so for consumers.
- No `stockFeatures`, no `useLegacyTable`, no `@tanstack/react-table/legacy` import in shipped source. Both are migration aids upstream deprecates.
- `sticky: 'left' | 'right'` on `DataTableColumnDef` is the package's own CSS key and does not change.
- `columnResizeDirection` stays `'ltr'`, so `start` means left and `end` means right in every pinned style.
- Every commit passes `pre-commit`, which runs `pnpm --filter @vt-labs/datatable typecheck` whenever a datatable `.ts`/`.tsx` file is staged. That is why Task 2 is one commit: the bump and the compile fix cannot be split without a red typecheck.
- Coverage for `@vt-labs/datatable` stays at 100%.
- Checks run only through `check-agent` (CLAUDE.md, "Checks"). Every "Run" step below means: send `check-agent` the worktree path and the command, and paste what it printed.
- Text rules from CLAUDE.md apply to the changeset, README and MDX: no em-dashes, no filler.

## Review Focus

1. **A filter or sort that silently stops working.** v9 resolves `'auto'` and string names only from registered functions; an unregistered one returns `undefined` and logs a dev-only warning. A consumer column with no `filterFn` must still filter by substring, numbers must still sort numerically, and the global search must still match. Pinned by Task 1's characterization tests, which must pass unchanged after Task 2.
2. **A user's saved layout lost on upgrade.** Preferences stored by 1.x hold `columnPinning: {left, right}` at `version: 2`. After upgrade they must load as `{start, end}` with the same columns pinned, not be sanitized away. Pinned by Task 3.
3. **An effect or memo that fires on every render.** v9's `useTable` returns a new object whenever the options object or the selected state changes. An inline options literal makes `table` a new identity each render, which re-runs `useLastPageWithRows`'s effect and every memo keyed on `table`. Pinned by Task 4.
4. **Select-all and the page-vs-all decision.** `TableHeader.tsx:413` decides whether the table holds one page by reading `table.options.getPaginationRowModel`, an option that no longer exists, so the check is always true. The header checkbox must still toggle the current page only when the table paginates client-side. Pinned by Task 2's test in `TableHeader.fallbacks.test.tsx`.
5. **Export of all matching rows.** `ExportMenu.tsx:131-133` builds rows with `createRow`, removed in v9. The export must still produce the same cells for rows the table never held. Pinned by Task 2's step on `ExportMenu.allMatching.test.tsx`.

---

## v8 to v9 API map

Line numbers are from `999faae`. "Consumer-visible" means it reaches a stranger through a
public type or prop.

| v8 (this repo)                                                                                                                                                        | v9                                                                                                                                                                                                                                                                     | Where                                                                                                                                                                                                                                                                                                                                                                          | Consumer-visible                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `useReactTable(options)`                                                                                                                                              | `useTable(options)`; `features` required                                                                                                                                                                                                                               | `src/useTableInstance.ts:1-19`, `:124-209`                                                                                                                                                                                                                                                                                                                                     | no                               |
| `getCoreRowModel()`                                                                                                                                                   | removed; the core model is automatic                                                                                                                                                                                                                                   | `src/useTableInstance.ts:83`, `:125-ish`                                                                                                                                                                                                                                                                                                                                       | no                               |
| `getFilteredRowModel`, `getSortedRowModel`, `getPaginationRowModel`, `getExpandedRowModel`, `getGroupedRowModel` options                                              | `rowModels` slots on `tableFeatures`: `filteredRowModel: createFilteredRowModel()`, `sortedRowModel: createSortedRowModel()`, `paginatedRowModel: createPaginatedRowModel()`, `expandedRowModel: createExpandedRowModel()`, `groupedRowModel: createGroupedRowModel()` | `src/useTableInstance.ts:83-99`, `:146`                                                                                                                                                                                                                                                                                                                                        | no                               |
| `table.options.getPaginationRowModel` as "does it paginate"                                                                                                           | gone; use the package's own `enablePagination && !manualPagination`                                                                                                                                                                                                    | `src/core/TableHeader.tsx:413`                                                                                                                                                                                                                                                                                                                                                 | no                               |
| `table.getPrePaginationRowModel()`                                                                                                                                    | `table.getPrePaginatedRowModel()`                                                                                                                                                                                                                                      | `src/core/TableHeader.tsx:408`, `src/pagination/DataTablePagination.tsx:95`                                                                                                                                                                                                                                                                                                    | via `table`                      |
| `table.getState()`                                                                                                                                                    | `table.state` in render (the selected state); `table.atoms.<slice>.get()` in event handlers                                                                                                                                                                            | `src/hooks/useColumnPinning.ts:121,134,139,147`; `src/hooks/useColumnOrdering.ts:27,40,41`; `src/toolbar/ColumnOrdering.tsx:53,103`; `src/pagination/DataTablePagination.tsx:56`; `src/toolbar/performBulkAction.ts:30,42`; `src/toolbar/BulkActions.tsx:36,53`; `src/toolbar/ColumnVisibility.tsx:206,217`; `src/toolbar/ExportMenu.tsx:124` (15 in 8 files), plus 2 in tests | via `table`                      |
| `ColumnPinningState = {left?: string[]; right?: string[]}`                                                                                                            | `{start: string[]; end: string[]}`, both required, no aliases                                                                                                                                                                                                          | `src/DataTable.tsx:120`; `src/storage/preferences.ts:19-21,53-64`; `src/useTableStatePersistence.ts:53-56,73`; `src/useDataTableState.ts:151,447,472,505`; `src/hooks/useColumnPinning.ts:121-147`; `src/hooks/useColumnOrdering.ts:40-41`; `src/toolbar/ColumnOrdering.tsx:103-104`; `src/core/TableContainer.tsx:72`; `src/useTableInstance.ts:110-111`                      | **yes**                          |
| `column.pin('left' \| 'right')`, `getIsPinned() === 'left'`                                                                                                           | `'start' \| 'end'`                                                                                                                                                                                                                                                     | `src/hooks/useColumnPinning.ts` (grep `'left'`/`'right'` in `src/hooks` and `src/toolbar`)                                                                                                                                                                                                                                                                                     | via `table`                      |
| `getLeft*` / `getRight*` methods                                                                                                                                      | `getStart*` / `getEnd*`                                                                                                                                                                                                                                                | none in source; consumers holding `table` may use them                                                                                                                                                                                                                                                                                                                         | via `table`                      |
| table option `enablePinning`                                                                                                                                          | `enableColumnPinning` / `enableRowPinning`                                                                                                                                                                                                                             | source already passes `enableColumnPinning`; `ColumnVisibility.tsx:36,47` has its own internal prop of the same name, untouched                                                                                                                                                                                                                                                | no                               |
| `VisibilityState`                                                                                                                                                     | `ColumnVisibilityState`                                                                                                                                                                                                                                                | `src/types.ts:16-31,658,906,910,1333`; `src/useDataTableState.ts:1-11`; `src/toolbar/ColumnVisibility.tsx:19`                                                                                                                                                                                                                                                                  | **yes** (name only)              |
| `createRow(table, id, original, index, depth)`                                                                                                                        | `constructRow(table, id, original, rowIndex, depth, subRows?, parentId?)`                                                                                                                                                                                              | `src/toolbar/ExportMenu.tsx:6,131-133`                                                                                                                                                                                                                                                                                                                                         | no                               |
| `const {getRowId} = table.options`                                                                                                                                    | still valid; `options` is the raw object passed in                                                                                                                                                                                                                     | `src/toolbar/ExportMenu.tsx:130`                                                                                                                                                                                                                                                                                                                                               | no                               |
| `Table<TData>`, `Row<TData>`, `Column<TData, TValue>`, `Cell<TData, TValue>`, `Header`, `ColumnDef<TData, TValue>`, `CellContext`, `HeaderContext`, `FilterFn<TData>` | `TFeatures` first: `Table<TFeatures, TData>`, `Row<TFeatures, TData>`, `Column<TFeatures, TData, TValue>` and so on                                                                                                                                                    | `src/types.ts:174,197-198,240-242,273,372,376,606-607,919,996,1311,1320,1422,1447-1457`; `src/filters/filterFns.ts:1,15,29,48`; `src/core/aggregate.ts:6,78`; `src/useTableInstance.ts:222`; `src/core/TableContainer.tsx:2`; type-only imports in about 20 more files (grep `from '@tanstack/react-table'`)                                                                   | **yes**                          |
| `ColumnMeta<TData, TValue>` augmentation                                                                                                                              | `ColumnMeta<TFeatures, TData, TValue>`                                                                                                                                                                                                                                 | none in source (meta is read as `unknown` on purpose: `src/core/aggregate.ts:65-70`, `src/core/TableFooter.tsx:58`, `src/toolbar/ExportMenu.tsx:403`, `src/toolbar/ColumnVisibility.tsx:113-120`)                                                                                                                                                                              | **yes** (consumer augmentations) |
| `sortingFn` column option, `SortingFn`, `getSortingFn`                                                                                                                | `sortFn`, `SortFn`, `getSortFn`                                                                                                                                                                                                                                        | none in source; passes through `DataTableColumnDef`                                                                                                                                                                                                                                                                                                                            | **yes**                          |
| `'auto'` filter and sort, built-ins always available                                                                                                                  | resolve only from the `filterFns` / `sortFns` registered in `tableFeatures`                                                                                                                                                                                            | `src/DataTable.tsx:240-244` relies on auto when `defaultFilterFn` returns `undefined`; `src/useTableInstance.ts` passes `globalFilterFn: 'includesString'`                                                                                                                                                                                                                     | **yes** (string names)           |
| `columnSizingInfo`, `onColumnSizingInfoChange`                                                                                                                        | `columnResizing`, `onColumnResizingChange`                                                                                                                                                                                                                             | none in source                                                                                                                                                                                                                                                                                                                                                                 | via `table`                      |
| row/column/cell/header methods as own properties                                                                                                                      | on prototypes; destructuring or spreading them breaks                                                                                                                                                                                                                  | none found in source; Task 2 greps for `const {get` and `...row`/`...column`                                                                                                                                                                                                                                                                                                   | via `table`                      |
| `getIsSomeRowsSelected` = "some but not all"                                                                                                                          | "at least one"                                                                                                                                                                                                                                                         | not used; `src/core/TableHeader.tsx:400-425` computes indeterminate itself                                                                                                                                                                                                                                                                                                     | via `table`                      |
| `RowData = Record<string, unknown> \| ...`                                                                                                                            | `Record<string, any> \| Array<any>`                                                                                                                                                                                                                                    | package's own `RowData` at `src/types.ts:60` (requires `id`) is narrower and still assignable                                                                                                                                                                                                                                                                                  | no                               |
| `flexRender`                                                                                                                                                          | still exported; `FlexRender` component and `table.FlexRender` are new                                                                                                                                                                                                  | `src/core/TableHeader.tsx:636`, `src/editing/EditableCell.tsx:30`, `src/mobile/CardItem.tsx:212,267`, `src/toolbar/ExportMenu.tsx:383`                                                                                                                                                                                                                                         | no                               |
| `'use no memo'` + `eslint-disable react-hooks/incompatible-library` around `useReactTable`                                                                            | re-evaluate; v9 reads through a store, but builder-method reads still need a changing input                                                                                                                                                                            | `src/useTableInstance.ts:121-123`                                                                                                                                                                                                                                                                                                                                              | no                               |

Options that keep their v8 names and meaning: `manualSorting`, `manualFiltering`,
`manualPagination`, `manualGrouping`, `manualExpanding`, `autoResetPageIndex`, `pageCount`,
`rowCount`, `getRowId`, `getRowCanExpand`, `enableColumnPinning`, `columnResizeMode`,
`columnResizeDirection`, `globalFilterFn`, `enableSortingRemoval`, `enableMultiSort`,
`enableRowSelection`, `enableMultiRowSelection`, and every controlled `state.<slice>` with its
`on<Slice>Change`.

## Consumer-facing breaking changes

These are the body of the changeset and of the README's "Upgrading from 1.x" section (Task 7).

1. **Peer is `@tanstack/react-table` ^9.3.1.** The consumer upgrades their own copy. Two majors in one install give two incompatible `Table` types.
2. **Column pinning is `{start, end}`.** `initialColumnPinning`, `DataTableContextValue.columnPinning` and the persisted state use it. Preferences saved by 1.x migrate automatically on first load (Task 3).
3. **`table` from `useTableCore()` / `useDataTable()` / `FilterComponentProps` is a v9 table.** No `getState()` (use `table.state`), `getStart*`/`getEnd*` instead of `getLeft*`/`getRight*`, `getPrePaginatedRowModel()`, and methods that cannot be destructured.
4. **`Row`, `Column`, `Cell`, `CellContext` and `HeaderContext` in callbacks are v9 types** with the package's feature set as the first generic. Affects `cell`, `header` and `footer` renderers, `RowAction`, `BulkAction`, `EditCellProps`, `CustomFilterProps`, `FilterComponentProps`, `CellEventHandlers`, `renderExpandedRow` and `enableRowSelection`.
5. **`DataTableColumnDef` passthrough keys follow v9 `ColumnDef`.** `sortingFn` is now `sortFn`. A string `filterFn` or `sortFn` works only if it names a function the package registers (Task 2 lists them); a function value works as before.
6. **A `ColumnMeta` module augmentation needs three generics:** `interface ColumnMeta<TFeatures extends TableFeatures, TData extends RowData, TValue>`. A v8-shaped augmentation fails to compile.
7. **`VisibilityState` is now `ColumnVisibilityState`** for consumers who import it from react-table to type `initialColumnVisibility` or `onColumnVisibilityChange`. The shape is unchanged.
8. **Node 20 or later**, inherited from react-table 9.

## Decisions this plan needs

Neither parked question in `docs/decisions/open-questions.md` (A, the palette's contrast; B, the
response envelope) touches this port. Three new ones do. All three are answered below;
record them as a decision file in Task 7.

- **D1. Export a `DataTableFeatures` type?** Answered 2026-11-27: **yes**, type-only. Without it a consumer cannot spell `CellContext<DataTableFeatures, Order, string>` for a renderer written outside the column array. It is a semver-locked name. (Task 5.)
- **D2. Keep accepting `{left, right}` in `initialColumnPinning`?** Answered 2026-11-27: **keep a deprecated fallback**, removed in 3.0. `left` maps to `start` and `right` to `end`, the prop type widens to a `@deprecated` union member, and development builds warn once. Task 3 Step 4 is therefore required, not optional. Breaking change 2 in the changeset becomes a deprecation for this prop (the context value and the table's own state are still `{start, end}` only).
- **D3. Let consumers register their own string `filterFn`/`sortFn` names?** Answered 2026-11-27: **no, a fixed registry**. 2.0 registers every built-in name react-table 8 resolved, so any string a 1.x consumer can write keeps working, and custom logic is passed as a function. Opening the registry is a later minor if asked. The `filterFns` list in Task 2 therefore also includes `includesStringSensitive` and `equalsString`, and `sortFns` also includes `alphanumericCaseSensitive` and `textCaseSensitive`, wherever v9 exports them; a v8 name v9 no longer ships is reimplemented in `core/features.ts` with a test, not dropped. `features.test.ts` asserts the full v8 list.

## What stays on v8

Nothing. `@vt-labs/datatable` is the only package that imports `@tanstack/react-table`
(`form` uses `@tanstack/react-form`; `image-editor`, `nestjs-notification-preview` and the planned
packages do not import it). `apps/storybook/package.json:28` uses `catalog:` and moves with the
catalog. No second catalog entry or override is needed.

---

## File structure

- Create `packages/datatable/src/core/features.ts`: the one `tableFeatures({...})` object and `type DataTableFeatures`. Nothing else.
- Create `packages/datatable/src/core/features.test.ts`: which functions the registry resolves.
- Create `packages/datatable/src/types.test-d.test.ts` only if Task 5 needs a home for `expectTypeOf` assertions; otherwise put them in `src/index.test.ts`.
- Modify the files in the API map. No file moves.

---

### Task 1: Characterization tests on v8

Tests that pass today and pin the behaviour v9 can drop silently. They are written first so
Task 2 proves it kept them.

**Files:**

- Test: `packages/datatable/src/DataTable.autoFns.test.tsx` (new)

**Interfaces:**

- Consumes: `DataTable` as a consumer renders it.
- Produces: nothing new; Task 2 must keep this file green without editing its assertions.

- [ ] **Step 1: Write the tests**

  - `filters a text column with no filterFn by case-insensitive substring`: rows `name: 'Alpha' | 'Beta' | 'alphabet'`, a text column with no `filterFn` and no `filterConfig.type`, `initialFilters: [{id: 'name', value: 'alp'}]`, client-side; expect rows `Alpha` and `alphabet`.
  - `filters a number column with no filterFn by range`: values `1, 5, 10`, filter value `[2, 9]`; expect `5`.
  - `sorts a mixed string column alphanumerically`: values `'item 10', 'item 2', 'item 1'`, `initialSorting: [{id: 'name', desc: false}]`; expect `item 1, item 2, item 10`.
  - `sorts a number column numerically`: `10, 9, 100`; expect `9, 10, 100`.
  - `matches the global search across columns`: two text columns, type `'bet'` in the search box; expect only the row whose second column contains `Beta`.

- [ ] **Step 2: Run**

  Run: `vitest run --project @vt-labs/datatable src/DataTable.autoFns.test.tsx`
  Expected: 5 passed. If one fails on v8, the assumption is wrong; fix the test, not the code.

- [ ] **Step 3: Commit**

  `git add packages/datatable/src/DataTable.autoFns.test.tsx`, then
  `test(datatable): pin the automatic filter and sort behaviour before react-table 9`.

---

### Task 2: Bump to v9 and make the package compile

One commit, because the pre-commit typecheck fails at every point between the bump and the last
fix. Do the steps in order and commit once at the end. Behaviour stays the same; the only
deliberate change is the pinning shape.

**Files:**

- Modify: `pnpm-workspace.yaml:22`, `packages/datatable/package.json` (peer), `pnpm-lock.yaml`
- Create: `packages/datatable/src/core/features.ts`, `packages/datatable/src/core/features.test.ts`
- Modify: every source file in the API map, and every test file that imports `@tanstack/react-table` (about 34; grep)
- Modify: `packages/datatable/src/DataTable.stories.tsx:759` (`{start: ['reference'], end: []}`)

**Interfaces:**

- Produces, in `src/core/features.ts`:
  - `export const dataTableFeatures` = `tableFeatures({...})` with: `columnFilteringFeature`, `globalFilteringFeature`, `rowSortingFeature`, `rowPaginationFeature`, `columnOrderingFeature`, `columnPinningFeature`, `columnSizingFeature`, `columnResizingFeature`, `columnVisibilityFeature`, `rowSelectionFeature`, `rowExpandingFeature`, `columnGroupingFeature`; `rowModels` slots `filteredRowModel`, `sortedRowModel`, `paginatedRowModel`, `expandedRowModel`, `groupedRowModel`; `filterFns`: `includesString`, `inNumberRange`, `equals`, `arrIncludes`, `arrIncludesSome`, `arrIncludesAll`, `inDateRange`, `weakEquals`; `sortFns`: `alphanumeric`, `text`, `datetime`, `basic`. Add `rowAggregationFeature` only if grouping needs it at runtime (the package computes totals itself in `core/aggregate.ts`).
  - `export type DataTableFeatures = typeof dataTableFeatures`.
- Every public type in `src/types.ts` takes `DataTableFeatures` as the first argument internally and keeps its current consumer-facing generics: `DataTableColumnDef<TData, TValue>`, `RowAction<TData>`, and so on.
- `useTableInstance` returns `Table<DataTableFeatures, TData>`.

- [ ] **Step 1: Bump**

  `pnpm-workspace.yaml:22` to `'@tanstack/react-table': ^9.3.1`; peer in `packages/datatable/package.json` to `"^9.3.1"`. Run `pnpm install` (this is an install, not a check; it updates the lockfile).

- [ ] **Step 2: Write `features.test.ts`**

  - `registers every filter function the automatic choice can pick`: for each name in `includesString, inNumberRange, equals, arrIncludes, inDateRange, weakEquals`, expect `dataTableFeatures.filterFns?.[name]` to be a function.
  - `registers the sort functions the automatic choice can pick`: same for `alphanumeric, text, datetime, basic`.
  - `registers resizing with sizing, and global filtering with column filtering`: both prerequisite features are present.

- [ ] **Step 3: Write `features.ts`** to the Interfaces block. Check the exact slot keys against `table-core/dist/**/tableFeatures*.d.ts`; the names above are from 9.3.1.

- [ ] **Step 4: Port `useTableInstance.ts`**

  - `useTable({features: dataTableFeatures, ...})`; drop `getCoreRowModel` and the row-model `useMemo`s at `:83-99`. Disabled models become `manual*: true` or `enable*: false`, since the slots are always registered.
  - `:110-111`: `state.columnPinning.start`.
  - Leave `'use no memo'` and the options literal as they are; Task 4 owns identity.
  - `useLastPageWithRows(table: Table<DataTableFeatures, TData>, ...)` at `:222`.

- [ ] **Step 5: Pinning to `{start, end}`** in every file the API map lists for `ColumnPinningState`, including `pin('start')`/`pin('end')` and `getIsPinned()` comparisons. `DataTable.tsx:120` default becomes `{start: [], end: []}`. In `useTableStatePersistence.ts:53-56`, `isPinning` checks `start`/`end`; Task 3 adds the read of old data. `sticky: 'left' | 'right'` stays.

- [ ] **Step 6: `getState()`** to `table.state.<slice>` where the value is read during render (`DataTablePagination.tsx:56`, `ColumnVisibility.tsx:206,217`, `ColumnOrdering.tsx:53`, `BulkActions.tsx:36,53`) and `table.atoms.<slice>.get()` where it is read inside a click or keyboard handler (`useColumnPinning.ts`, `useColumnOrdering.ts`, `performBulkAction.ts`, `ExportMenu.tsx:124`). Check each against v9's `ReactTable` type: if `table.state` is not on the `Table` type the context exposes, pass the slice in from `useDataTableState` instead of reading the table.

- [ ] **Step 7: Renames.** `getPrePaginationRowModel` to `getPrePaginatedRowModel` (`TableHeader.tsx:408`, `DataTablePagination.tsx:95`). `VisibilityState` to `ColumnVisibilityState`. `createRow(...)` to `constructRow(table, id, original, index, 0)` at `ExportMenu.tsx:131-133`. Add to `ExportMenu.allMatching.test.tsx`: `formats rows the table never held with the column's own cell renderer`, exporting a fetched row whose column has a custom `cell` and `valueFormat`, and expecting the same text a held row produces.

- [ ] **Step 8: `TableHeader.tsx:413`.** Replace `!table.options.getPaginationRowModel` with the package's own pagination flags (`enablePagination` and `manualPagination` are already in context or props; take them from there). Add to `TableHeader.fallbacks.test.tsx`: `toggles the current page only when the table paginates on the client`, two renders: client-side paginated with 2 pages, where the header checkbox selects `pageSize` rows; manual pagination, where it selects every held row.

- [ ] **Step 9: Types.** Thread `DataTableFeatures` through `src/types.ts`, `src/filters/filterFns.ts` (`FilterFn<DataTableFeatures, TData>`, `Row<DataTableFeatures, TData>`), `src/core/aggregate.ts`, `src/core/TableContainer.tsx` and every type-only import. `DataTableColumnDef` extends `Omit<ColumnDef<DataTableFeatures, TData, TValue>, 'id' | 'header'>`. `ColumnDef` is a union in v9; if `Omit` over it loses the accessor keys, `Omit` each member, do not widen with a cast. Hard rule: no `any`, no `as unknown as`.

- [ ] **Step 10: Port the test files.** Type imports and generics only, plus `{start, end}` fixtures and `.state` where the 2 test `getState()` calls are. Do not change an assertion except a pinning shape.

- [ ] **Step 11: Grep for the dead v8 surface**

  `grep -rnE "getState\(\)|getCoreRowModel|getPaginationRowModel|getPrePagination|createRow|VisibilityState|sortingFn|\.left\b|\.right\b|'left'|'right'" packages/datatable/src`. Every hit left must be `sticky`, CSS, or `ColumnVisibilityState`.

- [ ] **Step 12: Run, through check-agent, one at a time**

  `pnpm --filter @vt-labs/datatable typecheck`, then `vitest run --project @vt-labs/datatable`, then `pnpm lint`.
  Expected: typecheck clean; every test passes, including Task 1's file unchanged and `features.test.ts`; lint clean.

- [ ] **Step 13: Commit**

  Stage by name (`git status` first): `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `packages/datatable/package.json`, the new and changed `packages/datatable/src/**` files, `packages/datatable/src/DataTable.stories.tsx`.
  `feat(datatable)!: move to @tanstack/react-table 9`. No changeset yet; Task 7 writes the one major changeset for the whole port.

---

### Task 3: Migrate stored pinning from 1.x

**Files:**

- Modify: `packages/datatable/src/storage/preferences.ts:10,19-21,53-64`
- Modify: `packages/datatable/src/useTableStatePersistence.ts:53-56,73`
- Modify: `packages/datatable/src/useDataTableState.ts:111-122`
- Test: `packages/datatable/src/storage/preferences.test.ts`, `packages/datatable/src/useTableStatePersistence.test.ts`

**Interfaces:**

- Consumes: `ColumnPinningState` `{start, end}` from Task 2.
- Produces: `PERSISTED_STATE_VERSION = 3`; `readPinning(value: unknown): ColumnPinningState | null` in `storage/preferences.ts`, accepting `{start, end}` and `{left, right}` (either key optional, arrays of strings only).

- [ ] **Step 1: Write the failing tests**

  - `reads a version 2 layout's left and right pins as start and end`: stored `{version: 2, columnPinning: {left: ['a'], right: ['z']}}` loads with `columnPinning` `{start: ['a'], end: ['z']}`.
  - `reads a version 3 layout unchanged`.
  - `drops pins for columns that no longer exist after the move to start and end`: v2 data pinning a removed column, expect it gone from `start`.
  - `rejects a pinning value whose sides are not string arrays`: `{left: 'a'}` reads as `null`.
  - `writes version 3 with start and end`.

- [ ] **Step 2: Run** `vitest run --project @vt-labs/datatable src/storage src/useTableStatePersistence.test.ts`. Expected: the new tests fail.

- [ ] **Step 3: Implement** `readPinning` and bump `PERSISTED_STATE_VERSION` to 3. `isPinning`, `sanitizeLayout` and `dropStaleColumns` go through it. The existing `migratesStoredState` path in `useDataTableState.ts:111-122` then writes v3 back.

- [ ] **Step 4 (only if D2 is "keep a fallback"):** `initialColumnPinning` also accepts `{left?, right?}`, typed as a deprecated union member with a `@deprecated` JSDoc, mapped through `readPinning`. Test: `accepts the deprecated left and right shape in initialColumnPinning`.

- [ ] **Step 5: Run** the same command. Expected: all pass.

- [ ] **Step 6: Commit** the four files by name: `fix(datatable): carry saved pinned columns over from 1.x`.

---

### Task 4: Table identity and memo audit

v9's `useTable` returns `useMemo(() => ({...table, options, state}), [table, options, state])`.
An inline options literal is a new `table` every render.

**Files:**

- Modify: `packages/datatable/src/useTableInstance.ts:121-209`
- Modify, where the audit finds a dependency on `table` that re-runs per render: `src/DataTable.tsx:266,291-297`, `src/DataTableContext.tsx`, `src/DataTableContext.hooks.ts`, `src/core/TableBody.tsx:56`
- Test: `packages/datatable/src/useTableInstance.test.tsx` (create if absent)

**Interfaces:**

- Produces: `table` from `useTableInstance` keeps its identity across a re-render in which no table option and no table state changed.

- [ ] **Step 1: Write the failing tests**

  - `keeps the table identity across a re-render with the same inputs`: `renderHook` with stable props, `rerender()`, expect `result.current` to be the same object.
  - `changes the table identity when sorting changes`: after a sort, expect a new object.
  - `does not re-run the last-page check on an unrelated render`: spy `setPageIndex` through a table on its last page; re-render with a changed unrelated prop (a `slots` object recreated with the same values is not unrelated; use a parent counter); expect the spy not called.

- [ ] **Step 2: Run** `vitest run --project @vt-labs/datatable src/useTableInstance.test.tsx`. Expected: the identity test fails.

- [ ] **Step 3: Implement.** Build the options object in one `useMemo` keyed on its real inputs. Remove `'use no memo'` and the `incompatible-library` disable at `:121-123` only if `pnpm lint:eslint` passes without them; otherwise keep both and update the comment to say why v9 still needs them.

- [ ] **Step 4: Audit.** For each hook whose dependency list holds `table` (grep `\[table` and `table,` in deps), confirm it now runs only on a real change. Remove the `eslint-disable` at `DataTable.tsx:291-297` if `[table]` alone is now correct. Leave `useIdentityVersion(tableColumns)` alone unless a test shows it is redundant.

- [ ] **Step 5: Run** the test file, then `vitest run --project @vt-labs/datatable`, then `pnpm lint:eslint`. Expected: all pass.

- [ ] **Step 6: Commit** by name: `perf(datatable): keep the table's identity stable between renders`.

---

### Task 5: Public type surface

**Files:**

- Modify: `packages/datatable/src/index.ts`, `packages/datatable/src/index.test.ts`
- Test: type assertions in `packages/datatable/src/index.test.ts` with `expectTypeOf` (checked by `typecheck`)

**Interfaces:**

- Consumes: `DataTableFeatures` from Task 2.
- Produces (if D1 is yes): `export type {DataTableFeatures} from './core/features'`.

- [ ] **Step 1: Write the assertions**

  - `DataTableColumnDef<{id: number; name: string}>[]` accepts `{accessorKey: 'name', header: 'Name', sortFn: 'alphanumeric'}`.
  - `@ts-expect-error` is banned, so assert the negative with `expectTypeOf<DataTableColumnDef<Row>>().not.toHaveProperty('sortingFn')`.
  - A `cell` renderer typed `(ctx: CellContext<DataTableFeatures, Row, string>) => ReactNode` is assignable to the column's `cell`.
  - `useTableCore().table` is `Table<DataTableFeatures, RowData>`.
  - If D1 is yes, the export list in `index.test.ts` includes `DataTableFeatures` (type exports are asserted the way the file already does it).

- [ ] **Step 2: Run** `pnpm --filter @vt-labs/datatable typecheck` and `vitest run --project @vt-labs/datatable src/index.test.ts`. Expected: fails on the missing export.

- [ ] **Step 3: Implement** the export.

- [ ] **Step 4: Run** the same two. Expected: pass.

- [ ] **Step 5: Hand the diff since `main` to `api-surface-auditor`** and paste its bump verdict. Expected: major.

- [ ] **Step 6: Commit** by name: `feat(datatable): export the feature set type for typing renderers`.

---

### Task 6: Stories under v9

**Files:**

- Modify: `packages/datatable/src/**/*.stories.tsx` as needed; `src/DataTable.stories.tsx:746-782` (pinning)

- [ ] **Step 1: Run** `vitest run --project storybook` through check-agent. Expected before fixes: any failure is a real regression or a story still on `{left, right}`.

- [ ] **Step 2: Fix** each failure in the component, not the story, unless the story uses a v8 shape. A11y stays `'error'`.

- [ ] **Step 3: Extend the pinning story's `play`**: pin a second column to the start through the columns menu and assert it renders before the unpinned columns, and that its cell has a left `position: sticky` offset.

- [ ] **Step 4: Run** `vitest run --project storybook`. Expected: all pass, axe clean.

- [ ] **Step 5: Commit** by name: `test(datatable): run the stories on react-table 9`.

---

### Task 7: Docs, changeset, decision, roadmap

**Files:**

- Modify: `packages/datatable/README.md:27,35` and `packages/datatable/src/docs/GettingStarted.mdx:22,30` (peer `^9.3`, Node 20)
- Modify: `packages/datatable/README.md`: new section "Upgrading from 1.x" with the eight breaking changes above, each with a before/after snippet where code changes (pinning, `sortFn`, `ColumnMeta`, `table.state`)
- Create: `.changeset/datatable-react-table-9.md` (`'@vt-labs/datatable': major`)
- Create: `docs/decisions/0011-datatable-react-table-9.md` recording D1 to D3 as answered (check the next free number first)
- Modify: `docs/repo/dependency-upgrades.md:64-85` (clear the entry: taken, with the date)
- Modify: `docs/roadmap.md` (section 2 row to done; section 5 row removed or marked taken; "Where things stand" next step)
- Move: this plan to `docs/superpowers/plans/done/` with `git mv`
- Modify: `docs/packages/datatable/` history file if the package keeps one there

- [ ] **Step 1: Write the changeset** for a stranger: one line saying datatable now runs on react-table 9 and requires it, then the eight changes as a list, then "Saved preferences from 1.x carry over." No em-dashes.

- [ ] **Step 2: Write the README section and the MDX peer table.**

- [ ] **Step 3: Write the decision file, the ledger entry, the roadmap rows; `git mv` the plan.**

- [ ] **Step 4: Run** `pnpm validate` through check-agent. Expected: clean, coverage 100% for datatable.

- [ ] **Step 5: Hand the branch to `lib-reviewer`**, fix what it reports, rerun the affected checks.

- [ ] **Step 6: Commit** by name: `docs(datatable): document the react-table 9 upgrade and release it as 2.0`.

- [ ] **Step 7: Ask the user** before `pnpm version-packages`, push or `pnpm release`.

---

## Risks

- **Silent registry gaps.** A filter or sort name the registry lacks fails with a dev-only console warning and returns all rows unfiltered or unsorted. Task 1 and `features.test.ts` cover the built-in paths; a consumer's string name outside the list is breaking change 5, and D3 decides whether 2.0 offers a way out.
- **`Omit` over the v9 `ColumnDef` union.** v9's `ColumnDef` is a union of display, group and accessor defs. `Omit<Union, K>` collapses to the common keys and drops `accessorKey`/`accessorFn`. Task 2 step 9 handles it per member; it is the most likely place to burn time.
- **Re-render storms.** If Task 4 cannot make the options object stable (some inputs are consumer props recreated every render, such as `columns` without `useMemo`), identity changes on every parent render. The existing `useIdentityVersion` workaround exists for exactly this and must keep working.
- **Atoms read in render.** `table.atoms.<slice>.get()` is a snapshot, not a subscription. Used in render it shows stale values with the React Compiler on. Task 2 step 6 limits it to event handlers.
- **Prototype methods.** Any destructured `const {getValue} = row` or spread `{...column}` breaks at runtime, not compile time. Task 2 step 11 greps; the stories in Task 6 are the runtime net.
- **v9 is young.** 9.x is weeks old at 9.3.1. Pin the peer floor at the version tested, and re-read the changelog for 9.4+ before release.
- **Consumers on two majors.** A consumer who upgrades datatable but not react-table gets type errors from mismatched `Table` types, not a clear message. The changeset and README put the peer bump first.

## Self-review

- Every item the brief asked for has a section: goal and scope (header), API map, breaking changes, ordered tasks with tests (7), peer and catalog (Global Constraints, Task 2 step 1), risks, what stays on v8.
- Names used across tasks: `dataTableFeatures`, `DataTableFeatures`, `readPinning`, `PERSISTED_STATE_VERSION = 3`, `{start, end}`. Consistent.
- Review Focus lines map to tests in Tasks 1, 2 (steps 8 and 7/ExportMenu), 3 and 4.
