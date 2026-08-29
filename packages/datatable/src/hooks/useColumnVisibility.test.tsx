/**
 * Coverage for `useColumnVisibility`, previously 0%.
 *
 * The hook is exported from the hooks barrel but nothing in the app calls it — the
 * toolbar's `ColumnVisibility.tsx` reimplements the same logic inline. That makes
 * this file the only description of its contract, and it matters twice over if the
 * DataTable ships as a package: consumers get the hook, not the toolbar.
 *
 * The two blocks at the bottom guard bugs that have since been fixed; they are kept
 * as regression tests.
 */
import type {ColumnDef, VisibilityState} from '@tanstack/react-table';
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {act, renderHook} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import {useColumnVisibility} from './useColumnVisibility';

interface Item {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly status: string;
  readonly [key: string]: unknown;
}

const data: Item[] = [{id: 'item-1', name: 'Detergent', quantity: 2, status: 'ACTIVE'}];

/**
 * `select` and `actions` are system columns the hook must keep out of the menu.
 * `status` carries a non-string header so the id-fallback label is exercised.
 */
const defaultColumns: ColumnDef<Item>[] = [
  {id: 'select', header: 'Select'},
  {id: 'name', accessorKey: 'name', header: 'Name'},
  {id: 'quantity', accessorKey: 'quantity', header: 'Quantity'},
  {id: 'status', accessorKey: 'status', header: () => <span>Status</span>},
  {id: 'actions', header: 'Actions'},
];

interface HookProps {
  readonly visibility: VisibilityState;
  readonly columns: ColumnDef<Item>[];
}

function renderColumnVisibility(initial: Partial<HookProps> = {}) {
  const onChange = vi.fn<(visibility: VisibilityState) => void>();
  const view = renderHook(
    ({visibility, columns}: HookProps) => {
      const table = useReactTable({data, columns, getCoreRowModel: getCoreRowModel()});
      return useColumnVisibility<Item>(table, visibility, onChange);
    },
    {initialProps: {visibility: initial.visibility ?? {}, columns: initial.columns ?? defaultColumns}},
  );
  return {...view, onChange};
}

/** Ids of the columns the hook offers in the menu, in order. */
function menuIds(columns: readonly {id: string}[]): string[] {
  return columns.map((col) => col.id);
}

describe('useColumnVisibility — the column list', () => {
  it('keeps system columns out of the menu', () => {
    // Offering "select" or "actions" as hideable lets a user turn off the checkbox
    // column and lose bulk actions with no obvious way back.
    const {result} = renderColumnVisibility();

    expect(menuIds(result.current.columns)).toEqual(['name', 'quantity', 'status']);
    expect(result.current.totalCount).toBe(3);
  });

  it('labels a column with its string header and falls back to the id otherwise', () => {
    // A header rendered as an element cannot be stringified, so the id is the only
    // thing left to show — better than an empty menu entry.
    const {result} = renderColumnVisibility();

    expect(result.current.columns.map((col) => col.label)).toEqual(['Name', 'Quantity', 'status']);
  });

  it('treats a column as visible unless it is explicitly false', () => {
    // TanStack's VisibilityState is sparse: absent means visible. Reading `!== false`
    // rather than `=== true` is what keeps a fresh table from rendering no columns.
    const {result} = renderColumnVisibility({visibility: {quantity: false}});

    expect(result.current.columns.map((col) => col.isVisible)).toEqual([true, false, true]);
    expect(result.current.visibleCount).toBe(2);
    expect(result.current.allVisible).toBe(false);
  });

  it('reports allVisible when nothing is hidden', () => {
    const {result} = renderColumnVisibility();

    expect(result.current.visibleCount).toBe(3);
    expect(result.current.allVisible).toBe(true);
  });
});

