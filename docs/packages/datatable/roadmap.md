# DataTable roadmap

> Copied from `skipwash-admin/docs/datatable-roadmap.md`. Paths written as
> `src/components/DataTable/…` are the component's old home in that app; it now lives at
> `packages/datatable/src/` here. The rest reads unchanged.

Candidate features for `src/components/DataTable/`, ranked by value rather than by novelty. Each entry says what exists today, so the estimate reflects real remaining work.

**Direction:** this component is being extracted into a standalone npm library. That widens the scope in two ways. Features that only an analyst would use (pivot, aggregation, charting) are now in scope, because the library's audience is larger than SkipWash ops. And anything SkipWash-specific (MUI theme tokens, our `t()`, our axios layer) has to become injectable rather than imported. Items below are tagged **[lib]** where the packaging constraint changes the design.

The table already owns its state (`useDataTableState`) and persists all of it per `tableId` to localStorage (`useTableStatePersistence`). That foundation is what makes most of the items below cheap: the state slice usually exists, only the UI and the rendering are missing.

A second reference implementation now informs several items: the ScaffPlan WebUI table at `packages/ui/src/components/data-table` (shadcn/Tailwind, ~10k lines, client-side-first). Items sourced from it are marked **[SP]**, and the adoption notes at the end of this document say what to copy, what to change, and what to leave.

## Prior generations

Two earlier versions of this same component exist in the `smart` repos: `smarthip-admin/src/components/DataTable` (~7.5k lines) and `admin-v2/src/components/DataTable` (~6.9k lines). Both share this component's architecture and file layout, and their `enable*` flag surfaces are identical to ours. They are ancestors, not alternatives, so they are a source of regression tests and one missing file rather than of new features.

What this version has that they do not: the owns-state model (`useTableServerState`, `onServerStateChange`, `getInitialServerState`), `useTableInstance`, `useColumnPinning`, `useColumnVisibility`, `headerCase`, and the mobile content-layout options. Both older versions still carry the per-slice callbacks (`onSortingChange`, `onPaginationChange`, `onFiltersChange`, `onGlobalFilterChange`) that we removed deliberately; do not reintroduce them.

What they have that this version does not: **`admin-v2/src/components/DataTable/core/VirtualizedBody.tsx`** (95 lines). See item 14.

Their test suites are worth mining when porting anything: `DataTable.persistence.test.tsx`, `DataTable.expansion.test.tsx`, and `TableCell.overflow.test.tsx` cover behaviour our suites also need to hold, and `DataTable.reproduction.test.tsx` in `smarthip-admin` encodes bugs already found once in this lineage.

## Status

| #   | Feature                                  | Track     | Source | Status                              |
| --- | ---------------------------------------- | --------- | ------ | ----------------------------------- |
| 0a  | Column reordering                        | UX        |        | done (2026-08-27)                   |
| 0b  | Consistent header casing                 | UX        |        | done (2026-08-27, `headerCase`)     |
| 1   | Preferences-only persistence             | Found.    | SP     | proposed                            |
| 2   | Saved views                              | Found.    |        | proposed                            |
| 3   | Shareable state in the URL               | Found.    |        | proposed                            |
| 4   | Column pinning from the popover          | UX        |        | done (2026-08-28)                   |
| 5   | Active filter chips                      | UX        | SP     | proposed                            |
| 6   | Columns popover: search, groups, reset   | UX        | SP     | proposed                            |
| 7   | Keyboard-first navigation                | UX        | SP     | proposed                            |
| 8   | Sticky selection summary bar             | UX        | SP     | proposed                            |
| 9   | Row detail panel with prev/next          | UX        | SP     | proposed                            |
| 10  | Display controls (wrap, fullscreen, fit) | UX        | SP     | proposed                            |
| 11  | Row grouping UI                          | UX        |        | proposed                            |
| 12  | "Why is this row here?"                  | UX        |        | proposed                            |
| 13  | Diff highlighting on refetch             | UX        |        | proposed                            |
| 14  | Virtualization                           | UX        | smart  | wired, unused (port exists)         |
| 15  | Export respects the current view         | Data out  | SP     | proposed                            |
| 16  | Server-side export of the full result    | Data out  |        | proposed                            |
| 17  | Faceted filters with counts              | Data out  | SP     | proposed (BE-dependent)             |
| 18  | Inline edit rollout                      | Editing   |        | partly built                        |
| 19  | Bulk edit with optimistic rollback       | Editing   |        | proposed (BE-dependent)             |
| 20  | Aggregation footer                       | Analytics | SP     | proposed                            |
| 21  | Pivot engine                             | Analytics | SP     | proposed                            |
| 22  | Pivot configurator panel                 | Analytics | SP     | proposed                            |
| 23  | Pivot charts and drill-down              | Analytics | SP     | proposed                            |
| 24  | Sparkline cells                          | Analytics | SP     | proposed                            |
| 25  | Pivot filtering and sorting              | Analytics | SP     | proposed                            |
| 26  | Analytics view serialization             | Analytics | SP     | proposed                            |
| 27  | Headless core split                      | Library   |        | proposed                            |
| 28  | Theme and i18n injection                 | Library   |        | proposed                            |
| 29  | Accessibility conformance                | Library   |        | partial (resize handle, 2026-08-28) |
| 30  | Docs site and examples                   | Library   |        | proposed                            |
| 31  | Resize without per-frame re-render       | Perf      |        | proposed                            |
| 32  | Body-cell truncation without reflow      | Perf      |        | proposed                            |
| 33  | Cell context subscriptions               | Perf      |        | proposed                            |
| 34  | One shared row-actions menu              | Perf      |        | proposed                            |
| 35  | Cell render weight                       | Perf      |        | proposed                            |
| 36  | Expansion scaffolding and row model      | Perf      |        | proposed                            |
| 37  | Effect churn in state management         | Perf      |        | proposed                            |
| 38  | Explicit column memoization              | Perf      |        | proposed                            |
| 39  | Measurement harness and perf budget      | Perf      |        | proposed                            |

