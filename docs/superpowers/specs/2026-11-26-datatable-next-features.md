# `@vt-labs/datatable`: next features

Approved 2026-11-26, with the mocks, for building. Each item becomes a task-by-task plan in `docs/superpowers/plans/open/`
when picked up. Item numbers match [`../../packages/datatable/roadmap.md`](../../packages/datatable/roadmap.md),
which keeps the longer argument for each.

Out of scope here: pivot (21 to 26), the performance track (31 to 39), i18n injection (28),
keyboard navigation (7), saved views (2) and URL state (3).

## Answers to the open questions (2026-11-26)

Where an item below lists an open question, this table is the answer. The mocks were
approved as drawn; where they show a choice, the choice stands.

| #   | Question                      | Answer                                                                                                                   |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 19  | Inline alert or callback only | Both: the inline alert (as mocked) and `onBulkActionResult`                                                              |
| 41  | `cardTapAction` default       | `'select'`, today's behaviour; `'open'` is opt-in until a major                                                          |
| 1   | Stored state in the old shape | Read it, keep the preference fields, drop the rest; never throw on a bad entry                                           |
| 8   | The "all matching" contract   | The action gets `allMatching: true` and the current `ServerTableState`, not ids                                          |
| 16  | Return a Blob; the cap        | Rows only; the cap is 10,000, overridable by a prop                                                                      |
| 5   | Chips on by default           | No: opt in with `enableFilterChips`                                                                                      |
| 10  | Density in the Display menu   | No: density stays where it is                                                                                            |
| any | A question not answered here  | Take the option that adds no breaking change and the least public surface, and say which in the commit and the changeset |

## Recommended order

| Order | #       | Feature                                     | Size | Bump  | Depends on             |
| :---: | ------- | ------------------------------------------- | :--: | ----- | ---------------------- |
|   1   | 43      | Consumer controls in the toolbar            |  S   | minor | nothing (plan drafted) |
|   2   | 15 + 40 | Export follows the screen; opt a column out |  S   | minor | nothing                |
|   3   | 16      | Export every matching row                   |  M   | minor | 15 + 40                |
|   4   | 19      | Partial bulk-action results (slice)         |  S   | minor | nothing                |
|   5   | 41      | Card tap and keyboard behaviour             |  M   | minor | nothing                |
|   6   | 42      | Card view selection and sort bar            |  S   | minor | nothing; pairs with 41 |
|   7   | 1       | Preferences-only persistence                |  M   | minor | nothing                |
|   8   | 5       | Active filter chips                         |  S   | minor | nothing                |
|   9   | 6       | Columns popover: search, groups, reset      |  M   | minor | 1                      |
|  10   | 8       | Sticky selection bar                        |  M   | minor | 19 (same bar)          |
|  11   | 10      | Display menu                                |  M   | minor | nothing                |
|  12   | 20      | Aggregation footer (client slice)           |  M   | minor | nothing                |

Items 1 to 6 come from a consuming admin app (2026-10-26), so they go first.

---

## 1. Consumer controls in the toolbar (#43)

**Goal:** give a screen one place in the toolbar for its own controls, in line with search and
filters.

**Proposed API**

```ts
interface DataTableProps<TData> {
  /** Rendered in the toolbar after the search box. */
  toolbarContent?: ReactNode;
}
```

**Behaviour**

- Renders after `GlobalSearch`, before the right-hand icon group.
- Wraps with the rest of the toolbar on a narrow screen; no second position.

**Plan:** already written as `docs/superpowers/plans/open/2026-09-30-datatable-toolbar-slot.md`
on branch `docs/datatable-consumer-plans`. Cherry-pick it onto `main` and execute it; do not
write a second one.

**Tests/stories:** as in that plan. A story with a status `Select` in the slot, whose `play`
picks a value and asserts the toolbar still holds search and the slot in one row.

**Changeset:** minor, a new optional prop.

**Open questions:** none beyond the plan's.

## 2. Export follows the screen, and a column can opt out (#15 + #40)

**Goal:** the file holds the columns the user sees, in the order they see them, under the
headings they see, minus the columns that make no sense in a file.

**Proposed API**

