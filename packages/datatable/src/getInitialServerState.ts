import {getTableStateStorageKey} from './storage/storageKey';
import type {PersistedTableState, ServerTableState} from './types';

/** A persisted page index/size is only honored when it's a finite, non-negative number. */
function safePageIndex(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback;
}

function safePageSize(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function safeArray<T>(value: T[] | undefined, fallback: T[]): T[] {
  return Array.isArray(value) ? value : fallback;
}

/**
 * Synchronously resolve a table's initial server state (pagination/sorting/filters)
 * from its persisted localStorage entry, falling back to the provided defaults.
 *
 * Page hooks use this to SEED their `serverState` so the list query is built with the
 * correct (persisted) params on the very first render — before the DataTable mounts and
 * emits `onServerStateChange`. That makes cached data available on the first paint, which
 * is required for TanStack Router scroll restoration to land on the saved position after a
 * back-navigation (an empty/loading first render collapses the scroll container and the
 * router restores against a too-short page). It also means the DataTable's later mount
 * emit carries identical values, so no second fetch fires.
 */
export function getInitialServerState(tableId: string | undefined, defaults: ServerTableState): ServerTableState {
  if (!tableId) return defaults;

  try {
    const stored = localStorage.getItem(getTableStateStorageKey(tableId));
    if (!stored) return defaults;

    const persisted = JSON.parse(stored) as PersistedTableState;
    return {
      pagination: {
        pageIndex: safePageIndex(persisted.pageIndex, defaults.pagination.pageIndex),
        pageSize: safePageSize(persisted.pageSize, defaults.pagination.pageSize),
      },
      sorting: safeArray(persisted.sorting, defaults.sorting),
      columnFilters: safeArray(persisted.columnFilters, defaults.columnFilters),
      globalFilter: typeof persisted.globalFilter === 'string' ? persisted.globalFilter : defaults.globalFilter,
    };
  } catch {
    return defaults;
  }
}