## Hardening pass (2026-08-28)

A parallel review of `src/components/DataTable/**` as a candidate package landed 52 test files and 805 tests, 27 of them written red against defects the review found. All 27 now pass; the findings and what each one cost a user are in `skipwash-admin/docs/datatable-test-findings.md` (not copied here). Three things are worth carrying forward into the items below.

**One defect class accounted for seven of the seventeen findings.** `useReactTable` returns a stable `table`, and `table.getColumn(id)` returns stable columns. Anything derived from those alone is cached by React Compiler for the life of the mount. Every filter field therefore ignored a filter cleared from the toolbar, and the expand-all header button was one-way: its label stayed "Expand All" over already-open rows and it could never collapse them. Two remedies apply, and which one fits depends on the component. Small leaf components that read through the stable ref take `'use no memo'` (the four filters). Anything worth memoizing reads the changing slice off `useTableUI()` and consumes it inside the callback: the compiler infers `useMemo` deps from what the callback actually reads and discards hand-written ones, so passing a signature prop invalidates the element without invalidating the memo. That trap cost a debugging cycle; `ExpandHeaderCell` and `SelectHeaderCell` are the reference shape.

**Row lookups must key by `row.id`, never `row.original.id`.** Expansion state is keyed by whatever `getRowId` returns, so a page supplying a uuid or a compound key got a chevron that opened nothing. Found in `CardView`, and the same bug was sitting unreported in `TableBody`.

**`t()` never returns null.** i18next returns the key itself when a translation is missing, so every `t('x') ?? 'English'` in the folder was dead code and a locale with a gap rendered raw key strings at the user. The fallbacks now use `t(key, {defaultValue: …})`. This is item 28's problem in miniature and is the argument for doing it early.

Deferred deliberately, all recorded in the findings doc: `toolbar/ExpandToggle.tsx` is unexported and unused (export it or delete it before packaging); `NumberFilter` declares a `max` prop it never reads and hardcodes its "Min"/"Max" placeholders; `TextFilter`'s clear button has no accessible name; and `DataTable.tsx` renders one skeleton row per `pageSize`, so a page size of 100 paints 100 of them.

Two components in the folder are package surface with no caller in this app: `toolbar/ColumnOrdering.tsx` (the app reorders by dragging headers) and `toolbar/ExpandToggle.tsx`. Both are covered by tests only. Anything they do that the hooks also do has to be reconciled against the hooks before publishing, not left to drift.

---

# Track A: State foundations

Everything in this track is a prerequisite for something else. Do it first.

## 1. Preferences-only persistence and `meta.defaultHidden` **[SP]**

Split "what the column def declares" from "what the user chose". Column defaults resolve at render and are never written to storage; storage holds only deliberate user changes.

**Why it matters:** today a stored visibility map is indistinguishable from a user preference, so a column def that changes in a later release cannot take effect for anyone who has used the table. It also makes item 2 unsafe: a saved view would freeze defaults it was never meant to own.

**What exists:** `useTableStatePersistence` writes the full resolved state per `tableId`.

**What is missing:** a `meta.defaultHidden` flag on `DataTableColumnDef`, merge-at-render (`{...defaults, ...preferences}`), and a setter that strips untouched defaults back out before writing. The rule that makes it work: an id absent from storage means "no preference recorded", an id present means the user chose, and defaults must never be persisted or that distinction dies on the first unrelated toggle.

**Enhancement over ScaffPlan:** they apply this to visibility only. Extend it to column order, width, and pinning, all three of which have the same stale-default problem. Add validation on load that drops ids no longer in the column set, so a renamed column degrades to a default instead of a blank column.

**Unblocks:** 2, 3, 6, 26.

## 2. Saved views

Named presets capturing columns (visibility, order, pinning, widths), filters, sort, page size, and once Track E lands, the pivot configuration. Switch from the toolbar; one can be default per table.

**Why it matters:** Orders carries 15 columns and several quick filters. Every operator reconstructs the same handful of setups daily ("unrouted today", "payout pending", "rewash queue"). The state is already persisted; it just has nowhere to live under a name.

**What exists:** `PersistedTableState` is exactly the payload a view needs.

**What is missing:** a keyed collection instead of a single entry, a toolbar selector, and rename/delete/duplicate. Start local-only. Server-side views need a BE endpoint plus a sharing model.

**[lib]** The storage backend must be injectable: localStorage by default, with an async adapter interface so a consumer can persist views server-side without forking.

**Risk:** a view referencing a removed column. Item 1's validation covers it.

## 3. Shareable table state in the URL

Encode the live `ServerTableState` into router search params, so a table configuration is a link.

**Why it matters:** support and ops conversations currently move screenshots around. A link that reproduces the exact filtered, sorted, paginated view removes a whole class of "which rows do you mean?" exchanges, and makes browser back/forward behave the way people expect inside a list.

**What exists:** `useTableServerState` models the full server state as one object. `useTabSearch` shows the search-param pattern this repo uses.

**What is missing:** a serializer (short keys, omit defaults, keep URLs readable), a Zod schema per table for validation, and precedence rules. Suggested precedence: URL beats localStorage beats defaults, because a pasted link must win over whatever the recipient had configured.

**[lib]** TanStack Router cannot be a hard dependency. Expose the serializer plus a `state <-> params` adapter interface, and ship the TanStack binding as a separate entry point.

**Risk:** long filter values (multi-select building ids) bloat the URL. Cap what goes in and fall back to persistence for the rest.

**Pairs with 2.** Saved views plus shareable URLs is the combination almost no admin table ships.

---

# Track B: Table UX

## 4. Column pinning from the popover

Freeze chosen columns to the left edge so the identifier stays visible while scrolling a wide table horizontally. Controlled from the Columns popover that already owns visibility and ordering.

**Why it matters:** Orders is far wider than any laptop viewport. Scrolling right to read Payout Status means losing sight of which order the row belongs to.

**What exists:** `columnPinning` is in `useDataTableState`, is persisted, and is handed to `useReactTable` with `enableColumnPinning`. A static per-column `columnDef.sticky` escape hatch also exists.

