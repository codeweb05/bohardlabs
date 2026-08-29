/**
 * Coverage for `useServerSidePagination`, previously 0%.
 *
 * The hook is exported from the DataTable barrel but no page in this app uses it, so
 * these tests are the only description of the params contract it sends to a backend.
 * That contract is the whole point of the hook, so it is asserted field by field:
 * 1-indexed page, single vs multi sort, debounced global filter, and the page reset
 * that has to happen on every filter/sort change.
 *
 * The block at the bottom guards a bug that has since been fixed in the hook; it is
 * kept as a regression test.
 */
import {act, renderHook, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {createTestWrapper} from '../test/test-utils';
import type {ServerSideParams, ServerSideResponse, ServerTableState, UseServerSidePaginationOptions} from '../types';
import {DEFAULT_PAGE_SIZE} from '../types';
import {useServerSidePagination} from './useServerSidePagination';

interface Item {
  readonly id: string;
  readonly name: string;
}

function makeResponse(overrides: Partial<ServerSideResponse<Item>['meta']> = {}): ServerSideResponse<Item> {
  return {
    data: [{id: 'item-1', name: 'Detergent'}],
    meta: {total: 42, page: 1, limit: 10, totalPages: 5, hasNextPage: true, hasPreviousPage: false, ...overrides},
  };
}

const queryFn = vi.fn<(params: ServerSideParams | Record<string, unknown>) => Promise<ServerSideResponse<Item>>>();

/** Params of the most recent request the hook actually issued. */
function lastParams(): ServerSideParams {
  return queryFn.mock.calls.at(-1)?.[0] as ServerSideParams;
}

let keyCounter = 0;

function renderPagination(options: Partial<UseServerSidePaginationOptions<Item>> = {}) {
  const {wrapper} = createTestWrapper();
  // A fresh key per test keeps one test's cached response out of the next one.
  keyCounter += 1;
  return renderHook(
    () =>
      useServerSidePagination<Item>({
        queryKey: ['items', keyCounter],
        queryFn,
        debounceMs: 10,
        ...options,
      }),
    {wrapper},
  );
}

beforeEach(() => {
  queryFn.mockReset().mockResolvedValue(makeResponse());
});

describe('useServerSidePagination — request params', () => {
  it('asks for a 1-indexed first page at the default size', async () => {
    // Off-by-one here is invisible in the UI and silently skips or repeats a page.
    renderPagination();

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalled();
    });
    expect(lastParams()).toEqual({page: 1, pageSize: DEFAULT_PAGE_SIZE});
  });

  it('honours the initial page index and size', async () => {
    renderPagination({initialPageIndex: 2, initialPageSize: 25});

    await waitFor(() => {
      expect(lastParams()).toMatchObject({page: 3, pageSize: 25});
    });
  });

  it('sends a single sort as sortBy/sortOrder', async () => {
    renderPagination({initialSorting: [{id: 'name', desc: true}]});

    await waitFor(() => {
      expect(lastParams()).toMatchObject({sortBy: 'name', sortOrder: 'desc'});
    });
    expect(lastParams().multiSort).toBeUndefined();
  });

  it('switches to multiSort once more than one column is sorted', async () => {
    renderPagination({
      initialSorting: [
        {id: 'name', desc: false},
        {id: 'createdAt', desc: true},
      ],
    });

    await waitFor(() => {
      expect(lastParams().multiSort).toEqual([
        {field: 'name', order: 'asc'},
        {field: 'createdAt', order: 'desc'},
      ]);
    });
    expect(lastParams().sortBy).toBeUndefined();
  });

  it('maps column filters onto the filters array', async () => {
    renderPagination({initialFilters: [{id: 'status', value: 'ACTIVE'}]});

    await waitFor(() => {
      expect(lastParams().filters).toEqual([{field: 'status', operator: 'contains', value: 'ACTIVE'}]);
    });
  });

  it('omits an empty global filter instead of sending an empty string', async () => {
    renderPagination();

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalled();
    });
    expect(lastParams().globalFilter).toBeUndefined();
  });

  it('debounces the global filter into a single request', async () => {
    const {result} = renderPagination();

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.setGlobalFilter('a');
    });
    act(() => {
      result.current.setGlobalFilter('ac');
    });
    act(() => {
      result.current.setGlobalFilter('acme');
    });

    await waitFor(() => {
      expect(lastParams().globalFilter).toBe('acme');
    });
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it('does not refetch when disabled', async () => {
    renderPagination({enabled: false});

    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    expect(queryFn).not.toHaveBeenCalled();
  });
});

