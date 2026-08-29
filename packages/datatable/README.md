# @bohardlabs/datatable

A server-driven React data table: TanStack Table for the engine, MUI for the shell.

## What makes it different

Most React tables assume the whole dataset is in the browser and treat server-side data as
an escape hatch. This one inverts that. The table owns pagination, sorting, filtering and
search state, persists it per `tableId`, and emits one consolidated `ServerTableState` for
the consumer to turn into query params. Client-side mode is the special case.

That ownership is the point. Nothing about that state is passed back in as a controlled
prop, which is what stops the two failures every hand-wired table eventually has: fetching
twice on mount, and showing page 5 of the previous filter's results.

## Install

```bash
pnpm add @bohardlabs/datatable
```

The package itself has no `dependencies`. Everything it uses is a peer, so your app's copy
of React and MUI is the only copy in the bundle. Nine packages are required:

```bash
pnpm add react react-dom @mui/material @mui/icons-material @emotion/react @emotion/styled \
  @tanstack/react-table @mui/x-date-pickers dayjs
```

| Peer                                         | Required | Needed for                                           |
| -------------------------------------------- | -------- | ---------------------------------------------------- |
| `react` ^19, `react-dom` ^19                 | yes      | everything                                           |
| `@mui/material` ^7, `@mui/icons-material` ^7 | yes      | the entire shell: table, toolbar, dialogs, icons     |
| `@emotion/react` ^11, `@emotion/styled` ^11  | yes      | MUI's styling engine                                 |
| `@tanstack/react-table` ^8.21                | yes      | the table engine (rows, columns, sorting model)      |
| `@mui/x-date-pickers` ^8, `dayjs` ^1.11      | yes      | the date filter, imported statically by the panel    |
| `@tanstack/react-query` ^5                   | optional | only `useServerSidePagination`, behind its own entry |
| `write-excel-file` ^3                        | optional | only `xlsx` export, and only when a user clicks it   |

The last two are the only genuinely optional ones, and they are the two marked `optional` in
`peerDependenciesMeta`. `@mui/x-date-pickers` and `dayjs` look conditional but are not: the
filter panel imports `DateFilter` at the top level, so a bundler resolves them whether or not
any column is configured with `filterConfig: {type: 'date'}`. `write-excel-file` is different
because the export path reaches it through `await import()`; nothing loads until the button
is pressed.

ESM only. React 19 and MUI v7 already require a modern toolchain, so there is no CJS build.

## Setup

The table renders MUI components, so it needs MUI's providers from the host app. It brings
no provider of its own.

```tsx
import {ThemeProvider, createTheme} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const theme = createTheme();

export function App({children}: {children: React.ReactNode}) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
```

Two more, each only when you use the feature:

```tsx
// Date filters. Without this, MUI's DatePicker throws for a missing localization context.
import {LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';

<LocalizationProvider dateAdapter={AdapterDayjs}>{children}</LocalizationProvider>;

// Only for useServerSidePagination, the one export that uses React Query.
import {QueryClientProvider} from '@tanstack/react-query';
```

There is nothing else to configure. No CSS import, no `<DataTableProvider>`, no global
registry: everything is a prop.

## Quick start, client-side

When the browser already holds the whole dataset, hand it over and the table does the rest:
sorting, filtering, search and paging are all local.

```tsx
import {DataTable} from '@bohardlabs/datatable';
import type {DataTableColumnDef} from '@bohardlabs/datatable';

interface Order {
  id: string;
  reference: string;
  customer: string;
  total: number;
  readonly [key: string]: unknown; // required by the RowData constraint
}

// A module constant, not an inline array: a new array every render rebuilds the table.
const columns: DataTableColumnDef<Order>[] = [
  {id: 'reference', accessorKey: 'reference', header: 'Reference', size: 120},
  {id: 'customer', accessorKey: 'customer', header: 'Customer'},
  {
    id: 'total',
    accessorKey: 'total',
    header: 'Total',
    align: 'right',
    cell: ({row}) => `$${row.original.total.toFixed(2)}`,
  },
];

export function OrdersTable({orders}: {orders: Order[]}) {
  return <DataTable columns={columns} data={orders} ariaLabel="Orders" />;
}
```