```ts
interface DataTableColumnDef<TData> {
  /** `false` keeps a visible column out of every export. Defaults to `true`. */
  enableExport?: boolean;
}
```

**Behaviour**

- `ExportMenu` reads `getVisibleLeafColumns()`, so the file follows the user's column order.
- Header label chain: `meta.label`, then a string `header`, then the humanized id.
- Skips `select`, `actions` and any column with `enableExport: false`.
- When no column is left, no file is written and the menu item is disabled with a tooltip
  from `labels`.

**Tests/stories**

- Unit: reordered columns export in screen order; `enableExport: false` drops a visible column;
  a component header falls back to the humanized id; zero columns writes nothing.
- Story "Export" with a thumbnail column opted out; `play` opens the menu and asserts the
  captured CSV headers.

**Changeset:** minor. #15 alone is a behaviour fix (patch), but it ships with the new
`enableExport` flag. The changeset says the column order in exported files changes.

**Open questions**

- Do we want the reverse (hidden on screen, included in the file) now? Nobody has asked.

## 3. Export every matching row (#16)

**Goal:** under server pagination, export what the filters match, not the loaded page.

**Proposed API**

```ts
interface DataTableProps<TData> {
  /** Fetches every row matching the current state, for export. */
  exportRows?: (state: ServerTableState) => Promise<readonly TData[]>;
  /** Most rows an export may hold. Defaults to 10 000. */
  exportRowLimit?: number;
}
```

**Behaviour**

- With `exportRows`, each format splits into "Current page (n rows)" and "All matching
  (N rows)", N from the total row count.
- "All matching" shows progress in the menu and can be cancelled. Above `exportRowLimit` the
  item is disabled and says why.
- Without `exportRows` under `manualPagination`, the item reads "Current page" so the file is
  never silently partial.
- The same column rules from item 2 apply to fetched rows.

**Tests/stories**

- Unit: `exportRows` receives the live `ServerTableState`; the cap disables the item; a
  rejected promise surfaces an error through `onExportComplete` and labels.
- Story with a delayed `exportRows`; `play` picks "All matching", asserts the progress state,
  then the row count in the captured file.

**Changeset:** minor, new optional props; the "Current page" wording is a visible change and
is named.

**Open questions**

- Should `exportRows` also be allowed to return a `Blob` from the consumer's own export
  endpoint?
- Is 10 000 the right default cap?

## 4. Partial bulk-action results (#19, smallest slice)

**Goal:** tell the user "8 updated, 2 failed" and leave the failures selected for a retry.

**Proposed API**

```ts
interface BulkActionResult {
  succeeded: readonly string[]; // row ids
  failed: readonly string[];
}

interface BulkAction<TData> {
  onClick: (rows: TData[]) => void | BulkActionResult | Promise<void | BulkActionResult>;
}

interface DataTableProps<TData> {
  onBulkActionResult?: (action: BulkAction<TData>, result: BulkActionResult) => void;
}

// labels
bulkResult: (succeeded: number, failed: number) => string;
```

**Behaviour**

- An action that returns nothing behaves as today.
- On a result: succeeded rows leave the selection, failed rows stay selected, an inline
  `Alert` (severity from the outcome) shows in the bulk bar until the selection changes or
  the user closes it.
- `onBulkActionResult` fires after the alert, for logging or a toast.

**Tests/stories**

- Unit: void result clears as today; mixed result keeps only failed ids; all-failed keeps all.
- Story "Bulk actions, partial failure"; `play` selects five rows, runs the action, asserts
  the alert text and that two rows stay checked.

**Changeset:** minor; the return type widens, existing actions compile unchanged.

**Open questions**

- Inline alert, or callback only and let the consumer toast? The alert works with no wiring;
  the callback alone keeps the table quieter.

## 5. Card tap and keyboard behaviour (#41)

**Goal:** one tap does one thing, and a keyboard user can reach and open a card.

**Proposed API**

```ts
interface DataTableProps<TData> {
  /**
   * What a tap on a card does below `mobileBreakpoint`.
   * `'open'` calls `onRowClick` only; selection moves to the checkbox.
   * `'select'` keeps today's behaviour. Defaults to `'select'` in 1.x.
   */
  cardTapAction?: 'open' | 'select';
}
```

