# `@vt-labs/datatable` toolbar content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a consumer put its own controls in the table's toolbar, right after the search box. The case that asked for it: an icon button that opens a status menu (with a count badge) and drives a query param the table knows nothing about.

**Architecture:** One optional prop, `toolbarContent?: ReactNode`, on `DataTableProps`. `DataTable` passes it straight to the internal `DataTableToolbar`, which renders it in a small flex wrapper between the search box and the active-filter chip. Nothing new is exported from `index.ts`; the toolbar and its parts stay internal.

**Tech Stack:** React 19, MUI 9, TanStack Table 8, Vitest 4 (jsdom), Storybook 10 with the Vitest addon.

**Spec:** none separate. The design is settled in the "Design" section below; the plan argues from it.

## Design

**The API: `toolbarContent?: ReactNode`, not a `slots` entry.**

- `slots` is for chrome the table would otherwise render itself and that a consumer _replaces_ (`slots.confirmDialog` takes `DataTableConfirmProps`). The component-authoring skill sets that rule: a slot is a `ComponentType` with a documented props type. This feature replaces nothing and the table has no props to hand the control, so a slot would mean an empty props contract plus the "pass a stable component reference" rule, for no gain.
- A `ReactNode` closes over the consumer's own state (`status`, `setStatus`) the way any JSX does. A slot component would have to reach that state through context or a module-level component.
- `index.ts` keeps its rule that parts stay internal. The consumer gets a _position_ in the toolbar, not the toolbar: no toolbar component, no toolbar props type, no new export. The new field rides on the already-exported `DataTableProps`, so the bump is a minor.
- One position, not `toolbarStart` plus `toolbarEnd`. The only case in hand is "beside search". A second position later is an additive, minor change; an unused one now is surface to support forever.

**Placement.** In the left group, directly after the search box and before the active-filter chip, the **Reset filters** button and the mobile bulk menu. Before the chip on purpose: the chip and the reset button appear and disappear with the table's own filter state, and a control placed after them would jump sideways every time a filter is set. With `enableGlobalFilter={false}` the control is first in the row.

**When the toolbar is hidden.** `toolbarContent` lives inside the toolbar, so `showToolbar={false}` hides it too, the same as the built-ins. `showToolbar`'s JSDoc already says it hides the toolbar's controls; this keeps that one meaning. With every built-in switched off the toolbar still renders (and `DataTable` always passes `onResetToDefault`, so the reset-to-default button is still there); the consumer's controls sit in it as usual.

**Filter state.** The table's active-filter chip and **Reset filters** cover only the table's own column filters and search. A consumer control that filters is the consumer's to count and to reset. The prop's JSDoc says so.

**Mobile and narrow widths.** `src/mobile` (`CardView`) is not touched: below `mobileBreakpoint` the same toolbar renders above the cards. Below MUI's `sm` the toolbar still stacks (`flexDirection: {xs: 'column'}`). Without `toolbarContent`, `GlobalSearch` keeps its current full-row width (`minWidth: {xs: '100%'}`) and nothing else about the layout changes. With `toolbarContent`, the two share a row instead of the content wrapping under a full-width search box: `GlobalSearch` takes a new `flexible` prop that drops its fixed width for `flex: 1, minWidth: 0`, and sits with the consumer's controls in a `flexWrap: 'nowrap'` row, the content at its end. The content's own wrapper stays `flexWrap: 'wrap'` with `gap: 0.5`, so several controls stay together and wrap among themselves if they do not fit, rather than overflowing a 320px screen or being pushed off it. jsdom does not resolve a breakpoint-gated style through `getComputedStyle` in this project's test setup, so Task 1's test asserts only the unconditional `flexWrap`/`flex`/`minWidth` values that make the sharing possible; the visual result at a real narrow viewport is a manual check in the story (Task 3).

**Accessibility.** No role or label is added around the consumer's controls, and the toolbar keeps its current markup (no `role="toolbar"`). That role promises arrow-key roving focus, which neither the built-ins nor a consumer's control implement, and a search textbox inside it would fight the arrow keys. Focus order is DOM order: search box (and its clear button when it has text), the consumer's controls, **Reset filters**, then the right-hand built-ins. Each consumer control must carry its own accessible name (an icon button needs `aria-label`); the JSDoc says so and the story shows it.

## Global Constraints

