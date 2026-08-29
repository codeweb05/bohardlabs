/**
 * Unit tests for `useTableServerState`.
 *
 * This is the hook every list page uses to own its server-facing table state. The
 * contract worth pinning down: the persisted state is read ONCE (lazy initializer),
 * later option changes are ignored on purpose, and `onServerStateChange` keeps a
 * stable identity so passing it to `<DataTable>` does not re-trigger effects.
 */
import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';

import {getTableStateStorageKey} from './storage/storageKey';
import type {ServerTableState} from './types';
import {DEFAULT_PAGE_SIZE} from './types';
import {useTableServerState} from './useTableServerState';

const TABLE_ID = 'list-page-table';

function seed(state: Record<string, unknown>) {
  localStorage.setItem(getTableStateStorageKey(TABLE_ID), JSON.stringify(state));
}

beforeEach(() => {
  localStorage.clear();
});

describe('useTableServerState', () => {
  it('starts at the default page size when nothing is persisted', () => {
    const {result} = renderHook(() => useTableServerState(TABLE_ID));

    expect(result.current.serverState).toEqual({
      pagination: {pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE},
      sorting: [],
      columnFilters: [],
      globalFilter: '',
    });
  });

  it('applies the supplied defaults when nothing is persisted', () => {
    const {result} = renderHook(() =>
      useTableServerState(TABLE_ID, {
        pageSize: 10,
        sorting: [{id: 'createdAt', desc: true}],
        columnFilters: [{id: 'status', value: 'ACTIVE'}],
        globalFilter: 'seed',
      }),
    );

    expect(result.current.serverState).toEqual({
      pagination: {pageIndex: 0, pageSize: 10},
      sorting: [{id: 'createdAt', desc: true}],
      columnFilters: [{id: 'status', value: 'ACTIVE'}],
      globalFilter: 'seed',
    });
  });

  it('seeds from localStorage on the very first render', () => {
    // The point of the hook: the first query must already be built at the persisted
    // page size, before the DataTable mounts and emits its state.
    seed({pageIndex: 2, pageSize: 25});

    const {result} = renderHook(() => useTableServerState(TABLE_ID, {pageSize: 50}));

    expect(result.current.serverState.pagination).toEqual({pageIndex: 2, pageSize: 25});
  });

  it('lets the persisted value win over the supplied default', () => {
    seed({pageSize: 100, globalFilter: 'stored'});

    const {result} = renderHook(() => useTableServerState(TABLE_ID, {pageSize: 10, globalFilter: 'default'}));

    expect(result.current.serverState.pagination.pageSize).toBe(100);
    expect(result.current.serverState.globalFilter).toBe('stored');
  });

  it('adopts the state reported by the DataTable', () => {
    const {result} = renderHook(() => useTableServerState(TABLE_ID));

    const next: ServerTableState = {
      pagination: {pageIndex: 1, pageSize: 25},
      sorting: [{id: 'name', desc: false}],
      columnFilters: [{id: 'status', value: 'ACTIVE'}],
      globalFilter: 'acme',
    };

    act(() => {
      result.current.onServerStateChange(next);
    });

    expect(result.current.serverState).toEqual(next);
  });

  it('keeps a stable onServerStateChange identity across renders', () => {
    // An unstable callback here would re-run the DataTable's emit effect and
    // re-fire the list query on every parent render.
    const {result, rerender} = renderHook(() => useTableServerState(TABLE_ID));
    const first = result.current.onServerStateChange;

    act(() => {
      result.current.onServerStateChange({
        pagination: {pageIndex: 1, pageSize: 50},
        sorting: [],
        columnFilters: [],
        globalFilter: '',
      });
    });
    rerender();

    expect(result.current.onServerStateChange).toBe(first);
  });

  it('ignores option changes after mount', () => {
    // Documented behaviour: the resolved state is owned from mount onward, so a
    // parent re-rendering with a different default must not reset the user's page.
    const {result, rerender} = renderHook(({pageSize}) => useTableServerState(TABLE_ID, {pageSize}), {
      initialProps: {pageSize: 25},
    });

    rerender({pageSize: 100});

    expect(result.current.serverState.pagination.pageSize).toBe(25);
  });

  it('does not write back to localStorage', () => {
    // The DataTable owns persistence; this hook only reads the seed. A write here
    // would race the table's debounced writer.
    const {result} = renderHook(() => useTableServerState(TABLE_ID));

    act(() => {
      result.current.onServerStateChange({
        pagination: {pageIndex: 4, pageSize: 10},
        sorting: [],
        columnFilters: [],
        globalFilter: '',
      });
    });

    expect(localStorage.getItem(getTableStateStorageKey(TABLE_ID))).toBeNull();
  });
});
