import type {ColumnFiltersState, SortingState} from '@tanstack/react-table';
import {useCallback, useState} from 'react';

import {getInitialServerState} from './getInitialServerState';
import type {ServerTableState} from './types';
import {DEFAULT_PAGE_SIZE} from './types';

export interface UseTableServerStateOptions {
  /** Page size to use when nothing is persisted (default: DEFAULT_PAGE_SIZE). */
  readonly pageSize?: number;
  /** Default sorting when nothing is persisted (default: none). */
  readonly sorting?: SortingState;
  /** Default column filters when nothing is persisted (e.g. an alert deep-link seed). */
  readonly columnFilters?: ColumnFiltersState;
  /** Default global filter when nothing is persisted (default: ''). */
  readonly globalFilter?: string;
}

export interface UseTableServerStateResult {
  /** Current server-facing table state — build the list query params from this. */
  readonly serverState: ServerTableState;
  /** Pass straight to `<DataTable onServerStateChange={...} />`. */
  readonly onServerStateChange: (next: ServerTableState) => void;
}

/**
 * Owns a list page's server-facing table state (pagination/sorting/filters), SEEDED
 * from the table's persisted localStorage entry so the query is built at the persisted
 * page size on the very first render. That puts cached rows on the first paint, which
 * TanStack Router scroll restoration needs after a back-navigation; it also means the
 * DataTable's mount emit carries identical values, so no redundant second fetch fires.
 *
 * The DataTable remains the source of truth: it persists the state and reports every
 * change through the returned `onServerStateChange`.
 *
 * The defaults are read once (lazy `useState` initializer); later changes to `options`
 * are ignored by design — the resolved state is owned from mount onward.
 */
export function useTableServerState(tableId: string, options?: UseTableServerStateOptions): UseTableServerStateResult {
  const [serverState, setServerState] = useState<ServerTableState>(() =>
    getInitialServerState(tableId, {
      pagination: {pageIndex: 0, pageSize: options?.pageSize ?? DEFAULT_PAGE_SIZE},
      sorting: options?.sorting ?? [],
      columnFilters: options?.columnFilters ?? [],
      globalFilter: options?.globalFilter ?? '',
    }),
  );

  const onServerStateChange = useCallback((next: ServerTableState) => {
    setServerState(next);
  }, []);

  return {serverState, onServerStateChange};
}