**Behaviour**

- `'open'`: tap calls `onRowClick`, never toggles selection or expansion.
- Every card is focusable with a theme focus ring and an accessible name from the primary
  column. `Enter` opens (when `onRowClick` is set), `Space` toggles selection.
- The next major makes `'open'` the default whenever `onRowClick` is set.

**Tests/stories**

- Unit: both modes, with and without `onRowClick`; checkbox and menu still stop propagation.
- Story "Card view, tap opens"; `play` tabs to a card, presses `Enter`, asserts `onRowClick`
  and that nothing was selected; presses `Space`, asserts selection. axe must pass.

**Changeset:** minor; the default does not change. The changeset announces the 2.0 default.

**Open questions**

- Keep `'select'` as the 1.x default, or flip it now as a minor with a loud changeset? Only one
  known consumer uses cards.

## 6. Card view selection and sort bar (#42)

**Goal:** a phone user can select all, clear a selection and sort.

**Proposed API:** no new props. Renders whenever the card view is active and the table is
selectable or has a sortable column. New labels: `selectAllOnPage`, `selectedCount(n)`,
`clearSelection` (exists), `sortBy`, `sortAscending`, `sortDescending`.

**Behaviour**

- A bar above the cards: select-all checkbox (indeterminate when some are selected,
  page-scoped like the desktop header), "n selected · Clear", and a Sort button.
- Sort opens a menu of sortable columns plus an asc/desc toggle, writing the same `sorting`
  state the headers write, so server mode refetches as usual.

**Tests/stories**

- Unit: indeterminate state; select-all scope is the page; sort writes `sorting` and resets
  `pageIndex`.
- Story "Card view controls" at a phone viewport; `play` selects all, asserts the count,
  sorts by a column, asserts order.

**Changeset:** minor, new UI in the card layout.

**Open questions**

- Should the bar be opt-out (`enableCardToolbar?: false`) for consumers who render their own?

## 7. Preferences-only persistence (#1)

**Goal:** storage holds what the user chose, never what the column defs declare, so a changed
default reaches users who have used the table.

**Proposed API**

```ts
interface DataTableColumnDef<TData> {
  meta?: {defaultHidden?: boolean};
}
```

**Behaviour**

- Visibility, order, width and pinning resolve as `{...defaults, ...preferences}` at render.
- A setter writes only the ids the user changed; untouched defaults are stripped out.
- On load, ids no longer in the column set are dropped.
- Migration: an existing stored entry is read once as preferences, then rewritten in the new
  shape under a version key.

**Tests/stories**

- Unit: a default flipped in a later release takes effect; a user toggle survives it; stale ids
  drop; an old-format entry migrates once.
- Story "Persistence" with a `defaultHidden` column; `play` toggles another column, remounts,
  asserts both states.

**Changeset:** minor, with a careful note. Risk: users who stored a full map keep it, so a
default changed in the same release does not reach them until they reset. The changeset says
so.

**Open questions**

- Migrate old entries as preferences (keeps what users see) or discard them (cleaner, users
  lose their layout once)?

## 8. Active filter chips (#5)

**Goal:** one row that says what is narrowing the list, with a way to undo each part.

**Proposed API**

```ts
interface DataTableProps<TData> {
  enableFilterChips?: boolean; // default false in 1.x
}
// labels: filterChip(column, operator, value), clearAllFilters, operator words
```

**Behaviour**

- A chip row under the toolbar, one chip per active filter plus global search.
- Operator-aware text: "Status is not Cancelled", "Total between 10 and 50".
- Driven by `ServerTableState`, so a chip shows what was sent to the API.
- Each chip clears its filter; "Clear all" clears all. Every clear resets `pageIndex` to 0.

**Tests/stories**

- Unit: chip text per operator; empty values render no chip; clears reset the page.
- Story "Filter chips"; `play` applies two filters, removes one chip, asserts the request state
  and page 1.

**Changeset:** minor.

**Open questions**

- Default on or off? Off keeps 1.x screens unchanged.

## 9. Columns popover: search, groups, reset (#6)