**What is missing:** UI, and offset-aware rendering. The static `sticky` path sets `left: 0` unconditionally, which is only correct for a single pinned column. Real pinning needs cumulative offsets measured from the DOM, because the table renders with `table-layout: auto` and `getSize()` therefore does not reflect painted widths.

**Do not copy ScaffPlan here.** Their `getLeftPinOffset` sums `getSize()`, which is only correct because they force `table-fixed` whenever resizing is on. Under auto layout it produces overlapping columns. Measure instead.

**Scope note:** left-edge pinning ships first. **[lib]** Right-edge pinning moves into scope for the library, since not every consumer parks an actions column there. Gate it behind `enableRightPinning` and mirror the offset calculation from the right.

**Shipped 2026-08-28.** A pin toggle per column in the Columns popover, cumulative offsets measured from the DOM and written as CSS custom properties (`useStickyColumnOffsets`), and the selection checkbox frozen at the left edge whether or not the user pinned anything.

The invariant the whole feature rests on: **`columnPinning.left` is always a prefix-slice of the rendered `columnOrder`.** `getHeaderGroups()` paints `columnPinning.left` in that array's own order while the body follows `columnOrder` alone, so any code path that writes one has to rewrite the other. `orderWithPinned` and `resolveColumnPinning` in `hooks/useColumnPinning.ts` are the only correct way to do that, and every writer now goes through them: `togglePin`, `moveColumn`, `useTableInstance`, and the reorder dialog. Reordering pinned columns against each other split the header from its body until the last of those was converted.

Not pinnable, by construction: `select` and `expand` always lead the row, `actions` always closes it. The pin control is hidden entirely on the mobile card layout, where there is no horizontal scroll to freeze against.

Right-edge pinning is still open.

## 5. Active filter chips **[SP]**

A row of chips naming every active filter, each individually clearable, plus clear-all.

**Why it matters:** with a global search, quick filters, and column filters all live at once, there is no single place that says what is currently narrowing the list. Users clear filters by reloading the page.

**What exists:** `FilterPanel` counts active column filters for its badge. Nothing renders them.

**Adopt from:** `data-table-filter-indicator.tsx` (156 lines). Its value formatter already handles strings, arrays, and date ranges, and its empty-value check keeps a chip from rendering for a filter set to `""`.

**Enhancement over ScaffPlan:** theirs renders `Status: Cancelled`, which is ambiguous. Our filters carry a `FilterOperator`, so render the operator: `Status is not Cancelled`, `Total between 10 and 50`. Drive the chips off `ServerTableState` rather than the client filter state, so a chip reflects what was actually sent to the API. Route every clear through the same handler that resets `pageIndex` to 0, or we reintroduce the stale-page bug the skill warns about.

## 6. Columns popover: search, groups, reset **[SP]**

Three additions to the existing popover: a search box, `meta.group` bucketing with headings, and a reset-to-defaults action.

**Why it matters:** at 15 columns the list scrolls, which makes both toggling and drag-reordering awkward.

**Adopt from:** `data-table-view-options.tsx`. Three details there are worth taking exactly:

- Search matches label **and** column id, so a column whose header is a component is still findable by field name.
- The list is built only while the popover is open. Sorting and bucketing the full column set on every sort, filter, and page click is pure waste otherwise.
- `canMoveOnto` confines a drag to the column's own group. Groups render in column-def order while the list renders in drag order, so a cross-group drop otherwise snaps back visually while the table keeps the new order, leaving the picker contradicting the table it controls.

**Enhancement over ScaffPlan:** our popover already owns reordering and (item 4) pinning, so search has to filter the reorder list without breaking drag indices. Resolve drops against the full column list, not the filtered one. Add a "hidden (n)" count and make reset clear order, width, and pinning too, matching item 1.

## 7. Keyboard-first navigation **[SP]**

Arrow-key row focus, `Enter` to open, `Space` to select, `/` to focus search, `Escape` to clear focus.

**Why it matters:** admin tools are used all day by a small number of people; keyboard support compounds. The reorder handles already accept `ArrowUp`/`ArrowDown`, so the interaction vocabulary has a precedent.

**Adopt from:** ScaffPlan's handler is about 25 lines and covers arrows, `Enter`, and `Space`.

**Enhancement over ScaffPlan:** theirs marks the focused row with a ring class and nothing else, so a screen reader is told nothing. Use roving `tabIndex` with `aria-activedescendant` on a `role="grid"` container. Add `/` for search. Suppress the handler entirely while `useInlineEdit` has a cell open, otherwise `Space` types a space and selects the row at the same time. Skip the handler when focus is inside a filter input.

## 8. Sticky selection summary bar **[SP]**

When rows are selected, keep the count and the bulk actions visible while scrolling.

**What exists:** `BulkActions` renders inline above the table and scrolls away.

**Adopt from:** `data-table-bulk-actions.tsx`, a fixed bottom-centre bar that only mounts when the count is non-zero.

**Enhancement over ScaffPlan:** wrap each action in `PermissionGate`, add safe-area inset padding so it clears the iOS home indicator, and show a "select all N matching" affordance when selection is page-scoped but the filter matches more rows than the page holds.

## 9. Row detail panel with prev/next **[SP]**

A side panel showing one row in full, with prev/next stepping through the list and `Escape` to close.

**Why it matters:** triaging Orders currently means a round trip to a detail route per row, losing table state each time.

**Adopt from:** `data-table-detail-panel.tsx` (345 lines). Right, bottom, and modal positions, focus trap, `Escape` handling, and index/count display.

**Enhancement over ScaffPlan:** theirs finds the current row with `findIndex(r => r.original === data)`, an identity comparison that breaks the moment a refetch replaces the row objects. Key by row id. Theirs also stops at the page boundary; ours should advance server state and continue into the next page. Render as an MUI `Drawer` so the theme and breakpoints come for free.

## 10. Display controls: cell wrap, fullscreen, fit-to-content **[SP]**

Three small toolbar toggles.

