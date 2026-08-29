/**
 * Coverage for `useTableQuery` and `useTableMutation`, previously 0%.
 *
 * Both are thin, and the thin part is the contract: they replace React Query's `error`
 * (an `Error`) with a rendered string, and `useTableMutation` keeps that string in its
 * own state so a failure survives until it is cleared. Nothing else in the package
 * asserts either, so these tests are the only description of both.
 */
import {act, renderHook, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import {createTestWrapper} from '../test/test-utils';
import {useTableMutation, useTableQuery} from './hooks';

interface Item {
  readonly id: string;
}

let keyCounter = 0;

/**
 * A fresh key per test keeps one test's cached response out of the next one.
 *
 * Call it once per test and close over the result. Calling it inside the render callback
 * mints a new key on every render, so the query restarts instead of settling.
 */
function nextKey(): readonly unknown[] {
  keyCounter += 1;
  return ['table-query', keyCounter];
}

describe('useTableQuery', () => {
  it('reports no error while the query succeeds', async () => {
    const {wrapper} = createTestWrapper();
    const queryKey = nextKey();

    const {result} = renderHook(() => useTableQuery<Item>({queryKey, queryFn: () => Promise.resolve({id: 'item-1'})}), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({id: 'item-1'});
    expect(result.current.error).toBeNull();
  });

  it('replaces a failed query error with its message', async () => {
    const {wrapper} = createTestWrapper();
    const queryKey = nextKey();

    const {result} = renderHook(
      () => useTableQuery<Item>({queryKey, queryFn: () => Promise.reject(new Error('Boom'))}),
      {wrapper},
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    // The substitution is the whole point of the wrapper: the table renders this value
    // directly, so handing it an `Error` would print "[object Object]".
    expect(result.current.error).toBe('Boom');
    expect(result.current.error).not.toBeInstanceOf(Error);
  });

  it('leaves the rest of the query result untouched', async () => {
    const {wrapper} = createTestWrapper();
    const queryKey = nextKey();

    const {result} = renderHook(() => useTableQuery<Item>({queryKey, queryFn: () => Promise.resolve({id: 'item-2'})}), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    // Only `error` is rewritten. A consumer still reaches for the flags and `refetch`.
    expect(result.current.isFetching).toBe(false);
    expect(typeof result.current.refetch).toBe('function');
  });
});

describe('useTableMutation', () => {
  it('reports no error and forwards onSuccess after a successful mutation', async () => {
    const {wrapper} = createTestWrapper();
    const onSuccess = vi.fn();

    const {result} = renderHook(
      () => useTableMutation<Item, string>({mutationFn: (name: string) => Promise.resolve({id: name}), onSuccess}),
      {wrapper},
    );

    act(() => {
      result.current.mutate('item-1');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.error).toBeNull();
    // The wrapper adds its own `onSuccess`; the caller's still has to run.
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.calls[0]?.[0]).toEqual({id: 'item-1'});
  });

  it('holds the message and forwards onError after a failed mutation', async () => {
    const {wrapper} = createTestWrapper();
    const onError = vi.fn();

    const {result} = renderHook(
      () =>
        useTableMutation<Item, string>({
          mutationFn: () => Promise.reject(new Error('Save rejected')),
          onError,
        }),
      {wrapper},
    );

    act(() => {
      result.current.mutate('item-1');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBe('Save rejected');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('runs without either callback supplied', async () => {
    const {wrapper} = createTestWrapper();

    const {result} = renderHook(
      () => useTableMutation<Item, string>({mutationFn: () => Promise.reject(new Error('Still recorded'))}),
      {wrapper},
    );

    act(() => {
      result.current.mutate('item-1');
    });

    // Both callbacks are optional, and the wrapper reaches them through `?.`. Omitting
    // them must not throw on the way to setting the message.
    await waitFor(() => {
      expect(result.current.error).toBe('Still recorded');
    });
  });

  it('clears the message on clearError', async () => {
    const {wrapper} = createTestWrapper();

    const {result} = renderHook(
      () => useTableMutation<Item, string>({mutationFn: () => Promise.reject(new Error('Save rejected'))}),
      {wrapper},
    );

    act(() => {
      result.current.mutate('item-1');
    });
    await waitFor(() => {
      expect(result.current.error).toBe('Save rejected');
    });

    act(() => {
      result.current.clearError();
    });

    // This is why the message lives in state rather than being derived from
    // `mutation.error`: a form has to be able to dismiss it without a retry.
    expect(result.current.error).toBeNull();
  });

  it('clears a previous failure when a later attempt succeeds', async () => {
    const {wrapper} = createTestWrapper();
    const mutationFn = vi
      .fn<(name: string) => Promise<Item>>()
      .mockRejectedValueOnce(new Error('Save rejected'))
      .mockResolvedValueOnce({id: 'item-1'});

    const {result} = renderHook(() => useTableMutation<Item, string>({mutationFn}), {wrapper});

    act(() => {
      result.current.mutate('item-1');
    });
    await waitFor(() => {
      expect(result.current.error).toBe('Save rejected');
    });

    act(() => {
      result.current.mutate('item-1');
    });

    // Without the reset in `onSuccess` the stale message would sit above a row that
    // saved fine.
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.error).toBeNull();
  });
});
