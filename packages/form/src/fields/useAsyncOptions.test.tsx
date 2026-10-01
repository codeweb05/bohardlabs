import {act, renderHook, waitFor} from '@testing-library/react';

import {useAsyncOptions} from './useAsyncOptions.js';

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: Error) => void = () => {};
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return {promise, resolve, reject};
}

const settings = {active: true, debounceMs: 0, minQueryLength: 0};

describe('useAsyncOptions', () => {
  it('keeps only the latest query when an older request answers last', async () => {
    const ab = deferred<string[]>();
    const abc = deferred<string[]>();
    const signals: AbortSignal[] = [];
    const load = vi.fn((query: string, {signal}: {signal: AbortSignal}) => {
      signals.push(signal);
      return query === 'ab' ? ab.promise : abc.promise;
    });

    const {result, rerender} = renderHook(({query}) => useAsyncOptions(load, query, settings), {
      initialProps: {query: 'ab'},
    });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    rerender({query: 'abc'});
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));

    expect(signals[0]?.aborted).toBe(true);
    await act(async () => abc.resolve(['abc result']));
    await act(async () => ab.resolve(['stale ab result']));

    expect(result.current).toEqual({options: ['abc result'], status: 'loaded'});
  });

  it('is idle below the minimum query length and while closed', () => {
    const load = vi.fn(async () => ['x']);
    const {result, rerender} = renderHook(
      ({query, active}) => useAsyncOptions(load, query, {...settings, active, minQueryLength: 2}),
      {
        initialProps: {query: 'a', active: true},
      },
    );
    expect(result.current.status).toBe('idle');
    rerender({query: 'ab', active: false});
    expect(result.current.status).toBe('idle');
    expect(load).not.toHaveBeenCalled();
  });

  it('does not count surrounding whitespace toward the minimum query length', async () => {
    const load = vi.fn(async () => ['x']);
    const {result, rerender} = renderHook(({query}) => useAsyncOptions(load, query, {...settings, minQueryLength: 3}), {
      initialProps: {query: '   '},
    });
    expect(result.current.status).toBe('idle');
    rerender({query: ' ab '});
    expect(result.current.status).toBe('idle');
    // The debounce is zero, so a request would have gone out by now.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(load).not.toHaveBeenCalled();

    rerender({query: ' abc'});
    await waitFor(() => expect(result.current.status).toBe('loaded'));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reports a failed load as an error, not as an empty result', async () => {
    const load = vi.fn(async () => {
      throw new Error('network');
    });
    const {result} = renderHook(() => useAsyncOptions(load, 'a', settings));
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('reports a loader that throws before returning a promise as an error', async () => {
    const load = vi.fn((): Promise<string[]> => {
      throw new Error('bad query');
    });
    const {result} = renderHook(() => useAsyncOptions(load, 'a', settings));
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('uses the latest loadOptions without reloading when only its identity changes', async () => {
    const first = vi.fn(async () => ['first']);
    const second = vi.fn(async () => ['second']);
    const {rerender} = renderHook(({load, query}) => useAsyncOptions(load, query, settings), {
      initialProps: {load: first, query: 'q'},
    });
    await waitFor(() => expect(first).toHaveBeenCalledTimes(1));

    rerender({load: second, query: 'qq'});
    await waitFor(() => expect(second).toHaveBeenCalledTimes(1));
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('keeps the latest result when an older request fails last', async () => {
    const ab = deferred<string[]>();
    const load = vi.fn((query: string) => (query === 'ab' ? ab.promise : Promise.resolve(['abc result'])));

    const {result, rerender} = renderHook(({query}) => useAsyncOptions(load, query, settings), {
      initialProps: {query: 'ab'},
    });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    rerender({query: 'abc'});
    await waitFor(() => expect(result.current.status).toBe('loaded'));

    await act(async () => ab.reject(new Error('timed out')));

    expect(result.current).toEqual({options: ['abc result'], status: 'loaded'});
  });
});