**What exists:** `cellOverflow` is a prop with `ellipsis | wrap | truncate` but no UI. Column widths are persisted per `tableId`.

**What is missing:** a wrap toggle bound to the existing prop, a fullscreen toggle, and a "fit to content" action that measures the widest rendered cell per column and writes sizing. Fit-to-content is the one that saves real time, since the alternative is dragging every column edge.

**Adopt from:** ScaffPlan has the wrap toggle and fullscreen. Fit-to-content is ours to build, and shares its DOM measurement pass with item 4's pin offsets. Build the measurement utility once.

## 11. Row grouping UI

Collapsible group headers with per-group counts, grouped by any groupable column.

**What exists:** `grouping` state and `getGroupedRowModel` are already wired in `useTableInstance`. No UI exposes it.

**What is missing:** a group-by control, group header rows, expand/collapse state, and a decision about server-side grouping. Client grouping over a 50-row page groups only that page, which is misleading. Either restrict the control to client-side tables or require a BE grouping parameter.

**Feeds into:** item 21. Grouping is pivot's row hierarchy with one field.

## 12. "Why is this row here?"

A per-row popover naming which active filters this row matched.

**Why it matters:** with several quick filters plus a search plus column filters active, it is not always obvious why a row is in the list. Unusual in admin tables, and cheap once filters are structured data.

**Depends on:** item 5. The chip model is the same data, read per row instead of globally. Under server-side filtering the match has to be recomputed client-side from the filter definitions, so it is a best-effort explanation, and should say so.

## 13. Diff highlighting on refetch

After a background refetch, briefly highlight rows whose values changed.

**Why it matters:** on an operations dashboard that is watched rather than read, this turns the table into something closer to a live feed.

**What is missing:** a previous-snapshot ref keyed by row id, a shallow compare on the visible columns, and a transient class. Keep the comparison to visible columns or every unrelated field change lights the table up.

## 14. Virtualization

**What exists:** `enableVirtualization` and `VIRTUALIZATION_THRESHOLD` are declared here but nothing consumes them. A working implementation already exists one generation back at `admin-v2/src/components/DataTable/core/VirtualizedBody.tsx`: `useVirtualizer` over the row model, sized from `DENSITY_CONFIG[density].rowHeight`, with spacer rows top and bottom so the MUI `<TableBody>` keeps valid table markup.

**What is missing:** port that file, then fix what it does not handle. Its `getScrollElement` walks `parentRef.current?.parentElement?.parentElement`, which silently returns null if `TableContainer` markup ever changes. Pass the scroll element down explicitly instead. It also drops `rowActions` (the prop is destructured to `_rowActions` and ignored) and predates row expansion, so expanded content has no measured height. Use `measureElement` for variable-height rows rather than a fixed estimate.

**[lib]** Previously deferred because 50 rows is not a bottleneck. As a library this matters more, since consumers will pass client-side datasets in the thousands. Note that virtualized rows and item 4's DOM-measured pin offsets interact: measure off the header row, not the body, since body rows unmount as they scroll out.

---

# Track C: Data out

## 15. Export respects the current view **[SP]**

Export visible columns, in their current order, with their display labels.

**What exists:** `ExportMenu` already filters on `getIsVisible()`.

**What is missing:** it reads `getAllLeafColumns()`, so the file comes out in column-def order rather than the user's order. Switch to `getVisibleLeafColumns()`.

**Adopt from:** ScaffPlan's `handleExport` contributes two things ours lacks: a label resolution chain (`meta.label`, then `accessorKey`, then humanized id) so headers read like the screen, and a guard that emits no file when zero columns are selected, since a file of blank lines reads as corruption rather than as "you hid everything".

## 16. Server-side export of the full result set

Export every row matching the current filters, not just the loaded page.

**Why it matters:** under `manualPagination`, `getFilteredRowModel().rows` is one page. Anyone exporting a filtered Orders view today gets 50 rows and no warning. This is a correctness bug in the current export, not a feature gap.

**What is missing:** an export path that re-queries with the current `ServerTableState` at maximum page size (or a dedicated BE export endpoint), plus progress feedback and a row-count cap. Until then the menu should say "current page" so the file is not silently wrong.

**Note:** ScaffPlan has nothing here. Their export assumes the full dataset is already in the client, which is exactly the assumption our state model breaks.

## 17. Faceted filters with counts **[SP]**

Multi-select filter popovers showing how many rows carry each value.

**Adopt from:** `data-table-faceted-filter.tsx`. The interaction (searchable command list, selected-count badge, per-option counts, clear) is good and worth matching.

**Enhancement over ScaffPlan:** theirs reads counts from `getFacetedUniqueValues()`, the client row model, which under server pagination counts one page. Counts have to come from the API as a facets block on the list response. **Confirm BE support before building.** The UI can ship first with counts omitted, and light up when the facets land.

---

# Track D: Editing

## 18. Inline edit rollout

`useInlineEdit` and `ColumnEditConfig` exist but are barely used. Editing a status or a commission without a round trip to a detail page is a real time saver.

**What is missing:** an optimistic update plus rollback story per column, and adoption across the list pages that would benefit.

**Adopt from:** ScaffPlan's `EditableCell` is simpler than ours but handles two things well: it re-syncs local state when the incoming value changes (so a refetch mid-edit does not strand a stale draft), and it surfaces per-cell validation errors inline. Ours should do both. Ignore their `value: any` typing.

## 19. Bulk edit with optimistic rollback

Bulk actions currently fire and forget: the whole selection succeeds or the toast says something failed. Replace with per-row outcome tracking, partial success, and retry scoped to the failures.

**Why it matters:** a 50-row bulk assign that half-fails is unrecoverable without reloading and eyeballing which rows changed. At scale operators avoid bulk actions entirely, which defeats the feature.

**What is missing:** a per-row result shape from the BE (or per-row calls with a concurrency cap), row-level status decoration, and a retry affordance.

**Depends on:** BE support for partial success. Confirm before building.

---

# Track E: Analytics and pivot

