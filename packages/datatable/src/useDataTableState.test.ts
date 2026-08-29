/**
 * Direct coverage for `useDataTableState`, the state core the DataTable is built on.
 *
 * The component tests exercise most of it through the rendered table, but three paths
 * are hard to reach from there and were uncovered: the mount-time sync of a persisted
 * column layout to the parent callbacks, the data-identity version counter, and the
 * column-sizing handler. Each is called out in its own block below.
 */
import {act, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {getTableStateStorageKey} from './storage/storageKey';
import type {PersistedTableState} from './types';
import type {UseDataTableStateOptions} from './useDataTableState';
import {useDataTableState} from './useDataTableState';

const TABLE_ID = 'state-core-table';

function baseOptions(overrides: Partial<UseDataTableStateOptions> = {}): UseDataTableStateOptions {
  return {
    initialPageSize: 25,
    initialSorting: [],
    initialFilters: [],
    initialGlobalFilter: '',
    initialColumnOrder: [],
    initialColumnPinning: {},
    initialColumnVisibility: {},
    initialRowSelection: {},
    manualPagination: false,
    initialDensity: 'comfortable',
    initialGrouping: [],
    data: [],
    ...overrides,
  };
}

function persist(state: PersistedTableState) {
  localStorage.setItem(getTableStateStorageKey(TABLE_ID), JSON.stringify(state));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

// ===========================================================================
// useDataTableState.ts:22-31 — `syncPersistedColumnLayout`, run once from a mount effect.
//
// A user reorders or hides columns, the layout is written to localStorage, and on the
// next visit the table restores it. The parent still holds its own copy of that layout
// (the column-ordering and column-visibility toolbars are driven from it), so it has to
// be told, or the toolbar and the table disagree from the first paint.
//
// The `length > 0` and `Object.keys(...).length > 0` guards are the interesting part:
// an empty persisted layout must NOT fire the callback, because "no saved order" and
// "an order with nothing in it" would otherwise both wipe the parent's state.
// ===========================================================================
describe('useDataTableState — restoring a persisted column layout', () => {
  it('reports a persisted column order to the parent on mount', () => {
    persist({columnOrder: ['email', 'name']});
    const onColumnOrderChange = vi.fn();

    renderHook(() => useDataTableState(baseOptions({tableId: TABLE_ID, onColumnOrderChange})));

    expect(onColumnOrderChange).toHaveBeenCalledWith(['email', 'name']);
  });

  it('reports a persisted column visibility to the parent on mount', () => {
    persist({columnVisibility: {email: false}});
    const onColumnVisibilityChange = vi.fn();

    renderHook(() => useDataTableState(baseOptions({tableId: TABLE_ID, onColumnVisibilityChange})));

    expect(onColumnVisibilityChange).toHaveBeenCalledWith({email: false});
  });

  it('reports both when both were persisted', () => {
    persist({columnOrder: ['email', 'name'], columnVisibility: {email: false}});
    const onColumnOrderChange = vi.fn();
    const onColumnVisibilityChange = vi.fn();

    renderHook(() =>
      useDataTableState(baseOptions({tableId: TABLE_ID, onColumnOrderChange, onColumnVisibilityChange})),
    );

    expect(onColumnOrderChange).toHaveBeenCalledWith(['email', 'name']);
    expect(onColumnVisibilityChange).toHaveBeenCalledWith({email: false});
  });

  it('stays quiet when the persisted layout is empty', () => {
    // An empty array and an empty object mean "nothing was saved". Passing them on
    // would clear a column order the parent had set from its own defaults.
    persist({columnOrder: [], columnVisibility: {}});
    const onColumnOrderChange = vi.fn();
    const onColumnVisibilityChange = vi.fn();

    renderHook(() =>
      useDataTableState(baseOptions({tableId: TABLE_ID, onColumnOrderChange, onColumnVisibilityChange})),
    );

    expect(onColumnOrderChange).not.toHaveBeenCalled();
    expect(onColumnVisibilityChange).not.toHaveBeenCalled();
  });

  it('stays quiet when nothing was persisted at all', () => {
    const onColumnOrderChange = vi.fn();

    renderHook(() => useDataTableState(baseOptions({tableId: TABLE_ID, onColumnOrderChange})));

    expect(onColumnOrderChange).not.toHaveBeenCalled();
  });

  it('syncs once, not on every render', () => {
    // The effect is guarded by a ref rather than a dependency list. Re-firing it would
    // overwrite a layout the user changed after mount with the stale persisted one.
    persist({columnOrder: ['email', 'name']});
    const onColumnOrderChange = vi.fn();
    const {rerender} = renderHook(() => useDataTableState(baseOptions({tableId: TABLE_ID, onColumnOrderChange})));

    rerender();
    rerender();

    expect(onColumnOrderChange).toHaveBeenCalledTimes(1);
  });

  it('does not touch storage without a tableId', () => {
    // Persistence is opt-in: no tableId means no read, so no sync either.
    persist({columnOrder: ['email', 'name']});
    const onColumnOrderChange = vi.fn();

    const {result} = renderHook(() => useDataTableState(baseOptions({onColumnOrderChange})));

    expect(result.current.isPersistenceEnabled).toBe(false);
    expect(onColumnOrderChange).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// useDataTableState.ts:122-128 — the data version counter.
//
// TableBody memoizes its rows, and TanStack hands back the same row objects when only
// the underlying array identity changed. The counter is what tells the body that the
// data it is holding is stale: it increments during render whenever `data` is a
// different reference, and stays put when it is not.
//
// Getting this wrong is invisible in a test that mounts once, and shows up in the app
// as a table that keeps painting the previous page's rows after a refetch.
// ===========================================================================
describe('useDataTableState — the data version counter', () => {
  it('starts at zero', () => {
    const {result} = renderHook(() => useDataTableState(baseOptions({data: []})));

    expect(result.current.dataVersion).toBe(0);
  });

  it('increments when the data array is a new reference', () => {
    const {result, rerender} = renderHook((props: UseDataTableStateOptions) => useDataTableState(props), {
      initialProps: baseOptions({data: [{id: 1}]}),
    });

    rerender(baseOptions({data: [{id: 1}]}));

    expect(result.current.dataVersion).toBe(1);
  });

  it('holds steady when the same array is passed again', () => {
    // A parent that memoizes its rows re-renders for unrelated reasons all the time.
    // Bumping the version there would throw away the body's memo on every keystroke.
    const data = [{id: 1}];
    const {result, rerender} = renderHook((props: UseDataTableStateOptions) => useDataTableState(props), {
      initialProps: baseOptions({data}),
    });

    rerender(baseOptions({data}));
    rerender(baseOptions({data}));

    expect(result.current.dataVersion).toBe(0);
  });
});

// ===========================================================================
// useDataTableState.ts:273-278 — `handleColumnSizingChange`.
//
// This is wired to TanStack's `onColumnSizingChange`, which calls it with an updater
// function while a resize handle is being dragged and with a plain object when sizing
// is set outright. Both shapes have to work: treating the function as a value stores a
// function where a width map belongs, and the columns render at `NaN` pixels.
// ===========================================================================
describe('useDataTableState — column sizing', () => {
  it('applies a plain sizing object', () => {
    const {result} = renderHook(() => useDataTableState(baseOptions()));

    act(() => {
      result.current.handleColumnSizingChange({name: 240});
    });

    expect(result.current.columnSizing).toEqual({name: 240});
  });

  it('applies an updater against the previous sizing', () => {
    const {result} = renderHook(() => useDataTableState(baseOptions()));

    act(() => {
      result.current.handleColumnSizingChange({name: 240});
    });
    act(() => {
      result.current.handleColumnSizingChange((prev) => ({...prev, email: 120}));
    });

    expect(result.current.columnSizing).toEqual({name: 240, email: 120});
  });
});
