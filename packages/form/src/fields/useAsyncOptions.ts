import {useEffect, useRef, useState} from 'react';

export type LoadOptions<T> = (query: string, options: {signal: AbortSignal}) => Promise<readonly T[]>;

/**
 * The search-and-shape properties `AsyncAutocompleteField` and `AsyncAutocompleteInput`
 * both take. Declared once here and picked up through `extends`, so a consumer's hover
 * still sees each property's own doc comment on either type.
 */
export interface AsyncOptionsProps<T> {
  /**
   * Called with what the user typed. Abort on `signal`; a newer query has replaced this one.
   * For caching, call `queryClient.fetchQuery` in here.
   */
  readonly loadOptions: LoadOptions<T>;
  readonly getOptionValue: (option: T) => string | number;
  readonly getOptionLabel: (option: T) => string;
  /** Store `T[]` instead of `T | null`. */
  readonly multiple?: boolean;
  readonly debounceMs?: number;
  readonly minQueryLength?: number;
  readonly placeholder?: string;
}

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
  // Trimmed, so spaces alone never reach a loader that may bill per request.
  const shouldLoad = active && query.trim().length >= minQueryLength;

  useEffect(() => {
    if (!shouldLoad) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      // Wrapped so a loader that throws before it returns a promise ends in the error
      // branch, not in an uncaught error that leaves the list loading.
      void Promise.resolve()
        .then(() => loadRef.current(query, {signal: controller.signal}))
        .then(
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