This track is the largest addition and exists because of the library direction. ScaffPlan's pivot module is roughly 5,000 lines across 30 files and is the most complete part of their table. It is worth adopting as a design, not as a copy: the engine is sound, the assumptions about where the data lives are not.

**The load-bearing constraint:** pivoting 50 server-paginated rows and labelling the result "Total" puts a wrong number on screen. Every item in this track needs an explicit data-source decision, and there are only three honest answers:

1. **Client-side** over a fully loaded dataset. Correct, and fine up to a few thousand rows. This is what ScaffPlan does, implicitly.
2. **Fetch-all-then-pivot**, with an explicit row cap and a progress indicator. Correct, bounded, and the right default for a list that is normally paginated.
3. **Server-side aggregation** via a BE endpoint that accepts group-by fields and aggregations. The only correct answer at real scale, and a BE dependency.

Build 1 and 2 first. Design the config type so 3 is a swapped resolver, not a rewrite.

## 20. Aggregation footer **[SP]**

A totals row under the table: sum, average, count, min, max, median, distinct-count per column, with subtotals per group when item 11 is on.

**What exists:** `DataTableColumnDef` already carries a `footer` field, unused.

**Adopt from:** `data-table-aggregations.ts` (206 lines, 337 lines of tests). The function set and `Intl.NumberFormat` formatting are directly reusable and framework-agnostic.

