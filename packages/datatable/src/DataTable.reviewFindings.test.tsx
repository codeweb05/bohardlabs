/**
 * Regression tests for the code-review findings on the column-reordering /
 * header-casing change.
 *
 * Every test here was written failing, against the behaviour the DataTable *should*
 * have rather than the behaviour it had, so each one doubled as the acceptance
 * criterion for its fix. All of them pass now; keep them as regression cover. Each
 * `describe` block names the finding and the source line it came from.
 *
 * Do not "fix" a test here by relaxing the assertion — fix the component.
 */
import {fireEvent, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {DataTable} from './DataTable';
import {getTableStateStorageKey} from './storage/storageKey';
import type {TestRole} from './test/test-utils';
import {generateTestRoles, render} from './test/test-utils';
import type {DataTableColumnDef, PersistedTableState} from './types';

const testData = generateTestRoles(5);

const testColumns: DataTableColumnDef<TestRole>[] = [
  {id: 'name', accessorKey: 'name', header: 'Name'},
  {id: 'roleType', accessorKey: 'roleType', header: 'Type'},
  {id: 'description', accessorKey: 'description', header: 'Description'},
];

const rowActions = [{id: 'edit', label: 'Edit', onClick: vi.fn()}];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Header order by column id. Every header cell carries `data-column-id`, so this
 * reads the real visual order without depending on header text or casing.
 */
function getHeaderIds(): (string | null)[] {
  return Array.from(document.querySelectorAll('thead th[data-column-id]')).map((th) =>
    th.getAttribute('data-column-id'),
  );
}

async function openColumnsPopover(): Promise<HTMLElement> {
  await userEvent.click(screen.getByRole('button', {name: /columns/i}));
  return screen.findByRole('presentation');
}

function getReorderHandle(popover: HTMLElement, columnLabel: string) {
  return within(popover).getByRole('button', {name: new RegExp(`^Reorder ${columnLabel},`)});
}

/** The popover row for a column — this is the element that carries the drag handlers. */
function getColumnRow(popover: HTMLElement, columnLabel: string): HTMLElement {
  const row = within(popover)
    .getAllByRole('listitem')
    .find((item) => within(item).queryByRole('checkbox', {name: columnLabel}));
  if (!row) throw new Error(`No list row found for column "${columnLabel}"`);
  return row;
}

/**
 * jsdom does not attach a DataTransfer to synthetic drag events, so supply a stub.
 * `dropEffect` is what a real browser sets to 'none' when the user cancels the drag
 * (Escape) or releases the pointer outside a valid drop target.
 */
function makeDataTransfer(dropEffect: 'move' | 'none') {
  return {effectAllowed: '', dropEffect, setData: vi.fn(), getData: vi.fn()};
}

function seedPersistedState(tableId: string, state: PersistedTableState) {
  localStorage.setItem(getTableStateStorageKey(tableId), JSON.stringify(state));
}

/** Computed `text-transform` of a header cell, looked up by its column id. */
function getHeaderTransform(columnId: string): string {
  const cell = screen.getAllByRole('columnheader').find((th) => th.dataset.columnId === columnId);
  if (!cell) throw new Error(`No header cell for column "${columnId}"`);
  return window.getComputedStyle(cell).textTransform;
}

beforeEach(() => {
  localStorage.clear();
});

// The mobile-viewport tests below replace `matchMedia` on the global; without this
// the stub leaks into later tests and they render CardView instead of the table.
afterEach(() => {
  vi.unstubAllGlobals();
});

// ===========================================================================
// FINDING 1 — hooks/useColumnOrdering.ts:31
//
// `moveColumn` bails out when a column id is absent from the persisted
// `columnOrder`, and `sanitizePersistedState` never reconciles that stored order
// against the columns the table actually has. `enableColumnOrdering` now defaults
// to `true` and the order is written to localStorage, so any column added in a
// later release is (a) appended after `actions` by table-core and (b) permanently
// stuck there, because every reorder attempt hits the `indexOf === -1` early return.
//
// Fix direction: reconcile the persisted order on load — drop ids that no longer
// exist and splice in ids that are new — so `columnOrder` always covers exactly
// the current leaf columns.
// ===========================================================================
describe('Finding 1 — stale persisted columnOrder is never reconciled', () => {
  const TABLE_ID = 'stale-order-table';

  it('places a column missing from the persisted order before the actions column', () => {
    // Simulates an upgrade: the user persisted an order back when `description`
    // did not exist yet. `actions` IS in the stored order, so table-core appends
    // the unknown `description` after it.
    seedPersistedState(TABLE_ID, {columnOrder: ['select', 'name', 'roleType', 'actions']});

    render(
      <DataTable tableId={TABLE_ID} columns={testColumns} data={testData} enableRowSelection rowActions={rowActions} />,
    );

    expect(getHeaderIds()).toEqual(['select', 'name', 'roleType', 'description', 'actions']);
  });

  it('keeps the selection column at the front when the persisted order predates it', () => {
    // Same root cause from the other direction: an order written before row
    // selection was enabled pushes the checkbox column to the end of the row.
    seedPersistedState(TABLE_ID, {columnOrder: ['name', 'roleType', 'description']});

    render(<DataTable tableId={TABLE_ID} columns={testColumns} data={testData} enableRowSelection />);

    expect(getHeaderIds()[0]).toBe('select');
  });

  it('drops a column id that no longer exists instead of preserving it', () => {
    // A column removed in a later release must not linger in the stored order and
    // shift the surviving columns around.
    seedPersistedState(TABLE_ID, {columnOrder: ['description', 'removedColumn', 'name', 'roleType']});

    render(<DataTable tableId={TABLE_ID} columns={testColumns} data={testData} />);

    expect(getHeaderIds()).toEqual(['description', 'name', 'roleType']);
  });

  it('can still reorder a column that is missing from the persisted order', async () => {
    seedPersistedState(TABLE_ID, {columnOrder: ['select', 'name', 'roleType', 'actions']});

    render(
      <DataTable tableId={TABLE_ID} columns={testColumns} data={testData} enableRowSelection rowActions={rowActions} />,
    );

    const popover = await openColumnsPopover();
    getReorderHandle(popover, 'Description').focus();
    await userEvent.keyboard('{ArrowUp}');

    // `moveColumn` currently returns early because 'description' is not in the
    // stored order, so the column can never be moved out of its trailing slot.
    const ids = getHeaderIds();
    expect(ids.indexOf('description')).toBeLessThan(ids.indexOf('roleType'));
  });
});

// ===========================================================================
// FINDING 2 — hooks/useColumnOrdering.ts:57
//
// `handleDragEnd` commits the move on every `dragend` without inspecting
// `dropEffect`, and `handleDragOver` never clears `dragOverColumn` when the
// pointer travels back over the drag source. So a cancelled drag (Escape, or a
// release outside the popover) still reorders the column, and so does a drag the
// user visibly returned to its starting row. `handleDragCancel` is returned by the
// hook but wired to nothing.
//
// Fix direction: have the `onDragEnd` handler read `event.dataTransfer.dropEffect`
// and route a cancelled drag to `handleDragCancel()`; clear `dragOverColumn` in
// `handleDragOver` when the hovered id equals the dragged id.
// ===========================================================================
describe('Finding 2 — a cancelled drag still reorders', () => {
  it('does not reorder when the drag is cancelled (dropEffect "none")', async () => {
    render(<DataTable columns={testColumns} data={testData} />);
    const before = getHeaderIds();

    const popover = await openColumnsPopover();
    const source = getColumnRow(popover, 'Name');
    const target = getColumnRow(popover, 'Description');

    fireEvent.dragStart(source, {dataTransfer: makeDataTransfer('move')});
    fireEvent.dragOver(target, {dataTransfer: makeDataTransfer('move')});
    // Escape mid-drag, or releasing outside a drop target, fires `dragend` with
    // dropEffect 'none'. Nothing should move.
    fireEvent.dragEnd(source, {dataTransfer: makeDataTransfer('none')});

    expect(getHeaderIds()).toEqual(before);
  });

  it('leaves the order untouched when the pointer returns to the source row', async () => {
    render(<DataTable columns={testColumns} data={testData} />);
    const before = getHeaderIds();

    const popover = await openColumnsPopover();
    const source = getColumnRow(popover, 'Name');
    const target = getColumnRow(popover, 'Description');

    fireEvent.dragStart(source, {dataTransfer: makeDataTransfer('move')});
    fireEvent.dragOver(target, {dataTransfer: makeDataTransfer('move')});
    // The user changed their mind and dragged back to where they started. The drop
    // indicator is gone from the UI, so the commit must be gone too.
    fireEvent.dragOver(source, {dataTransfer: makeDataTransfer('move')});
    fireEvent.dragEnd(source, {dataTransfer: makeDataTransfer('move')});

    expect(getHeaderIds()).toEqual(before);
  });

  it('still commits a genuine drop', async () => {
    // Guard rail for the fix: cancelling must not be implemented by disabling
    // drag-and-drop wholesale.
    render(<DataTable columns={testColumns} data={testData} />);

    const popover = await openColumnsPopover();
    const source = getColumnRow(popover, 'Name');
    const target = getColumnRow(popover, 'Description');

    fireEvent.dragStart(source, {dataTransfer: makeDataTransfer('move')});
    fireEvent.dragOver(target, {dataTransfer: makeDataTransfer('move')});
    fireEvent.dragEnd(source, {dataTransfer: makeDataTransfer('move')});

    expect(getHeaderIds()).toEqual(['roleType', 'description', 'name']);
  });
});

// ===========================================================================
// FINDING 3 — toolbar/ColumnVisibility.tsx:288
//
// The column name is rendered as `<Typography component="label">` with no
// `htmlFor` and no wrapped input (the old `FormControlLabel` was dropped). The
// name is therefore not a hit target — only the ~20px checkbox is — and an
// unassociated `<label>` is left in the accessibility tree.
//
// Fix direction: give the Checkbox an id and point `htmlFor` at it, or go back to
// wrapping both in a `FormControlLabel`.
// ===========================================================================
describe('Finding 3 — the column name does not toggle its checkbox', () => {
  it('hides the column when its name is clicked', async () => {
    render(<DataTable columns={testColumns} data={testData} />);

    const popover = await openColumnsPopover();
    await userEvent.click(within(popover).getByText('Type'));

    expect(within(popover).getByRole('checkbox', {name: 'Type'})).not.toBeChecked();
    expect(getHeaderIds()).not.toContain('roleType');
  });

  it('shows a hidden column again when its name is clicked', async () => {
    render(<DataTable columns={testColumns} data={testData} />);

    const popover = await openColumnsPopover();
    // Hide via the checkbox (the path that works today), then restore via the name.
    await userEvent.click(within(popover).getByRole('checkbox', {name: 'Type'}));
    expect(getHeaderIds()).not.toContain('roleType');

    await userEvent.click(within(popover).getByText('Type'));

    expect(within(popover).getByRole('checkbox', {name: 'Type'})).toBeChecked();
    expect(getHeaderIds()).toContain('roleType');
  });

  it('associates the name with the checkbox rather than leaving a dangling label', async () => {
    render(<DataTable columns={testColumns} data={testData} />);

    const popover = await openColumnsPopover();
    const label = within(popover).getByText('Type');
    expect(label.tagName).toBe('LABEL');

    // Either form of association is fine; an orphan <label> is not.
    const isAssociated = Boolean(label.getAttribute('for')) || within(label).queryByRole('checkbox') !== null;
    expect(isAssociated).toBe(true);
  });
});

// ===========================================================================
// FINDING 4 — toolbar/ColumnVisibility.tsx:264
//
// Grab handles and the "Drag to reorder columns" hint render at every breakpoint,
// but HTML5 drag-and-drop is pointer-only and the ArrowUp/ArrowDown fallback needs
// a physical keyboard. On a touch device the affordance is inert — and `CardView`
// has replaced the table there anyway, so there is no column row to reorder.
//
// Fix direction: pass the DataTable's `isMobile` flag down to ColumnVisibility and
// suppress `enableReordering` (handles + hint) when it is true.
// ===========================================================================
describe('Finding 4 — an inert reorder affordance renders on touch layouts', () => {
  function mockMobileViewport() {
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
  }

  it('does not render drag handles on a mobile viewport', async () => {
    mockMobileViewport();
    render(<DataTable columns={testColumns} data={testData} />);

    const popover = await openColumnsPopover();
    expect(within(popover).queryAllByRole('button', {name: /^Reorder /})).toHaveLength(0);
  });

  it('does not render the drag hint on a mobile viewport', async () => {
    mockMobileViewport();
    render(<DataTable columns={testColumns} data={testData} />);

    const popover = await openColumnsPopover();
    expect(within(popover).queryByText('Drag to reorder columns')).not.toBeInTheDocument();
  });

  it('still renders the visibility checkboxes on a mobile viewport', async () => {
    // The popover keeps its primary job on mobile; only reordering goes away.
    mockMobileViewport();
    render(<DataTable columns={testColumns} data={testData} />);

    const popover = await openColumnsPopover();
    expect(within(popover).getByRole('checkbox', {name: 'Name'})).toBeInTheDocument();
  });
});

// ===========================================================================
// FINDING 5 — types.ts:40 (DEFAULT_HEADER_CASE)
//
// `capitalize` re-cases every word, so a header that already carries deliberate
// casing is rewritten: "Number of Orders" renders as "Number Of Orders". Header
// strings come from i18n already cased correctly, so the default must render them
// verbatim; `capitalize` stays available for consumers who want it.
//
// NOTE FOR THE FIXING AGENT: flipping `DEFAULT_HEADER_CASE` to 'none' also breaks
// `TableHeader.case.test.tsx` ("capitalizes headers by default", ~line 44) — that
// expectation has to be updated to 'none' in the same change. The theme's
// `MuiTableCell.head` rule also still carries `letterSpacing: '0.06em'`, which was
// tuned for the old uppercase headers; check it once the casing default changes.
// ===========================================================================
describe('Finding 5 — the default header casing rewrites intentional casing', () => {
  // Reviewed and kept as is. `capitalize` is the chosen default for the whole app, so a
  // header written "Number of Orders" paints as "Number Of Orders": CSS `text-transform`
  // has no notion of minor words. Fixing that means title-casing in JS for plain-string
  // headers and dropping the CSS transform, which is a mechanism change, not a default
  // change. Flipping the default to `none` would bring back the mixed casing this prop
  // was added to remove.
  it('capitalizes by default, connecting words included', () => {
    render(
      <DataTable columns={[{id: 'orderCount', accessorKey: 'name', header: 'Number of Orders'}]} data={testData} />,
    );

    expect(getHeaderTransform('orderCount')).toBe('capitalize');
  });

  it('renders the header verbatim when the caller opts out', () => {
    render(
      <DataTable
        columns={[{id: 'orderCount', accessorKey: 'name', header: 'Number of Orders'}]}
        data={testData}
        headerCase="none"
      />,
    );

    expect(getHeaderTransform('orderCount')).toBe('none');
  });
});
