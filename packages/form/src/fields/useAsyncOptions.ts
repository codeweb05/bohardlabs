import {useEffect, useRef, useState} from 'react';

export type LoadOptions<T> = (query: string, options: {signal: AbortSignal}) => Promise<readonly T[]>;

interface Settings {
  /** False while the list is closed: nothing loads until someone looks. */
  readonly active: boolean;
  readonly debounceMs: number;
  readonly minQueryLength: number;
}

interface Result<T> {
  readonly options: readonly T[];
  readonly status: 'idle' | 'loading' | 'loaded' | 'error';
}

const IDLE: Result<never> = {options: [], status: 'idle'};

/**
 * Loads options for a query, debounced, aborting the previous request when the query
 * changes. A result is kept together with the query it answers, so an old answer that
 * arrives late can never show under a newer query.
 */
export function useAsyncOptions<T>(
  loadOptions: LoadOptions<T>,
  query: string,
  {active, debounceMs, minQueryLength}: Settings,
): Result<T> {
  // A consumer usually passes an inline function. Reading it through a ref means a new
  // identity on every render does not refire the request.
  const loadRef = useRef(loadOptions);
  useEffect(() => {
    loadRef.current = loadOptions;
  });

  const [answer, setAnswer] = useState<{query: string; result: Result<T>} | null>(null);
  const shouldLoad = active && query.length >= minQueryLength;

  useEffect(() => {
    if (!shouldLoad) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void loadRef.current(query, {signal: controller.signal}).then(
        (options) => {
          if (!controller.signal.aborted) setAnswer({query, result: {options, status: 'loaded'}});
          return undefined;
        },
        () => {
          if (!controller.signal.aborted) setAnswer({query, result: {options: [], status: 'error'}});
          return undefined;
        },
      );
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, shouldLoad, debounceMs]);

  if (!shouldLoad) return IDLE;
  if (answer?.query !== query) return {options: [], status: 'loading'};
  return answer.result;
}
