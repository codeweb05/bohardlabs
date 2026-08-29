import {useMutation, useQuery} from '@tanstack/react-query';
import type {UseMutationOptions, UseQueryOptions} from '@tanstack/react-query';
import {useCallback, useState} from 'react';

import {getErrorMessage} from './errors';

/**
 * Thin wrappers over React Query that surface an error *message* rather than an `Error`.
 *
 * The table renders the message directly, and a consumer's transport (axios, fetch, tRPC)
 * decides what a useful message looks like. Anything richer than this (toasts, retry
 * policy, auth refresh) belongs to the app, not the table.
 *
 * Nothing the `DataTable` itself renders comes through here. These two are used only by
 * `useServerSidePagination`, which is why they sit behind the `/server` subpath.
 */

export function useTableQuery<TData, TQueryKey extends readonly unknown[] = readonly unknown[]>(
  options: UseQueryOptions<TData, Error, TData, TQueryKey>,
) {
  const query = useQuery(options);
  return {...query, error: query.error ? getErrorMessage(query.error) : null};
}

export function useTableMutation<TData = unknown, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, Error, TVariables, TContext>,
) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    ...options,
    onSuccess: (...args) => {
      setErrorMessage(null);
      options.onSuccess?.(...args);
    },
    onError: (...args) => {
      setErrorMessage(getErrorMessage(args[0]));
      options.onError?.(...args);
    },
  });

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  return {...mutation, error: errorMessage, clearError};
}