## Server-driven, the intended use

The table reports state; you turn it into a request. Two routes, depending on whether the
app already has a data layer.

### Route 1: your own API hooks (recommended)

`useTableServerState` seeds the page's state from the same persisted entry the table will
restore, so the first query already uses the persisted page size and no throwaway request
goes out at the default one.

```tsx
import {DataTable, useTableServerState} from '@bohardlabs/datatable';
import {keepPreviousData, useQuery} from '@tanstack/react-query';
import {useMemo} from 'react';

export function OrdersPage() {
  // Same id as the DataTable below. It is the persistence key for both.
  const {serverState, onServerStateChange} = useTableServerState('orders', {
    pageSize: 25,
    sorting: [{id: 'placedAt', desc: true}],
  });

  const params = useMemo(() => {
    const {pagination, sorting, globalFilter, columnFilters} = serverState;
    return {
      page: pagination.pageIndex + 1, // most APIs are 1-indexed, TanStack is 0-indexed
      limit: pagination.pageSize,
      search: globalFilter || undefined,
      status: columnFilters.find((f) => f.id === 'status')?.value,
      sortBy: sorting[0]?.id,
      sortOrder: sorting[0]?.desc ? 'desc' : 'asc',
    };
  }, [serverState]);

  const {data, isLoading, isFetching, isError, refetch} = useQuery({
    queryKey: ['orders', params],
    queryFn: () => fetchOrders(params),
    placeholderData: keepPreviousData, // keeps the old page on screen while the next loads
  });

  return (
    <DataTable
      tableId="orders"
      columns={columns}
      data={data?.data ?? []} // one page, read defensively
      totalRows={data?.meta?.total ?? 0} // the real size, or the pager says "1 of 1"
      manualPagination
      manualSorting
      manualFiltering
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      onRetry={refetch}
      onServerStateChange={onServerStateChange}
      ariaLabel="Orders"
    />
  );
}
```

### Route 2: the built-in React Query helper

For a page with no data layer of its own. `useServerSidePagination` owns the state, debounces
the search, builds the params and runs the query. This hook is the only place React Query
appears, which is why it sits behind `@bohardlabs/datatable/server`: server mode itself does not
need it, and Route 1 above never imports it.

```tsx
import {DataTable} from '@bohardlabs/datatable';
import {useServerSidePagination} from '@bohardlabs/datatable/server';

export function OrdersPage() {
  const table = useServerSidePagination<Order>({
    queryKey: ['orders'], // request params are appended to this for you
    queryFn: (params) => api.get('/orders', {params}).then((r) => r.data),
    initialPageSize: 25,
    transformers: {
      // ServerSideParams is this package's vocabulary. Map it to your API's once, here.
      transformParams: (p) => ({page: p.page, limit: p.pageSize, search: p.globalFilter}),
    },
  });

  return (
    <DataTable
      columns={columns}
      data={table.data}
      totalRows={table.totalRows}
      manualPagination
      manualSorting
      manualFiltering
      isLoading={table.isLoading}
      isFetching={table.isFetching}
      isError={table.isError}
      onRetry={table.refetch}
      onServerStateChange={table.onServerStateChange}
      ariaLabel="Orders"
    />
  );
}
```

### The rules that come with server mode

- **`totalRows` is not optional.** `data.length` is one page; without the total the pager
  reports "1 of 1" and the user can never leave page one.
- **Do not feed state back in.** The table owns it. Build params from what
  `onServerStateChange` reports and pass nothing back.
- **Anything derived from `data` is derived from one page.** A footer total, "select all",
  and the built-in export all see the current page only. If a total has to mean the whole
  set, it comes from the server; if an export has to, use `onExport`.
- **Page reset is already handled.** The table returns to page 1 in the same commit as a
  filter change, so a consumer never has to reset it (and should not).

## Persistence

Pass `tableId` and the table writes sorting, filters, search, column order, sizing,
visibility, pinning, density and page size to `localStorage`, then restores them on the next
mount. Omit it and the table is stateless, which is what a modal or a story usually wants.

