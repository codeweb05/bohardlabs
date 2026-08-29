/**
 * Optional entry point for the one hook that runs a query for you.
 *
 * `useServerSidePagination` is the only thing in the whole package that imports
 * `@tanstack/react-query`, and it lives here so that importing `@bohardlabs/datatable` never
 * resolves the peer. Server mode itself does not need it: `useTableServerState` plus
 * `onServerStateChange` from the main entry drive a table from any data layer, including
 * a hand-rolled `fetch` in a `useEffect`.
 */
export {useServerSidePagination} from './hooks/useServerSidePagination';

export type {
  ServerSideParams,
  ServerSideResponse,
  ServerSideTransformers,
  UseServerSidePaginationOptions,
  UseServerSidePaginationReturn,
} from './types';