- No new export from `packages/datatable/src/index.ts`. `index.test.ts` must pass unchanged; if it fails, stop, something leaked into the surface.
- The table adds no user-facing string for this feature. Every string in the story belongs to the consumer's control.
- No hardcoded colour, radius or font. The wrapper's `sx` is layout only (`display`, `alignItems`, `flexWrap`, `gap`).
- Icons deep-imported (`@mui/icons-material/FilterList`), never the barrel.
- No hand-written `useMemo`/`useCallback`; the React Compiler is on ([decision 0003](../../../decisions/0003-react-compiler.md)). `toolbarContent` is a prop, so a new element from the consumer re-renders the toolbar with no extra work.
- Never `any`, `@ts-ignore`, `@ts-expect-error`, `as unknown as`.
- Human-readable text (JSDoc, comments, story notes, README, changeset): no em-dashes, no filler, and no consuming product named. Say "a consumer".
- One unit of work, one commit. The code, its tests, the stories, the changeset, the README, the roadmap row and the plan's move to `done/` land together (root `CLAUDE.md`, "Git"). Tasks 1 to 3 end with a checkpoint, not a commit; Task 4 ends with the handoff.

## Review Focus

1. **The control does not move when a table filter is set.** Expected: it renders before the active-filter chip and **Reset filters**, so setting a column filter adds elements after it. Test in Task 1 (tab order with a filter active).
2. **`showToolbar={false}`.** Expected: the consumer's control is hidden with the rest. Test in Task 2.
3. **Focus order.** Expected: Tab from the search box lands on the consumer's control, then **Reset filters**, then the columns button. Test in Task 1.
4. **A phone.** Expected: the control still renders above the card list, and on a real narrow viewport it shares the search box's row instead of wrapping under it or overflowing. Test in Task 1 for the unconditional `flexWrap`/`flex`/`minWidth` values jsdom can resolve, Task 2 for presence above the cards; Task 3 has a manual viewport check for the visual result, because the story runner does not apply `globals.viewport` (see the note on the `MobileCards` story).
5. **The consumer's control re-renders from its own state.** Expected: after picking a status, the trigger's accessible name changes and focus returns to it. `play` function in Task 3.
6. **Semver.** One optional field on `DataTableProps`, no default changed, no export added: minor.

---

### Task 1: The toolbar renders consumer controls after the search box

**Files:**

- Modify: `packages/datatable/src/toolbar/DataTableToolbar.tsx`
- Modify: `packages/datatable/src/toolbar/GlobalSearch.tsx`
- Test: `packages/datatable/src/toolbar/DataTableToolbar.test.tsx`

**Interfaces:**

- Consumes: nothing new.
- Produces: `DataTableToolbarProps<TData>.toolbarContent?: ReactNode` (internal type, not exported); `GlobalSearchProps.flexible?: boolean` (internal type, not exported) so the toolbar can ask the search box to share its row with `toolbarContent` instead of claiming the full row.

- [x] **Step 1: Write the failing tests**

Append to `packages/datatable/src/toolbar/DataTableToolbar.test.tsx`, after the "optional controls" `describe` block and before the "mobile bulk actions" one. `renderToolbar`, `onFiltersReset`, `bulkActions` and `DEFAULT_LABELS` are already in the file.