Two tables sharing an id share their state, so a detail-page sub-list gets its own id even
when it reuses the same columns. `getTableStateStorageKey(tableId)` is exported for apps
migrating existing keys.

## Strings and translation

The package ships English and has no i18n runtime, because one would force every consumer
onto the same library. Pass the strings you have translated; the rest fall back.

```tsx
// Module constant: `labels` is compared by identity.
const FRENCH: Partial<DataTableLabels> = {
  globalSearch: 'Rechercher...',
  rowsPerPage: 'Lignes par page',
  pageOf: (current, total) => `Page ${current} sur ${total}`,
};

<DataTable labels={FRENCH} columns={columns} data={rows} />;
```

## Fitting the app's own components

Two pieces of the table would otherwise look imported. Both are props.

```tsx
<DataTable
  // Replaces the built-in confirmation for a destructive bulk action, so the app does not
  // end up with two dialogs that look different. Same props the built-in one takes.
  slots={{confirmDialog: AppConfirmDialog}}
  // What the date filter shows, and what it puts on the wire. Defaults are DD/MM/YYYY
  // and YYYY-MM-DD.
  dateFormats={{display: 'MM/DD/YYYY', value: 'YYYY-MM-DD'}}
  columns={columns}
  data={rows}
/>
```

It works the other way too. If the app has no confirmation dialog of its own, the table's is
exported, so a detail page can use the same one instead of building a near-match:

```tsx
import {ConfirmDialog} from '@bohardlabs/datatable';

<ConfirmDialog
  open={isConfirming}
  onClose={() => setIsConfirming(false)}
  onConfirm={() => deleteOrder(id)} // may return a promise; the dialog waits on it
  title="Delete order"
  message="SW-1000 will be removed. This cannot be undone."
  confirmLabel="Delete"
  confirmColor="error"
/>;
```

No `DataTable` needs to be anywhere above it. `open` stays the caller's state: the dialog
disables both buttons while `onConfirm` runs, but closing is the caller's to do. Its props
are `DataTableConfirmProps`, the same type `slots.confirmDialog` takes, so a wrapper that
fixes `confirmColor` for the app can be passed straight back in as the slot.

## Theming

No colour, font or radius is hardcoded. The table reads `primary.main`, `divider`,
`text.secondary`, `action.hover` and the rest from the active MUI theme, so it takes on the
host app's look through `createTheme` alone. A table that looks different in two apps is
usually those apps' `MuiTableCell` and `MuiTableRow` overrides, not this package.

## Public surface

`DataTable` is the product. Its parts (headers, cells, toolbar, pager) are deliberately not
exported: exporting them would freeze the internal composition into the contract.
`ConfirmDialog` is the exception, because it is a whole component the table happens to use
rather than a part of its composition.

| Export                                              | What it is                                       |
| --------------------------------------------------- | ------------------------------------------------ |
| `DataTable`                                         | the component                                    |
| `ConfirmDialog`                                     | the confirmation, usable on its own              |
| `useTableServerState`, `getInitialServerState`      | server-state seeding for a list page             |
| `DEFAULT_LABELS`, `DataTableLabels`                 | strings and their type                           |
| `getTableStateStorageKey`, `DEFAULT_STORAGE_PREFIX` | persistence keys, for migrating an app           |
| `useDataTable`, `useTableUI`, `useTableCore`, …     | context, for custom cells that need table state  |
| `DEFAULT_PAGE_SIZE`, `DENSITY_CONFIG`, …            | the defaults, so an app can match them           |
| `useInlineEdit`                                     | inline row editing; `onSave` is your own write   |
| `slots`, `dateFormats`                              | swap in the app's confirm dialog and date format |
| `@bohardlabs/datatable/server`                           | `useServerSidePagination` (needs React Query)    |

Every prop is documented in `types.ts` with the gotcha attached, and rendered as a prop
table in Storybook.

## Storybook

```bash
pnpm storybook   # from the repo root
```

The stories are the demo, the interaction tests and the accessibility checks at once. Start
with **Guides → Getting started** and **Guides → Server-side data**.