describe('useServerSidePagination — page reset', () => {
  it('returns to the first page when a column filter changes', async () => {
    // Filtering while on page 4 otherwise asks the server for a page that no longer
    // exists and renders an empty list.
    const {result} = renderPagination({initialPageIndex: 3});

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalled();
    });

    act(() => {
      result.current.setColumnFilters([{id: 'status', value: 'ACTIVE'}]);
    });

    expect(result.current.pagination.pageIndex).toBe(0);
    await waitFor(() => {
      expect(lastParams().page).toBe(1);
    });
  });

  it('returns to the first page when the global filter changes', async () => {
    const {result} = renderPagination({initialPageIndex: 3});

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalled();
    });

    act(() => {
      result.current.setGlobalFilter('acme');
    });

    expect(result.current.pagination.pageIndex).toBe(0);
  });

  it('returns to the first page when sorting changes', async () => {
    const {result} = renderPagination({initialPageIndex: 3});

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalled();
    });

    act(() => {
      result.current.setSorting([{id: 'name', desc: true}]);
    });

    expect(result.current.pagination.pageIndex).toBe(0);
  });

  it('keeps the page when only the page changes', async () => {
    const {result} = renderPagination();

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalled();
    });

    act(() => {
      result.current.setPagination({pageIndex: 2, pageSize: DEFAULT_PAGE_SIZE});
    });

    await waitFor(() => {
      expect(lastParams().page).toBe(3);
    });
  });

  it('clears every filter and the page on reset, leaving sorting alone', async () => {
    const {result} = renderPagination({
      initialPageIndex: 3,
      initialFilters: [{id: 'status', value: 'ACTIVE'}],
      initialGlobalFilter: 'acme',
      initialSorting: [{id: 'name', desc: true}],
    });

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalled();
    });

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.columnFilters).toEqual([]);
    expect(result.current.globalFilter).toBe('');
    expect(result.current.pagination.pageIndex).toBe(0);
    expect(result.current.sorting).toEqual([{id: 'name', desc: true}]);
  });
});

// ===========================================================================
// The DataTable owns pagination/sorting/filter state and reports all four slices at once,
// so `onServerStateChange` is the only wire between the two. These cover what that wire has
// to do that the per-slice setters must not: apply the page the table asked for (it has
// already done its own reset), and skip the second debounce on a search value the table
// has already debounced.
// ===========================================================================
describe('useServerSidePagination — driven by the DataTable', () => {
  const stateAt = (pageIndex: number, overrides: Partial<ServerTableState> = {}): ServerTableState => ({
    pagination: {pageIndex, pageSize: DEFAULT_PAGE_SIZE},
    sorting: [],
    columnFilters: [],
    globalFilter: '',
    ...overrides,
  });

  it('turns one emit into one request carrying every slice', async () => {
    const {result} = renderPagination();

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalled();
    });

    act(() => {
      result.current.onServerStateChange(
        stateAt(2, {
          sorting: [{id: 'name', desc: true}],
          columnFilters: [{id: 'status', value: 'ACTIVE'}],
          globalFilter: 'acme',
        }),
      );
    });

    await waitFor(() => {
      expect(lastParams()).toEqual({
        page: 3,
        pageSize: DEFAULT_PAGE_SIZE,
        sortBy: 'name',
        sortOrder: 'desc',
        globalFilter: 'acme',
        filters: [{field: 'status', operator: 'contains', value: 'ACTIVE'}],
      });
    });
  });

  it('honours the page the table reports instead of resetting it', async () => {
    // The table resets to page 0 itself, in the same commit as the filter change. Resetting
    // again here would drop a legitimate "page 3 of the filtered set" back to page 1.
    const {result} = renderPagination();

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalled();
    });

    act(() => {
      result.current.onServerStateChange(stateAt(3, {columnFilters: [{id: 'status', value: 'ACTIVE'}]}));
    });

    expect(result.current.pagination.pageIndex).toBe(3);
    await waitFor(() => {
      expect(lastParams().page).toBe(4);
    });
  });

  it('does not debounce a search value the table has already debounced', async () => {
    // `setGlobalFilter` waits `debounceMs` before the value reaches the request. A value
    // arriving through `onServerStateChange` has already waited once in the search box, so
    // paying for it twice would show up to the user as a search that lags a keystroke behind.
    const {result} = renderPagination({debounceMs: 5000});

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalled();
    });

    act(() => {
      result.current.onServerStateChange(stateAt(0, {globalFilter: 'acme'}));
    });

    await waitFor(() => {
      expect(lastParams().globalFilter).toBe('acme');
    });
  });
});