**Goal:** make a 15-plus column list usable.

**Proposed API**

```ts
interface DataTableColumnDef<TData> {
  meta?: {group?: string};
}
// labels: searchColumns, hiddenCount(n), resetColumns
```

**Behaviour**

- A search box matching label and column id; drag indices resolve against the full list.
- `meta.group` buckets columns under headings; a drag stays inside its group.
- A "Hidden (n)" count, and "Reset columns" clearing visibility, order, width and pinning
  preferences from item 7.
- The list is built only while the popover is open.

**Tests/stories**

- Unit: search by id; a cross-group drop is refused; reset clears all four preferences.
- Story "Grouped columns"; `play` searches, hides one, resets, asserts defaults.

**Changeset:** minor.

**Open questions**

- Should groups be collapsible, or headings only?

## 10. Sticky selection bar (#8)

**Goal:** keep the selection count and actions in view while scrolling.

**Proposed API**

```ts
interface DataTableProps<TData> {
  bulkActionsPosition?: 'inline' | 'sticky'; // default 'inline'
}

interface BulkActionContext {
  /** true when the user chose "Select all N matching"; `rows` is then the page only. */
  allMatching: boolean;
}
// BulkAction.onClick(rows, context)
```

**Behaviour**

- `'sticky'`: a floating bar at bottom centre, mounted only when the count is non-zero, padded
  by `env(safe-area-inset-bottom)`.
- When the whole page is selected and more rows match, the bar offers "Select all N matching".
  Bulk actions then get `allMatching: true` and must act on the filter, not the ids.
- Reuses item 4's result alert.

**Tests/stories**

- Unit: mounts on first selection; all-matching flag reaches the action; clearing drops it.
- Story "Sticky bulk bar" with a tall page; `play` selects, scrolls, asserts the bar is in view,
  picks all matching.

**Changeset:** minor.

**Open questions**

- The all-matching contract: a flag plus the current `ServerTableState`, or a separate
  `onAllMatching` action handler? Either way the consumer's API must support "by filter".

## 11. Display menu (#10)

**Goal:** wrap, fullscreen and fit-to-content in one toolbar menu.

**Proposed API**

```ts
interface DataTableProps<TData> {
  enableDisplayMenu?: boolean;
}
// labels: display, wrapCells, fullscreen, exitFullscreen, fitColumns
```

**Behaviour**

- "Wrap cells" toggles `cellOverflow` between the prop's value and `wrap`, persisted per
  `tableId`.
- "Fullscreen" uses the Fullscreen API on the table container, with `Escape` to leave.
- "Fit columns to content" measures the widest rendered cell per column (header included) and
  writes sizing. The measurement utility is shared with pinning offsets.

**Tests/stories**

- Unit: wrap toggles and persists; fit writes widths within min/max.
- Story "Display menu"; `play` toggles wrap and fit, asserts a column width changed.

**Changeset:** minor.

**Open questions**

- Should density move into this menu, freeing a toolbar slot?

## 12. Aggregation footer, client slice (#20)

**Goal:** a correct totals row, or none.

**Proposed API**

```ts
type Aggregate =
  | 'sum'
  | 'avg'
  | 'count'
  | 'min'
  | 'max'
  | 'median'
  | 'distinct'
  | ((values: readonly unknown[]) => number | null);

interface DataTableColumnDef<TData> {
  meta?: {
    aggregate?: Aggregate;
    formatAggregate?: (value: number) => ReactNode;
  };
}

interface DataTableProps<TData> {
  /** Server mode: totals the API computed. Missing ids show nothing. */
  aggregates?: Record<string, number | null>;
}
```

**Behaviour**

- Client mode: computes over the filtered row model.
- Server mode: never computes over the page; reads `aggregates` and renders nothing (not 0)
  for a missing or `null` value.
- Empty input gives `null`; `avg` ignores nulls; `median` handles even lengths.

**Tests/stories**

- Unit: each function with empty, null and even-length input; server mode ignores the page.
- Story "Totals" on a client dataset; `play` filters and asserts the footer sum updates.

**Changeset:** minor.

**Open questions**

- Subtotals per group wait for row grouping (#11). Agreed?