describe('useColumnVisibility — toggling', () => {
  it('hides a visible column while preserving the rest of the state', () => {
    // The callback replaces the whole VisibilityState, so anything it forgets to
    // spread silently un-hides a column the user had already turned off.
    const {result, onChange} = renderColumnVisibility({visibility: {quantity: false}});

    act(() => {
      result.current.toggleColumn('name');
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith({quantity: false, name: false});
  });

  it('shows a hidden column', () => {
    const {result, onChange} = renderColumnVisibility({visibility: {name: false}});

    act(() => {
      result.current.toggleColumn('name');
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith({name: true});
  });

  it('ignores a column id that is not in the menu', () => {
    // System columns and typos both land here; neither should produce a state write.
    const {result, onChange} = renderColumnVisibility();

    act(() => {
      result.current.toggleColumn('select');
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('refuses to hide the last visible column', () => {
    // An all-hidden table renders as an empty shell with no UI left to recover from.
    const {result, onChange} = renderColumnVisibility({visibility: {quantity: false, status: false}});

    act(() => {
      result.current.toggleColumn('name');
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('marks the last visible column as not toggleable', () => {
    // The flag is what lets the menu disable the checkbox instead of silently
    // swallowing the click.
    const {result} = renderColumnVisibility({visibility: {quantity: false, status: false}});

    expect(result.current.columns.map((col) => col.canToggle)).toEqual([false, true, true]);
  });
});

describe('useColumnVisibility — explicit show and hide', () => {
  it('hides a named column', () => {
    const {result, onChange} = renderColumnVisibility();

    act(() => {
      result.current.hideColumn('quantity');
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith({quantity: false});
  });

  it('does not hide the last visible column', () => {
    const {result, onChange} = renderColumnVisibility({visibility: {quantity: false, status: false}});

    act(() => {
      result.current.hideColumn('name');
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores hiding a column that is not in the menu', () => {
    const {result, onChange} = renderColumnVisibility();

    act(() => {
      result.current.hideColumn('actions');
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a named column, merging into the existing state', () => {
    const {result, onChange} = renderColumnVisibility({visibility: {name: false, quantity: false}});

    act(() => {
      result.current.showColumn('name');
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith({name: true, quantity: false});
  });

  it('turns every toggleable column back on', () => {
    const {result, onChange} = renderColumnVisibility({visibility: {name: false, quantity: false}});

    act(() => {
      result.current.showAll();
    });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({name: true, quantity: true, status: true}));
  });
});

// ===========================================================================
// REGRESSION — hooks/useColumnVisibility.ts (showAll)
//
// `showAll` used to rebuild the visibility state from `columns`, which holds only the
// toggleable columns — so the object it handed back had dropped every system-column
// entry. A consumer that hides `select` or `actions` (a read-only view, a role without
// bulk permissions) got those columns forced back on the moment the user clicked
// "show all", with no menu row left to hide them again.
//
// Failed when written; passes now that `showAll` spreads `columnVisibility` first.
// ===========================================================================
describe('Regression — show all must not wipe the state of columns it does not manage', () => {
  it('leaves a hidden system column hidden', () => {
    const {result, onChange} = renderColumnVisibility({visibility: {select: false, name: false}});

    act(() => {
      result.current.showAll();
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith({select: false, name: true, quantity: true, status: true});
  });
});

// ===========================================================================
// REGRESSION — hooks/useColumnVisibility.ts:67
//
//   const leafColumns = table.getAllLeafColumns();
//   const toggleableColumnDefs = useMemo(() => leafColumns.filter(...), [leafColumns]);
//
// Moving the call out of the memo was NOT enough, and this test still failed with it.
// React Compiler caches `table.getAllLeafColumns()` on its only dependency — `table` —
// and `useReactTable` returns the same instance object on every render (it mutates its
// options in place). So the cached array is never invalidated and the column list stays
// frozen at whatever the table held on first render. Proven directly: in an uncompiled
// test callback `table.getAllLeafColumns()` returns the new column, while the compiled
// hook rendering beside it still returns the old list.
//
// Any table whose columns depend on data or permissions (a column added once the user
// loads, a column dropped for a restricted role) ends up with a visibility menu that
// lists the wrong columns forever, and `showAll` writes visibility for columns that no
// longer exist while missing the ones that do.
//
// Failed when written; passes now that the hook opts out of the compiler with
// `'use no memo'`, so `getAllLeafColumns()` is called on every render. Keep the
// directive: reading the column list off `table` cannot work under the compiler while
// `table` is a stable reference.
// ===========================================================================
describe('Regression — the menu must not go stale when the table columns change', () => {
  it('picks up a column added after the first render', () => {
    const {result, rerender} = renderColumnVisibility();

    expect(menuIds(result.current.columns)).toEqual(['name', 'quantity', 'status']);

    rerender({
      visibility: {},
      columns: [...defaultColumns, {id: 'createdAt', accessorKey: 'createdAt', header: 'Created'}],
    });

    expect(menuIds(result.current.columns)).toEqual(['name', 'quantity', 'status', 'createdAt']);
  });
});