describe('useServerSidePagination — response handling', () => {
  it('exposes rows and totals from the response', async () => {
    renderPagination();
    const {result} = renderPagination();

    await waitFor(() => {
      expect(result.current.data).toEqual([{id: 'item-1', name: 'Detergent'}]);
    });
    expect(result.current.totalRows).toBe(42);
    expect(result.current.totalPages).toBe(5);
  });

  it('trusts the page count the server reports over one derived from the total', async () => {
    // The `?? Math.ceil(total / pageSize)` fallback only fires when meta.totalPages is
    // absent, and `ServerSideResponse` makes it required — so the derived branch is
    // unreachable through the typed contract. Left as-is here, but it is dead weight
    // (or the type is wrong) and worth resolving before this ships as a package.
    queryFn.mockResolvedValue({
      data: [],
      meta: {total: 42, page: 1, limit: 10, totalPages: 3, hasNextPage: false, hasPreviousPage: false},
    });
    const {result} = renderPagination({initialPageSize: 10});

    await waitFor(() => {
      expect(result.current.totalRows).toBe(42);
    });
    expect(result.current.totalPages).toBe(3);
  });

  it('falls back to an empty list rather than undefined while loading', () => {
    const {result} = renderPagination();

    expect(result.current.data).toEqual([]);
    expect(result.current.totalRows).toBe(0);
    expect(result.current.isLoading).toBe(true);
  });

  it('surfaces a failed request', async () => {
    queryFn.mockRejectedValue(new Error('Bad gateway'));
    const {result} = renderPagination();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBe('Bad gateway');
  });

  it('runs the response through transformResponse', async () => {
    // Lets a page adapt an API whose envelope does not match ServerSideResponse.
    queryFn.mockResolvedValue(makeResponse());
    const {result} = renderPagination({
      transformers: {
        transformResponse: () => ({
          data: [{id: 'x', name: 'transformed'}],
          meta: {total: 1, page: 1, limit: 10, totalPages: 1, hasNextPage: false, hasPreviousPage: false},
        }),
      },
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([{id: 'x', name: 'transformed'}]);
    });
  });
});

// ===========================================================================
// REGRESSION — hooks/useServerSidePagination.ts
//
//   const transformedParams = useMemo(... transformers.transformParams(serverParams) ...)
//   const fullQueryKey = useMemo(() => [...queryKey, transformedParams], ...)
//   queryFn: async () => { const response = await queryFn(serverParams); ... }
//
// `transformParams` is applied to the CACHE KEY and nowhere else. The request itself
// is still sent with the untransformed `serverParams`, so a consumer using the
// transformer to rename fields for their API (`page` -> `offset`, `pageSize` ->
// `limit`) gets a correctly-keyed cache entry holding the result of a request the
// server never understood.
//
// Failed when written; passes now that `queryFn` is called with `transformedParams`.
// ===========================================================================
describe('Regression — transformParams must reach the request', () => {
  it('sends the transformed params to the server', async () => {
    renderPagination({
      transformers: {
        transformParams: (params: ServerSideParams) => ({
          offset: (params.page - 1) * params.pageSize,
          limit: params.pageSize,
        }),
      },
    });

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalled();
    });
    expect(lastParams()).toEqual({offset: 0, limit: DEFAULT_PAGE_SIZE});
  });
});