**Enhancement over ScaffPlan:** add the data-source decision above. In server mode the footer reads an API-provided summary block and shows nothing (not zero) when the API omits it. Add `median` correctness on even-length input, guard `min`/`max` against empty input returning `0` (ScaffPlan's do, which is wrong: empty should be null, not zero), and make `avg` ignore nulls rather than counting them as zero.

**Smallest useful slice:** a client-side footer for tables that already load their full dataset. That is a day of work and immediately useful on payouts.

## 21. Pivot engine **[SP]**

Transform flat rows into a pivoted result: row grouping fields build a hierarchy, an optional column field spreads distinct values into columns, and value aggregations fill the cells. Grand totals and subtotals with configurable position.

**Adopt from:** `pivot/pivot-engine.ts`. `transformToPivot`, `buildRowHierarchy`, `extractPivotColumnValues`, `generatePivotHeaders`, and `calculateCellValue` are pure functions over plain data with no React and no Tailwind in them. This is the single most portable thing in ScaffPlan's codebase and the strongest argument for adopting rather than writing from scratch.

**Enhancement over ScaffPlan:**

- Type the engine properly. Their `PivotRow.aggregatedValues` is `Record<string, number | null>`, which cannot express a non-numeric aggregate like distinct-count-of-strings or a first/last value.
- Cap the column-field cardinality. Pivoting on a field with 400 distinct values generates 400 columns and freezes the tab. Cap it, sort the remainder into an "Other" bucket, and say so in the UI.
- Make the resolver pluggable so option 3 above (server aggregation) is a config change.
- Their `serializePivotResult`/`deserializePivotResult` pair exists for caching; keep it, and reuse it for item 26.

## 22. Pivot configurator panel **[SP]**

The UI for building a pivot: pick row fields, pick a column field, add value aggregations, toggle totals and subtotals.

**Adopt from:** `data-table-pivot-panel.tsx` (408 lines). Its props are a clean controlled interface, already separated from the engine.

**Enhancement over ScaffPlan:** their available-fields list is passed in as `AvailableColumn[]`; derive it from the column defs instead, filtered by a `meta.aggregatable` / `meta.groupable` flag, so a consumer configures pivot where they configure everything else. Drag-and-drop between "rows", "columns", and "values" buckets is the interaction people expect from Excel and reuses item 6's drag code.

## 23. Pivot charts and drill-down **[SP]**

Render the pivot result as bar, line, pie, area, or combo, with table/chart/both view modes. Clicking a data point opens the source rows behind it.

**Adopt from:** `pivot/pivot-chart-utils.ts` and `pivot-drill.tsx`. `transformPivotToChartData`, `getAvailableYAxisFields`, and `suggestChartType` are portable. The drill panel concept (click an aggregate, see the rows that produced it) is the feature that makes a pivot trustworthy rather than a black box.

**Enhancement over ScaffPlan:** chart rendering must not enter the entry chunk. Lazy-load it the way the Dashboard already lazy-loads x-charts. **[lib]** The charting library becomes a peer dependency with a render-prop escape hatch, since forcing a chart library on every consumer of a table component is a bad trade. Ship an x-charts adapter and let others bring their own.

## 24. Sparkline cells **[SP]**

An inline mini-trend per pivot row.

**Adopt from:** `pivot/pivot-sparkline.tsx` and `extractSparklineData`.

**Enhancement over ScaffPlan:** make it a general cell renderer, not a pivot-only one. A trend column in a normal table (orders per day for a building, for instance) is more broadly useful than the pivot-scoped version. Inline SVG, no chart library, no per-cell layout thrash.

## 25. Pivot filtering and sorting **[SP]**

Filter which group members appear, filter by aggregated value ("only groups where total > 1000"), and sort by an aggregate column.

**Adopt from:** `pivot/pivot-filter-utils.ts` (`extractUniqueMembers`, `applyMemberFilters`, `applyValueFilter`) and `pivot-sorting.ts`.

**Enhancement over ScaffPlan:** value filters must apply after aggregation and before subtotals, or the subtotals stop matching the visible rows. Their ordering is worth verifying against a test before porting.

## 26. Analytics view serialization

A pivot configuration is state like any other. It belongs in items 2 and 3: saved views should capture it, and URLs should be able to carry it.

**What is missing:** a compact serialization (the full `PivotConfig` in a URL is too long), and validation on load against the current column set.

---

# Track F: Library packaging **[lib]**

## 27. Headless core split

Separate the state and logic (`useDataTableState`, `useTableServerState`, `useTableInstance`, the pivot engine, the aggregation functions, the export serializers) from the MUI rendering layer.

**Why it matters:** the current split of `.tsx` for UI and `use*.ts` for logic already points this way and is most of the work. A headless core plus an MUI skin means the pivot engine and export logic are usable by consumers who do not use MUI, which is most of them.

**What is missing:** an entry-point structure (`/core`, `/mui`, `/router-tanstack`, `/charts-xcharts`), and a dependency audit to confirm the core imports nothing from `@/`.

## 28. Theme and i18n injection

Every user-facing string currently goes through our `t()`, and every colour through our MUI theme. Both are correct for the app and wrong for a library.

**What is missing:** a `labels` prop object with English defaults that our app fills from `t()`, and confirmation that no component reads theme tokens that a consumer's theme might not define. This is a hard requirement before publishing, and doing it late means touching every component twice.

**Note:** ScaffPlan hardcodes English throughout. Do not follow.

**Groundwork done 2026-08-28.** The last hardcoded English in the folder is gone (the reorder dialog's hint and buttons, the clear-search label, the inline-edit save-failure message), and the `?? 'English'` fallbacks that never fired now use `defaultValue`. Those `defaultValue` literals are the English defaults the `labels` prop will inherit, so the injection work is now mostly mechanical.

## 29. Accessibility conformance

`role="grid"` semantics, roving focus (item 7), `aria-sort` on sortable headers, labelled filter controls, announced loading and empty states, and a keyboard path to every mouse-only interaction (reorder, resize, pin).

**Why it matters:** this is a checklist item for any consumer with a procurement process, and it is far cheaper to build in than to retrofit. Neither implementation is there today.

**Partial, 2026-08-28.** The resize handle was a bare `<div>`: no role, no name, no tab stop, so column widths were mouse-only and the double-click reset was unreachable without a pointer. It is now the ARIA window-splitter pattern: `role="separator"`, `aria-orientation`, a translated label, `aria-valuenow/min/max`, a tab stop, and a focus ring. Arrow keys nudge the width by 8px (32px with Shift) through a new `resizeColumnBy` on `useColumnResize`, and Home resets the column. The global search box also got its helper text linked to the input, which needed `slotProps.htmlInput` rather than a prop on the `TextField` (MUI forwards unknown props to the root `FormControl`, where no screen reader looks).

Still open: `role="grid"` semantics, roving focus (item 7), `aria-sort`, announced loading and empty states, and a keyboard path to reordering and pinning.

## 30. Docs site and examples

Per-feature examples, a props reference, and a migration note per breaking change. **The server-side story is the differentiator** and deserves the most prominent example: every popular React table demo is client-side, and the gap between "sorts an array" and "drives a paginated API without double-fetching" is where most integrations go wrong.

---

# Track G: Performance

Neither reference implementation helps here. ScaffPlan uses the same `columnResizeMode: "onChange"` we do, has zero `React.memo`, no `useDeferredValue`, and no `startTransition`; their table is smaller only because it renders fewer features at once. The `smart` ancestors contribute exactly one thing, `VirtualizedBody.tsx` (item 14). Everything below came from reading our own render path against TanStack's published guidance.

**The working number.** A list page renders `pageSize` 50 rows against roughly 15 columns, so about 750 body cells, each one a React component with two context subscriptions and its own emotion class. That multiplier is what turns each item below from a micro-optimisation into a frame budget.

**Order matters.** Items 31 to 34 are the ones a user can feel. 35 to 38 are constant-factor work that only pays off once the first four stop dominating the profile. Item 39 comes first in practice, because none of the rest should be merged on the strength of an argument.

## 31. Column resize should not re-render the table on every mousemove

Today a single drag runs this loop at pointer rate, 60 to 120 times a second:

`useColumnResize.ts:64` writes `setColumnSizing` per `mousemove` with no throttle, so `columnSizing` changes identity, which changes `uiValue` at `DataTableContext.tsx:116`, which re-renders every consumer of `useTableUI()`, which is every row and every cell. `TableContainer.tsx:71` then rebuilds a `{width, minWidth, maxWidth}` object for **every** column, so every cell also receives a new `style` identity. Each cell re-serializes its `sx` array. And the persistence effect at `useDataTableState.ts:325` has `columnSizing` in its dependency list, so it fires and re-arms its debounce timer on every frame too. `columnResizeMode: 'onChange'` at `useTableInstance.ts:168` sits underneath all of it, running the commit-sizing loop on each event.

Three fixes, in order of payoff:

1. **Drive width from a CSS custom property during the drag.** Write `--dt-col-w-{id}` onto the table element on `mousemove` and commit to React state once on `mouseup`. Zero renders while dragging. We already own this exact technique: `useColumnPinning.ts:197` and `TableHeader.tsx:296` use `ResizeObserver` plus `style.setProperty` for pin offsets. Extend the same mechanism to widths instead of inventing a second one.
2. **Switch to `columnResizeMode: 'onEnd'`** and render the drag preview as a `translateX(deltaOffset)` transform on the handle, which is TanStack's own example. Cheaper to implement than 1, slightly less live-feeling, and it skips the commit loop entirely.
3. **Coalesce the `mousemove` handler into `requestAnimationFrame` regardless.** One frame is the most work a pointer event can usefully cause, and this is a five-line change that caps the damage even before 1 or 2 land.

Also exclude `columnSizing` from the persistence effect's dependency array and persist it from the `mouseup` commit instead. The effect exists to save preferences, not to observe a drag.

**Enhancement over both references:** ScaffPlan gets away with `'onChange'` because their pin offsets require `table-fixed`, which makes the browser's own layout cheap. We do not have that constraint. A CSS-variable resize is strictly better than either mode and is the thing worth shipping in the published library.

## 32. Body cells force a synchronous layout on every data change

`TableCell.tsx:91` reads `element.scrollWidth > element.clientWidth` inside a `useEffect`, per cell, with `cellValue` in the dependency array. Every read forces the browser to flush pending layout. At 750 cells that is 750 forced reflows on the first render after a refetch, a sort, a page change, or a filter apply.

The header already solved this. `TableHeader.tsx:296` uses a `ResizeObserver` for exactly the same truncation check. The body never got the fix.

Three options, cheapest first:

- **Measure on hover.** The measurement's only consumer is the tooltip, and the tooltip only appears on hover. Move the check into `onMouseEnter` and the steady-state cost goes to zero. This is the correct fix for the common case and should be the default.
- **One `ResizeObserver` per table**, observing the `.cell-content` nodes, batching all entries into a single state write. Correct when a tooltip has to be discoverable without hovering.
- Keep the effect only for cells that opt into an overflow mode requiring eager measurement.

## 33. Every cell subscribes to two contexts that churn

`TableCell.tsx` reads `useTableUI()` and `useTableEditingContext()`; `EditableCell` reads the editing context again. Two consequences:

- `uiValue` carries `rowSelection`, `pagination`, `sorting`, `expanded`, `columnSizing`, and `columnVisibility` in one object. Ticking a single checkbox invalidates it and re-renders all 750 cells, when the only thing that changed was one row's background.
- `editingValue` carries `editingData`, which changes on **every keystroke** during an inline edit. Typing a ten-character value in one cell re-renders the other 749 ten times.

The context file already split core from UI from editing. It did not split far enough. Two ways forward:

- **Smallest diff, biggest win: stop subscribing.** `TableRow` already reads `density` and `isEditing`. Pass `density` and `isRowEditing` down to `TableCell` as props. The cell then subscribes to nothing, and selection churn stops at the row boundary.
- **Structural: split by change frequency.** `density` into its own context (changes approximately never), `editingRowId` separate from `editingData` so only the editing row consumes the value that changes per keystroke.

Do the first now, the second as part of item 27 when the contexts are being redesigned for the headless split anyway.

## 34. One MUI `<Menu>` is constructed per row

`TableRow.tsx:273` renders a `<Menu>` per row whenever the row has actions. MUI's `Modal` returns null when closed, but React still constructs the whole element tree first: for each row, a `MenuItem`, a `ListItemIcon`, a `ListItemText`, and a `Divider` per action, plus a `slotProps.paper.sx` object literal. Fifty rows times five actions is roughly 250 discarded element trees per render, every render. `visibleActions` at `TableRow.tsx:98` also re-runs each `action.hidden(row.original)` predicate per row per render, allocating a new array.

**Fix:** hoist a single `<Menu>` to `TableBody`, holding `{anchorEl, row}` in state. The row keeps only its `IconButton`. This is also better behaviour, not just cheaper: one menu instance cannot get into the state where two are open, and the anchor logic stops being duplicated 50 times.

## 35. Cell render weight

Five separate constant-factor problems, all in `TableCell.tsx` and `TableRow.tsx`, all cheap to fix and worth doing together:

- **`row.getAllCells().filter(isColumnVisible)`** (`TableRow.tsx:143`) constructs cell objects for hidden columns and then throws them away, duplicating logic TanStack already memoizes in `getVisibleCells()`. With 5 of 15 columns hidden that is a third of the work wasted, plus a fresh array per row per render. The manual filter was added to defeat a React Compiler caching problem, but `orderSignature` (`TableRow.tsx:67`) already covers that, so the filter is now redundant. Switch to `getVisibleCells()` and keep the signature.
- **`computeOverflowStyles()`** (`TableCell.tsx:101`) returns a fresh object per cell per render. A whole table has maybe six distinct results across the three overflow modes. Cache them in a module-level `Map` keyed by `${overflowMode}|${truncate}|${maxWidth}`. Same treatment for the `sx={[...]}` array literal at `TableCell.tsx:139` and for `pinnedBodyCellSx()` at `TableRow.tsx:148`, which rebuilds a nested object with theme callbacks per pinned cell per render. Emotion caches on object identity; a fresh literal is a guaranteed miss.
- **`getRowSx(row.original)`** spread inline at `TableRow.tsx:139` makes the row's entire `sx` a new object every render, so the selected-hover theme callbacks re-serialize per row.
- **The `.cell-content` wrapper** (`TableCell.tsx:121` and `:126`) adds 750 DOM nodes and 750 emotion classes purely to host overflow styles. When the overflow mode is the default and nothing needs measuring, put those styles on the `MuiTableCell` and skip the `Box`.
- **`EditableCell`** (`TableCell.tsx:99`) is a component boundary on every cell even when the table has no `onRowEdit` and the column has no edit config. That is 750 extra fibers and 750 context reads for a feature most of our tables do not enable. When editing is off for that column, call `flexRender` directly.

## 36. Expansion scaffolding is built for rows that are not expanded

Two problems at `TableBody.tsx`:

- **Line 85** gates the expanded-content row on `(animateExpansion || rowIsExpanded)`. `animateExpansion` defaults to `true`, so **every** row gets a second `<tr>`, a `<td>`, and a `<Collapse>` even when collapsed. `unmountOnExit` keeps the children out, but the wrappers double the table's row count. Render the wrapper only when the row is expanded or has been expanded at least once, and let the mount animate in.
- **Line 52** puts `expanded` in the `rows` memo dependencies, so expanding one row invalidates the entire row list and re-renders all 50. Expansion is per-row state; read it in the row instead, or keep a separate memo keyed on the row model alone.

Related: `useTableInstance.ts:178` installs `getExpandedRowModel()` unconditionally and only gates `getRowCanExpand`. The row model still runs its pass on every table build for tables that never expand anything. Gate the model on `enableExpanding` the way `getGroupedRowModel` already is at line 90.

## 37. Effect churn in state management

- The persistence effect (`useDataTableState.ts:325`) has twelve dependencies, including `columnSizing`. Covered by item 31, but the general shape is worth fixing: persistence should be triggered by the commit points that change preferences, not by an effect observing every slice of state.
- The clear-selection-on-page-change effect keeps `rowSelection` in its dependency array, so it re-runs on every checkbox toggle to decide it has nothing to do. Compare page identity in a ref instead.
- `DataTable.tsx:233` recomputes `getFilteredSelectedRowModel()` on every selection change. It is correctly gated behind `needsSelectedRows`, but under `manualFiltering` the filtered model is an identity pass, so this is an O(n) walk per click. Fine at 50 rows, worth revisiting alongside item 14.

## 38. Make column memoization explicit at the page level

`useOrders.ts:249` and `:576`, `useCustomers.ts:410`, and `useVendors.ts:646` all build `columns` and `rowActions` as plain array literals with conditional `.push()`, relying entirely on the React Compiler to memoize them. When it works, it works. When one unstable value slips inside (an inline closure over a fresh callback, an unmemoized `t`), the whole array rebuilds, TanStack rebuilds every column, and the table invalidates completely.

The failure is silent and the blast radius is the entire table. Wrap them in explicit `useMemo` with named dependencies. This costs nothing at runtime, makes the dependency surface reviewable in a diff, and is required regardless for item 27, where a published library cannot assume its consumers compile with the React Compiler.

## 39. A measurement harness and a perf budget

Nothing above should be merged on the strength of the argument alone. Before starting the track:

- A profiling fixture page rendering the real Orders columns at 50, 200, and 1000 rows.
- Recorded React Profiler baselines for the four interactions that matter: initial render, sort, page change, and a resize drag.
- A `performance.measure` around commit for the resize drag specifically, since that is the one with a hard 16ms budget.
- A regression check in CI asserting render counts for a fixed interaction. Render count is the stable signal; wall-clock on CI hardware is not.

Publish the before and after per item. An npm library's performance claims have to be defensible, and "we removed 750 forced reflows" is a claim, not a feeling.

---

# Adopting from ScaffPlan

Direct file-level mapping. Their table lives at `packages/ui/src/components/data-table` in the ScaffPlan WebUI repo.

| ScaffPlan source                    | Lines | Take                                      | Item |
| ----------------------------------- | ----- | ----------------------------------------- | ---- |
| `data-table.tsx` (visibility block) | ~40   | Preferences-only persistence model        | 1    |
| `data-table-filter-indicator.tsx`   | 156   | Component, plus operator-aware labels     | 5    |
| `data-table-view-options.tsx`       | 462   | Search, groups, `canMoveOnto` drag rule   | 6    |
| `data-table.tsx` (keyboard block)   | ~25   | Handler shape only, rebuild the ARIA      | 7    |
| `data-table-bulk-actions.tsx`       | 79    | Floating bar pattern                      | 8    |
| `data-table-detail-panel.tsx`       | 345   | Structure and navigation, re-key by id    | 9    |
| `data-table.tsx` (`handleExport`)   | ~50   | Label chain and empty-column guard        | 15   |
| `data-table-faceted-filter.tsx`     | 333   | Interaction; counts must come from the BE | 17   |
| `data-table-editable-cell.tsx`      | 171   | Value re-sync and inline validation       | 18   |
| `data-table-aggregations.ts`        | 206   | Function set, fix the empty-input cases   | 20   |
| `pivot/pivot-engine.ts`             | ~440  | Whole engine, retype and cap cardinality  | 21   |
| `data-table-pivot-panel.tsx`        | 408   | Controlled interface, derive fields       | 22   |
| `pivot/pivot-chart-utils.ts`        | ~370  | Transform utilities                       | 23   |
| `pivot/pivot-drill.tsx`             | 205   | Drill-to-source concept                   | 23   |
| `pivot/pivot-sparkline.tsx`         | ~120  | Generalise beyond pivot                   | 24   |
| `pivot/pivot-filter-utils.ts`       | ~110  | Member and value filters                  | 25   |

**Do not adopt:**

- **`getSize()`-based pin offsets.** Only correct under `table-fixed`. See item 4.
- **Their resize implementation.** ScaffPlan runs the same `columnResizeMode: "onChange"` with no memoization anywhere, so it shares our problem rather than solving it. See item 31.
- **Client-side export, facet counts, and aggregation as defaults.** All three assume the full dataset is in the client, which our state model does not guarantee. Keep the code, change the data source.
- **The 2,289-line `data-table.tsx` structure.** Our `core/`, `filters/`, `editing/`, `hooks/`, `toolbar/` split is the better base and should absorb their features, not the reverse.
- **`any` typing.** `value: any`, `setGlobalFilter(value: any)`, `(columnDef as any).headerText`. Retype at the boundary; our rules forbid it and a published library cannot ship it.
- **Hardcoded English.** See item 28.
- **`usePersistedComplexState`.** We have `useTableStatePersistence`. Take the model from item 1, not the hook.
- **Identity-based row lookup** (`findIndex(r => r.original === data)`). Breaks on refetch. Key by row id everywhere.

**What ScaffPlan does not have, so nothing to copy:** saved views (2), URL state (3), server-side export (16), bulk rollback (19), "why is this row here" (12), diff highlighting (13), fit-to-content widths (10).

---

## Suggested sequence

1. **Item 1** first. It is small, and items 2, 3, 6, and 26 all sit on it.
2. **Items 5, 6, 15** next. Visible wins, no dependencies, roughly a day each.
3. **Item 16** alongside 15, because the current export is quietly wrong under server pagination.
4. **Items 4, 8, 10** to finish the current UX gaps.
5. **Item 20** opens Track E with the smallest correct slice.
6. **Items 21, 22** are the real pivot investment. Do them behind a flag with the engine tested in isolation before any UI exists.
7. **Track F** starts in parallel at item 28, because retrofitting i18n after every component is written costs double.
8. **Track G runs on its own clock.** Item 39 (measurement) before anything else in the track, then 31 to 34 in order. They are independent of every other track and each is roughly a day. Item 31 is the only one a user complains about today.

## Non-goals

- **A second table implementation for special cases.** Payout orders and payment history are the two accepted exceptions; new ones need a written reason (see `.claude/skills/datatable-lists`).
- **Per-page copies of table state wiring.** Pages observe `onServerStateChange` and nothing else.
- **A bundled charting library.** Peer dependency with an adapter, per item 23.
- **Client-side aggregation over a paginated page, presented as a total.** Either load the full set, ask the server, or show nothing. Never a wrong number.

_(Previously listed here: right-edge pinning and pivot. Both moved into scope with the library direction.)_