```tsx
describe('DataTableToolbar consumer controls', () => {
  const statusButton = <button type="button">Filter by status</button>;

  it('takes focus between the search box and the table controls', async () => {
    // A column filter is active, so the chip and Reset filters are on screen. The consumer
    // control has to sit before them: they come and go with the table's own filters, and
    // anything after them would jump sideways every time one is set.
    renderToolbar({
      toolbarContent: statusButton,
      columnFilters: [{id: 'name', value: 'a'}],
      onFiltersReset,
      enableColumnVisibility: true,
    });

    await userEvent.click(screen.getByPlaceholderText(DEFAULT_LABELS.globalSearch));
    await userEvent.tab();
    expect(screen.getByRole('button', {name: 'Filter by status'})).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByRole('button', {name: DEFAULT_LABELS.resetFilters})).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByRole('button', {name: DEFAULT_LABELS.columns})).toHaveFocus();
  });

  it('keeps the control when the search box is off', () => {
    renderToolbar({toolbarContent: statusButton, enableGlobalFilter: false});

    expect(screen.getByRole('button', {name: 'Filter by status'})).toBeInTheDocument();
  });

  it('keeps the control ahead of the mobile bulk menu', async () => {
    renderToolbar({toolbarContent: statusButton, isMobile: true, bulkActions}, {'row-1': true});

    await userEvent.click(screen.getByPlaceholderText(DEFAULT_LABELS.globalSearch));
    await userEvent.tab();
    expect(screen.getByRole('button', {name: 'Filter by status'})).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByRole('button', {name: DEFAULT_LABELS.actions})).toHaveFocus();
  });

  it('shares its row with the search box instead of wrapping under it', () => {
    // MUI's breakpoint-gated sx values (the `{xs, sm}` objects elsewhere in this file) do not
    // resolve through getComputedStyle in this project's jsdom setup: a value that differs
    // only by breakpoint always reads back as the browser default, regardless of
    // window.innerWidth. The assertions below use only the unconditional values the fix adds,
    // which jsdom does resolve; the visual result at a real narrow viewport is a manual check
    // in the story (Task 3).
    renderToolbar({toolbarContent: statusButton});

    const searchBox = screen.getByPlaceholderText(DEFAULT_LABELS.globalSearch).closest('.MuiBox-root');
    const row = searchBox?.parentElement;

    expect(row).not.toBeNull();
    expect(globalThis.getComputedStyle(row!).flexWrap).toBe('nowrap');
    expect(globalThis.getComputedStyle(searchBox!).flexGrow).toBe('1');
    // Parsed rather than string-matched: emotion serialises a zero as `0` or `0px` depending
    // on its version, and the bug this guards is the search box refusing to shrink at all
    // (`minWidth: auto`), not the exact unit.
    expect(Number.parseFloat(globalThis.getComputedStyle(searchBox!).minWidth)).toBe(0);
  });

  it('leaves the search box at its own width when there is no consumer control', () => {
    renderToolbar({});

    const searchBox = screen.getByPlaceholderText(DEFAULT_LABELS.globalSearch).closest('.MuiBox-root');

    // The default sx carries no `flex`, so this is the initial value, not a breakpoint result:
    // today's search box neither grows nor shrinks, and this stays true with the fix.
    expect(globalThis.getComputedStyle(searchBox!).flexGrow).toBe('0');
  });
});
```

- [x] **Step 2: Run them and watch them fail**

Run: `pnpm exec vitest run --project @vt-labs/datatable DataTableToolbar.test`
Expected: four of the five new tests FAIL. The first three (focus order, search off, ahead of the mobile bulk menu) fail with `Unable to find an accessible element with the role "button" and name "Filter by status"`. `shares its row with the search box instead of wrapping under it` fails on the `flexWrap` assertion (today's left group is `flexWrap: 'wrap'`, not `'nowrap'`). `leaves the search box at its own width when there is no consumer control` already PASSES: it exercises only today's default sizing, which the fix must not change. Every other existing test in the file still passes.

- [x] **Step 3: Add the `flexible` prop to `GlobalSearch`, then use it from the toolbar**

In `packages/datatable/src/toolbar/GlobalSearch.tsx`, add the field to `GlobalSearchProps`, after `debounceMs`:

```tsx
  readonly debounceMs?: number;
  // Set by the toolbar when a consumer's `toolbarContent` shares this row: the box gives up
  // its own min/max width and instead flexes to fill whatever space `toolbarContent` does not
  // take, so the two sit on one line down to the narrowest screen instead of the search box
  // claiming the full row and pushing the content onto the next line.
  readonly flexible?: boolean;
}
```

Destructure it, after `debounceMs = 300,`, and use it for the root `Box`'s sizing:

```tsx
  debounceMs = 300,
  flexible = false,
}: Readonly<GlobalSearchProps>) {
```

```tsx
    <Box
      sx={
        flexible
          ? {position: 'relative', flex: 1, minWidth: 0}
          : {position: 'relative', minWidth: {xs: '100%', sm: 220}, maxWidth: {xs: '100%', sm: 280}}
      }
    >
```

In `packages/datatable/src/toolbar/DataTableToolbar.tsx`, add the type import under the existing `react` import:

```tsx
import {useState} from 'react';
import type {ReactNode} from 'react';
```

Add the field at the end of `DataTableToolbarProps`, after `selectedRows`:

```tsx
  // Mobile bulk actions
  readonly isMobile?: boolean;
  readonly bulkActions?: readonly BulkAction<TData>[];
  readonly selectedRows?: readonly TData[];

  // The consumer's own controls, rendered right after the search box
  readonly toolbarContent?: ReactNode;
}
```

Destructure it, after `selectedRows,`:

```tsx
  isMobile = false,
  bulkActions,
  selectedRows,
  toolbarContent,
}: Readonly<DataTableToolbarProps<TData>>) {
```

In the left group, replace the existing `{/* Global Search */}` block (the whole `{enableGlobalFilter && (<GlobalSearch ... />)}`, still the first thing in the group, right before `{/* Active filters indicator */}`) with one that shares its row with `toolbarContent` when there is one, and otherwise renders exactly as it does today. Shown wrapped in a fragment so the sample itself formats as real JSX; drop the `<>`/`</>` when placing the contents:

```tsx
<>
  {/* Global Search. With toolbarContent it shares this row instead of taking the full width:
      GlobalSearch flexes and the content sits at its end. Without toolbarContent nothing here
      changes from today. */}
  {enableGlobalFilter &&
    (toolbarContent != null ? (
      <Box sx={{display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 0.5, minWidth: 0}}>
        <GlobalSearch
          flexible
          value={globalFilter}
          onChange={onGlobalFilterChange ?? (() => {})}
          placeholder={globalFilterPlaceholder}
          helperText={globalFilterHelperText}
        />
        {/* Ahead of the chip and Reset filters, which come and go with the table's own
            filters, so the consumer's control does not jump when one is set. */}
        <Box sx={{display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, flexShrink: 0}}>
          {toolbarContent}
        </Box>
      </Box>
    ) : (
      <GlobalSearch
        value={globalFilter}
        onChange={onGlobalFilterChange ?? (() => {})}
        placeholder={globalFilterPlaceholder}
        helperText={globalFilterHelperText}
      />
    ))}

  {/* Consumer controls with no search box to share a row with: enableGlobalFilter is false,
      so this renders on its own, same as before. */}
  {!enableGlobalFilter && toolbarContent != null && (
    <Box sx={{display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5}}>{toolbarContent}</Box>
  )}
</>
```

- [x] **Step 4: Run the tests again**

Run: `pnpm exec vitest run --project @vt-labs/datatable DataTableToolbar.test`
Expected: PASS, every test in the file.

- [x] **Step 5: Typecheck and lint**

Run: `pnpm --filter @vt-labs/datatable typecheck && pnpm lint`
Expected: both clean. `ToolbarProps` in the test file is derived from the component's props, so the typecheck is what proves the new field is typed.

- [x] **Step 6: Checkpoint**

No commit (see Global Constraints). Run `git status` and confirm only the three files above changed.

---

### Task 2: `DataTable` takes `toolbarContent` and passes it down

**Files:**

- Modify: `packages/datatable/src/types.ts`
- Modify: `packages/datatable/src/DataTable.tsx`
- Test: `packages/datatable/src/DataTable.test.tsx`

**Interfaces:**

- Consumes: `DataTableToolbarProps<TData>.toolbarContent` from Task 1.
- Produces: `DataTableProps<TData>.toolbarContent?: ReactNode` (public, through the exported `DataTableProps` type).

- [x] **Step 1: Write the failing tests**

In `packages/datatable/src/DataTable.test.tsx`, widen the vitest import:

```tsx
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
```

Add a block inside `describe('DataTable', ...)`, right after `describe('Toolbar Visibility', ...)`:

```tsx
describe('Toolbar Content', () => {
  const statusButton = <button type="button">Filter by status</button>;

  // The phone test replaces `matchMedia` on the global; without this the stub leaks into
  // later tests and they render CardView instead of the table.
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the consumer control in the toolbar', () => {
    render(<DataTable columns={testColumns} data={testData.slice(0, 5)} toolbarContent={statusButton} />);

    expect(screen.getByRole('button', {name: 'Filter by status'})).toBeInTheDocument();
  });

  it('hides it with the rest of the toolbar', () => {
    // Passes before the change too; it pins `showToolbar` as the one switch for the whole
    // toolbar, consumer controls included.
    render(
      <DataTable columns={testColumns} data={testData.slice(0, 5)} toolbarContent={statusButton} showToolbar={false} />,
    );

    expect(screen.queryByRole('button', {name: 'Filter by status'})).not.toBeInTheDocument();
  });

  it('keeps it above the cards on a phone', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    render(
      <DataTable columns={testColumns} data={testData.slice(0, 5)} toolbarContent={statusButton} ariaLabel="Roles" />,
    );

    expect(screen.getByRole('list', {name: 'Roles'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Filter by status'})).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run them and watch them fail**

Run: `pnpm exec vitest run --project @vt-labs/datatable DataTable.test`
Expected: `renders the consumer control in the toolbar` and `keeps it above the cards on a phone` FAIL on the missing `Filter by status` button. `hides it with the rest of the toolbar` passes (see its comment).

- [x] **Step 3: Add the prop to `DataTableProps`**

In `packages/datatable/src/types.ts`, directly after `readonly showToolbar?: boolean;` (`ReactNode` is already imported at the top of the file):

````ts
  /**
   * Controls of the consumer's own, placed in the toolbar right after the search box: a
   * status menu that feeds a query param, a date range, a "New" button. The table renders
   * them as given and holds none of their state.
   *
   * - The table's active-filter chip and **Reset filters** cover only its own filters. A
   *   control here that filters is the consumer's to count and to reset.
   * - It is part of the toolbar, so `showToolbar={false}` hides it too.
   * - Below the `sm` breakpoint the toolbar stacks, and the search box shares its row with
   *   these controls instead of wrapping them onto the line under it. Several controls stay
   *   together and wrap among themselves if they do not fit.
   * - Tab order is the DOM order: search, these controls, then the table's own. The table
   *   adds no label or role around them, so give each control its own accessible name (an
   *   icon button needs `aria-label`).
   *
   * @example
   * ```tsx
   * <DataTable toolbarContent={<StatusFilterMenu value={status} onChange={setStatus} />} … />
   * ```
   */
  readonly toolbarContent?: ReactNode;
````

- [x] **Step 4: Pass it through `DataTable`**

In `packages/datatable/src/DataTable.tsx`, destructure it in the `// UI` group, after `showToolbar = true,`:

```tsx
    showToolbar = true,
    toolbarContent,
    showPagination = true,
```

and pass it to the toolbar, after `selectedRows={selectedRows}`:

```tsx
                isMobile={isMobile}
                bulkActions={bulkActions}
                selectedRows={selectedRows}
                toolbarContent={toolbarContent}
              />
```

- [x] **Step 5: Run the tests again**

Run: `pnpm exec vitest run --project @vt-labs/datatable DataTable.test index.test`
Expected: PASS. `index.test.ts` passes unchanged, which is the check that nothing was added to the export list.

- [x] **Step 6: Typecheck and lint**

Run: `pnpm --filter @vt-labs/datatable typecheck && pnpm lint`
Expected: both clean.

- [x] **Step 7: Checkpoint**

No commit. `git status` shows the three files above plus Task 1's three.

---

### Task 3: A story with a status-filter menu beside search

**Files:**

- Modify: `packages/datatable/src/DataTable.stories.tsx`

**Interfaces:**

- Consumes: `DataTableProps<Order>.toolbarContent` from Task 2; `ORDERS`, `Order` from `./stories/fixtures`; `STATUS_LABEL`, `columns`, `showcase` already in the story file.
- Produces: the `ToolbarContent` story.

The story's control holds its own state and filters the rows before they reach the table, which is what a query param does on a server-driven page. `ORDERS` is 12 rows cycling through four statuses, so each status matches 3; `SW-1000` is pending and `SW-1002` is delivered.

- [x] **Step 1: Add the imports**

At the top of `packages/datatable/src/DataTable.stories.tsx`, next to the existing `@mui/material/*` imports:

```tsx
import FilterListIcon from '@mui/icons-material/FilterList';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
```

and add `useId` to the `react` import:

```tsx
import {useEffect, useId, useState, type ReactNode} from 'react';
```

- [x] **Step 2: Write the story, with its `play` function**

Insert right after the `Filtering` story (it ends with the `SW-1002` assertion, before `const bulkActions`):

```tsx
type StatusFilter = Order['status'] | 'all';

const STATUS_FILTERS: readonly StatusFilter[] = ['all', 'pending', 'in_progress', 'delivered', 'cancelled'];

function statusFilterLabel(status: StatusFilter): string {
  return status === 'all' ? 'All statuses' : STATUS_LABEL[status];
}

function countOrders(status: StatusFilter): number {
  return status === 'all' ? ORDERS.length : ORDERS.filter((order) => order.status === status).length;
}

interface StatusFilterMenuProps {
  readonly value: StatusFilter;
  readonly onChange: (status: StatusFilter) => void;
}

/**
 * The consumer's own control: an icon button that opens a status menu, with a badge
 * counting the rows the chosen status matches. Its accessible name says which status is
 * on, because the badge alone is a number with no meaning to a screen reader.
 */
function StatusFilterMenu({value, onChange}: Readonly<StatusFilterMenuProps>) {
  const menuId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const isOpen = anchor !== null;

  return (
    <>
      <IconButton
        size="small"
        aria-label={value === 'all' ? 'Filter by status' : `Filter by status: ${statusFilterLabel(value)}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <Badge color="primary" badgeContent={countOrders(value)} invisible={value === 'all'}>
          <FilterListIcon fontSize="small" />
        </Badge>
      </IconButton>
      <Menu id={menuId} anchorEl={anchor} open={isOpen} onClose={() => setAnchor(null)}>
        {STATUS_FILTERS.map((status) => (
          <MenuItem
            key={status}
            selected={status === value}
            onClick={() => {
              onChange(status);
              setAnchor(null);
            }}
          >
            <ListItemText>{statusFilterLabel(status)}</ListItemText>
            <Typography variant="body2" color="text.secondary" sx={{ml: 2}}>
              {countOrders(status)}
            </Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function StatusFilteredOrders() {
  const [status, setStatus] = useState<StatusFilter>('all');
  // Stands in for a query param: a real page puts `status` in its request and the server
  // filters. The table only ever sees the rows that come back.
  const rows = status === 'all' ? ORDERS : ORDERS.filter((order) => order.status === status);

  return (
    <DataTable
      columns={columns}
      data={rows}
      enableFiltering
      toolbarContent={<StatusFilterMenu value={status} onChange={setStatus} />}
      ariaLabel="Orders"
    />
  );
}

/**
 * **A control of your own, beside the search box.** `toolbarContent` takes any node and
 * places it right after search, ahead of the table's own controls.
 *
 * The status menu here holds its own state and filters the rows before they reach the
 * table, the way a query param would on a server-driven page. The table's active-filter
 * chip and **Reset filters** do not count it: they cover the table's own filters only.
 * Give an icon button an `aria-label`; the table adds none around it.
 */
export const ToolbarContent: Story = {
  parameters: showcase('toolbarContent', 'showToolbar'),
  render: () => <StatusFilteredOrders />,
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', {name: 'Filter by status'});

    await userEvent.click(trigger);
    // The menu is portalled to document.body, outside the canvas.
    await userEvent.click(await screen.findByRole('menuitem', {name: /^Delivered/}));

    await waitFor(() => expect(canvas.queryByText('SW-1000')).not.toBeInTheDocument());
    await expect(canvas.getByText('SW-1002')).toBeInTheDocument();

    // The trigger re-renders from the consumer's new state, and the menu hands focus back.
    await expect(trigger).toHaveAccessibleName('Filter by status: Delivered');
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
```

- [x] **Step 3: Run the story test**

Run: `pnpm exec vitest run --project storybook DataTable.stories`
Expected: PASS for every story in the file, `ToolbarContent` included, with no axe violation. If axe flags the badge's contrast, do not switch the rule off: that is stock `primary.main` against `primary.contrastText`, and the fix is to pick a badge colour that passes (or a `variant="dot"` badge plus the count in the accessible name), then say which in the story note.

- [x] **Step 4: Check it by eye**

Run: `pnpm storybook`, open **DataTable / DataTable / Toolbar Content**.

- Under the stock light and dark themes and one preset (Nord), the trigger sits right after the search box and the badge follows the theme.
- Set a column filter from the Filters panel: the chip and **Reset filters** appear after the trigger; the trigger does not move.
- Pick **iPhone 14** in the viewport toolbar: the search box shrinks and the trigger stays on the same line at its end, nothing runs off the right edge, and the cards render under the toolbar. This check is manual because the story runner does not apply `globals.viewport` (see the `MobileCards` story's `play` comment).

- [x] **Step 5: Lint**

Run: `pnpm lint && pnpm lint:eslint`
Expected: clean. The ESLint pass covers `storybook` and `react-hooks`.

- [x] **Step 6: Checkpoint**

No commit. `git status` shows `DataTable.stories.tsx` plus the files from Tasks 1 and 2.

---

### Task 4: Changeset, README, roadmap, and close the plan

**Files:**

- Create: `.changeset/datatable-toolbar-content.md`
- Modify: `packages/datatable/README.md`
- Modify: `docs/roadmap.md`
- Move: this file from `docs/superpowers/plans/open/` to `docs/superpowers/plans/done/`

**Interfaces:**

- Consumes: everything above.
- Produces: the release note and the documentation for `toolbarContent`.

- [x] **Step 1: Write the changeset**

Create `.changeset/datatable-toolbar-content.md`:

```md
---
'@vt-labs/datatable': minor
---

New `toolbarContent` prop: put your own controls in the toolbar, right after the search box. The table renders them as given and holds none of their state, so a status menu that drives your own query param works without touching the table's filters. `showToolbar={false}` hides them with the rest of the toolbar.
```

- [x] **Step 2: Update the package README**

In `packages/datatable/README.md`, section "Fitting the app's own components", change the opening line from:

```md
Two pieces of the table would otherwise look imported. Both are props.
```

to:

```md
Three pieces of the table would otherwise look imported. All three are props.
```

Then, after the paragraph that ends "can be passed straight back in as the slot.", add:

````md
The toolbar takes controls of the app's own. `toolbarContent` renders whatever it is given
right after the search box, ahead of the table's own buttons:

```tsx
<DataTable toolbarContent={<StatusFilterMenu value={status} onChange={setStatus} />} columns={columns} data={rows} />
```

The table holds none of that control's state, and its active-filter chip and **Reset
filters** do not count it. Give an icon button an `aria-label`: the table adds no label
around it. `showToolbar={false}` hides it with the rest of the toolbar.
````

In the "Public surface" table, add a row after the `slots`, `dateFormats` row:

```md
| `toolbarContent` | your own controls in the toolbar, after search |
```

Run `pnpm format` afterwards; oxfmt realigns the table. Check `git status` and name any file it touched outside this change.

- [x] **Step 3: Close the plan**

```bash
mkdir -p docs/superpowers/plans/done
git mv docs/superpowers/plans/open/2026-09-30-datatable-toolbar-slot.md \
       docs/superpowers/plans/done/2026-09-30-datatable-toolbar-slot.md
```

In `docs/roadmap.md`, section "2. `@vt-labs/datatable`": if a row for this plan was added when it was filed, set its status to `done (<today's date>)` and point its link at `done/`. Otherwise add this row after the `ConfirmDialog` row:

```md
| `toolbarContent`: consumer controls in the toolbar | done (<today's date>) | [plan](superpowers/plans/done/2026-09-30-datatable-toolbar-slot.md) |
```

- [x] **Step 4: Run the full gate**

Run: `pnpm validate:ci`
Expected: PASS. Report the output; if anything fails, say what and stop.

- [x] **Step 5: Hand off for commit**

Stage by name, never `git add -A`:

```bash
git add \
  packages/datatable/src/toolbar/DataTableToolbar.tsx \
  packages/datatable/src/toolbar/DataTableToolbar.test.tsx \
  packages/datatable/src/toolbar/GlobalSearch.tsx \
  packages/datatable/src/types.ts \
  packages/datatable/src/DataTable.tsx \
  packages/datatable/src/DataTable.test.tsx \
  packages/datatable/src/DataTable.stories.tsx \
  packages/datatable/README.md \
  .changeset/datatable-toolbar-content.md \
  docs/roadmap.md \
  docs/superpowers/plans/done/2026-09-30-datatable-toolbar-slot.md
```

Commit message:

```
feat(datatable): add toolbarContent for consumer controls beside search
```

## Out of scope

**A second toolbar position.** A trailing position (after the table's own buttons) waits for a consumer that needs one; adding it later is a minor.

**`role="toolbar"` and a label on the toolbar itself.** That is a change to the whole toolbar's keyboard model, and it belongs to feature item 29, accessibility conformance, in [`docs/packages/datatable/roadmap.md`](../../../packages/datatable/roadmap.md).

**Counting or resetting a consumer's filters from the table.** The active-filter chip and **Reset filters** stay the table's. A hook that lets them include a consumer's filters is its own design.
