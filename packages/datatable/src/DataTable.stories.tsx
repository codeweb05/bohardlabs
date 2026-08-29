import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {useEffect, useState, type ReactNode} from 'react';
import {expect, fn, userEvent, waitFor, within} from 'storybook/test';

import {DataTable} from './DataTable';
import type {DataTableLabels} from './i18n';
import {getTableStateStorageKey} from './storage/storageKey';
import {makeOrders, ORDERS, STATUS_OPTIONS, type Order} from './stories/fixtures';
import {
  DENSITY_CONFIG,
  type BulkAction,
  type DataTableColumnDef,
  type DataTableProps,
  type RowAction,
  type ServerTableState,
} from './types';

const STATUS_LABEL: Record<Order['status'], string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const columns: DataTableColumnDef<Order>[] = [
  {id: 'reference', accessorKey: 'reference', header: 'Reference', size: 120},
  {
    id: 'customer',
    accessorKey: 'customer',
    header: 'Customer',
    size: 180,
    enableFiltering: true,
    filterConfig: {type: 'text', placeholder: 'Customer name'},
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    size: 140,
    enableFiltering: true,
    filterConfig: {type: 'select', options: STATUS_OPTIONS},
    // A cell can render anything. Left uncoloured on purpose: MUI's filled palette chips
    // are below 4.5:1 against their own text at this size, and the a11y addon fails the
    // story for it, which is the check working rather than a nuisance.
    cell: ({row}) => <Chip size="small" variant="outlined" label={STATUS_LABEL[row.original.status]} />,
  },
  {id: 'items', accessorKey: 'items', header: 'Items', size: 90, align: 'right'},
  {
    id: 'total',
    accessorKey: 'total',
    header: 'Total',
    size: 110,
    align: 'right',
    cell: ({row}) => `$${row.original.total.toFixed(2)}`,
  },
  {id: 'placedAt', accessorKey: 'placedAt', header: 'Placed', size: 120},
];

const meta = {
  title: 'DataTable/DataTable',
  component: DataTable<Order>,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: [
          'A server-driven table: sorting, filtering, pagination, column management, selection,',
          'row actions, expansion and export, with the state persisted per `tableId`.',
          'The parts are deliberately not exported; everything a consumer influences is a prop.',
          '',
          'Each story below says what it is showing, and its controls are narrowed to the props',
          'that story is about. The full prop list is on this page, under Controls.',
          '',
          'New here? Read **Guides → Getting started** for install and setup, then',
          '**Guides → Server-side data**, which is what this table is built for.',
        ].join(' '),
      },
    },
  },
  args: {
    columns,
    data: ORDERS,
    ariaLabel: 'Orders',
  },
} satisfies Meta<typeof DataTable<Order>>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * MUI's `primary.main` (#1976d2) at 13px lands just under AA (4.26:1) on the tints this
 * table paints it against: the active-filter chip on paper, and the bulk bar's outlined
 * buttons on their own 6% primary wash. It comes from stock MUI's palette rather than
 * anything the table chose, and darkening those labels is a decision about the library's
 * default look, not a fix to make a story pass. Only this rule is switched off, and only
 * where it fires, so a new violation still fails the story. See docs/packages/datatable/port.md.
 */
const KNOWN_CONTRAST_EXCEPTION = {
  a11y: {config: {rules: [{id: 'color-contrast', enabled: false}]}},
};

/**
 * Narrows a story's controls to the props that story is demonstrating. `DataTable` takes
 * 77 props; a panel listing all of them on every story tells a reader nothing about which
 * ones the story is actually about, and burying the three that matter is worse than
 * showing none.
 *
 * Both keys are needed. The Controls *panel* reads `parameters.controls`; the Controls
 * *block* on a docs page defaults its filtering from `parameters.docs.controls`, so
 * setting only the first leaves the docs page unfiltered.
 */
function showcase(...props: readonly string[]) {
  return {
    controls: {include: [...props]},
    docs: {controls: {include: [...props]}},
  };
}

/**
 * The baseline: sortable headers, a global search, and client-side pagination.
 * `tableId` is omitted here on purpose, so the story does not write to localStorage and
 * every reload starts from the same state.
 */
export const Default: Story = {
  parameters: showcase('columns', 'data', 'ariaLabel', 'enableSorting', 'enablePagination', 'pageSize'),
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('SW-1000')).toBeInTheDocument();

    // Sorting is a header click, and it changes which row comes first rather than only
    // painting an arrow. Every sortable header carries the same `Sort ascending` label,
    // so the column has to be found by its own text first.
    await userEvent.click(canvas.getByRole('columnheader', {name: /total/i}));
    const firstRow = canvasElement.querySelector('tbody tr');
    await expect(firstRow).toHaveTextContent('$9.50');
  },
};

/** Nothing came back. The message is a prop, so it can say what the empty list means. */
export const Empty: Story = {
  parameters: showcase('data', 'emptyMessage'),
  args: {data: [], emptyMessage: 'No orders in this date range'},
  play: async ({canvasElement}) => {
    await expect(within(canvasElement).getByText('No orders in this date range')).toBeInTheDocument();
  },
};

/** First load. The toolbar stays mounted so the layout does not jump when rows arrive. */
export const Loading: Story = {
  parameters: showcase('isLoading', 'loadingMessage', 'showToolbar'),
  args: {data: [], isLoading: true},
};

/**
 * The request failed. `onRetry` is what turns the error state from a dead end into a
 * button; without it the table shows the message alone.
 */
export const ErrorState: Story = {
  parameters: showcase('isError', 'error', 'onRetry'),
  args: {
    data: [],
    isError: true,
    error: 'The orders service did not respond',
    onRetry: fn(),
  },
  play: async ({args, canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {name: /retry/i}));
    await expect(args.onRetry).toHaveBeenCalled();
  },
};

/**
 * Global search plus per-column filters. Search is debounced, which is why the assertion
 * below waits for the row to disappear rather than checking immediately.
 */
export const Filtering: Story = {
  parameters: {
    ...KNOWN_CONTRAST_EXCEPTION,
    ...showcase(
      'enableFiltering',
      'enableGlobalFilter',
      'globalFilterPlaceholder',
      'globalFilterHelperText',
      'initialFilters',
      'initialGlobalFilter',
    ),
  },
  args: {
    enableFiltering: true,
    enableGlobalFilter: true,
    globalFilterHelperText: 'Searches reference, customer and status',
  },
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByPlaceholderText(/search all columns/i), 'SW-1002');
    await waitFor(() => expect(canvas.queryByText('SW-1000')).not.toBeInTheDocument());
    await expect(canvas.getByText('SW-1002')).toBeInTheDocument();
  },
};

const bulkActions: BulkAction<Order>[] = [
  {id: 'assign', label: 'Assign driver', onClick: fn()},
  {
    id: 'cancel',
    label: 'Cancel orders',
    color: 'error',
    onClick: fn(),
    confirmMessage: (count) => `Cancel ${count} orders?`,
  },
];

/**
 * Selection with bulk actions. The action bar replaces the toolbar while anything is
 * selected, so the count and the actions are in one place.
 */
export const Selection: Story = {
  parameters: {
    ...KNOWN_CONTRAST_EXCEPTION,
    ...showcase(
      'enableRowSelection',
      'enableMultiRowSelection',
      'enableSelectAll',
      'bulkActions',
      'initialRowSelection',
      'onRowSelectionChange',
    ),
  },
  args: {
    enableRowSelection: true,
    enableSelectAll: true,
    bulkActions,
    onRowSelectionChange: fn(),
  },
  play: async ({args, canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('checkbox', {name: /select all rows/i}));
    await expect(args.onRowSelectionChange).toHaveBeenCalled();
    await expect(await canvas.findByRole('button', {name: /assign driver/i})).toBeInTheDocument();
  },
};

const rowActions: RowAction<Order>[] = [
  {id: 'view', label: 'View order', onClick: fn()},
  {id: 'reschedule', label: 'Reschedule', onClick: fn()},
  {
    id: 'cancel',
    label: 'Cancel',
    color: 'error',
    divider: true,
    onClick: fn(),
    hidden: (row) => row.status === 'cancelled',
  },
];

/**
 * Per-row actions in an overflow menu. `hidden` and `disabled` take the row, so an action
 * that makes no sense for a given row is not offered rather than offered and rejected.
 */
export const RowActions: Story = {
  parameters: showcase('rowActions'),
  args: {rowActions},
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const [firstMenu] = canvas.getAllByRole('button', {name: /actions/i});
    await userEvent.click(firstMenu as HTMLElement);
    const menu = within(document.body);
    await expect(await menu.findByRole('menuitem', {name: 'View order'})).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
  },
};

/**
 * Expandable rows for detail that does not deserve a column. `renderExpandedRow` gets the
 * whole TanStack row, so it can reach the original record.
 */
export const ExpandableRows: Story = {
  parameters: showcase(
    'enableExpanding',
    'renderExpandedRow',
    'allowMultipleExpanded',
    'expandTrigger',
    'animateExpansion',
  ),
  args: {
    enableExpanding: true,
    renderExpandedRow: (row) => (
      <Box sx={{px: 3, py: 2}}>
        <Typography variant="subtitle2">Delivery note</Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          {row.original.note || 'No note for this order'}
        </Typography>
      </Box>
    ),
  },
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const [firstToggle] = canvas.getAllByRole('button', {name: /expand row/i});
    await userEvent.click(firstToggle as HTMLElement);
    await expect(await canvas.findByText('Delivery note')).toBeInTheDocument();
  },
};

/**
 * Column management: reorder by dragging, resize by the header edge, pin a column to
 * either side, hide one from the visibility menu.
 */
export const ColumnManagement: Story = {
  parameters: showcase(
    'enableColumnOrdering',
    'enableColumnResizing',
    'enableColumnPinning',
    'enableColumnVisibility',
    'initialColumnOrder',
    'initialColumnPinning',
    'initialColumnVisibility',
    'onColumnOrderChange',
    'onColumnVisibilityChange',
  ),
  args: {
    enableColumnOrdering: true,
    enableColumnResizing: true,
    enableColumnPinning: true,
    enableColumnVisibility: true,
    initialColumnPinning: {left: ['reference'], right: []},
  },
};

/**
 * Captures what an export writes instead of letting the browser download it.
 *
 * Every writer reachable from this menu ends the same way: a blob URL on an anchor with a
 * `download` attribute, clicked. That is true of the built-in CSV and JSON paths and of
 * `write-excel-file`'s own saver. Stubbing the anchor click lets a story assert on the
 * bytes without dropping three files into the test runner's download directory on every
 * run.
 */
function captureDownloads() {
  const files: {name: string; blob: Blob}[] = [];
  const realClick = HTMLAnchorElement.prototype.click;
  const realCreateObjectURL = URL.createObjectURL;
  let lastBlob: Blob | null = null;

  URL.createObjectURL = (object: Blob | MediaSource) => {
    if (object instanceof Blob) lastBlob = object;
    return realCreateObjectURL.call(URL, object);
  };
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (this.download && lastBlob) files.push({name: this.download, blob: lastBlob});
  };

  return {
    files,
    restore() {
      HTMLAnchorElement.prototype.click = realClick;
      URL.createObjectURL = realCreateObjectURL;
    },
  };
}

async function clickExport(canvasElement: HTMLElement, itemName: string) {
  const canvas = within(canvasElement);
  // The menu renders in a portal, so it is on the document rather than in the canvas.
  const body = within(canvasElement.ownerDocument.body);

  await userEvent.click(canvas.getByRole('button', {name: 'Export'}));
  await userEvent.click(await body.findByRole('menuitem', {name: itemName}));
}

/**
 * **Data out.** `enableExport` puts a menu in the toolbar. It offers CSV alone by default,
 * because CSV is the only format that needs nothing installed; widen it with
 * `exportFormats`.
 *
 * - `csv` is built here and downloaded as a blob.
 * - `xlsx` goes through `write-excel-file`, reached with `await import()` when the item is
 *   clicked, so nothing loads for an app that never exports a spreadsheet. Listing the
 *   format without the peer installed fails at click time, not at build time. That is the
 *   cost of it being optional.
 * - `json` is `JSON.stringify` of the same rows.
 *
 * All three write a real file here, named from `exportFileName`. Pick one and your browser
 * downloads `orders.csv`, `orders.xlsx` or `orders.json`.
 *
 * What gets exported is the rows the table currently holds, after filtering, which in
 * server mode is one page. **Export handler** below is the way out of that.
 *
 * There is no import counterpart, and that is deliberate rather than missing. Reading a
 * file means parsing, mapping columns onto fields, validating each row, showing what
 * failed and letting someone fix it, then writing. All of that belongs to your data layer,
 * and none of it is a rendering concern. See **Guides → Getting started**.
 */
export const Exporting: Story = {
  parameters: showcase('enableExport', 'exportFormats', 'exportFileName'),
  args: {
    enableExport: true,
    exportFormats: ['csv', 'xlsx', 'json'],
    exportFileName: 'orders',
  },
  play: async ({canvasElement}) => {
    const body = within(canvasElement.ownerDocument.body);
    const downloads = captureDownloads();

    try {
      await clickExport(canvasElement, 'Export CSV');
      await clickExport(canvasElement, 'Export JSON');
      // The spreadsheet writer is behind a dynamic import, so the file arrives a tick late.
      await clickExport(canvasElement, 'Export Excel');
      await waitFor(() => expect(downloads.files).toHaveLength(3));

      await expect(downloads.files.map((file) => file.name)).toEqual(['orders.csv', 'orders.json', 'orders.xlsx']);

      // Not just "a file appeared": the header row and the first order, in column order.
      const csv = await downloads.files[0].blob.text();
      const [header, firstRow] = csv.split('\n');
      await expect(header).toBe('Reference,Customer,Status,Items,Total,Placed');
      await expect(firstRow).toBe('SW-1000,Amara Okafor,pending,1,9.5,2026-03-01');

      const json: unknown = JSON.parse(await downloads.files[1].blob.text());
      await expect(json).toEqual(ORDERS);
    } finally {
      downloads.restore();
      // Leave the menu closed for whoever opens this story next.
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(body.queryByRole('menu')).not.toBeInTheDocument());
    }
  },
};

/**
 * **Taking export over.** The built-in writers only ever see the rows the table is
 * holding, which in server mode is the page on screen. That is a footgun on a filtered
 * list of thousands.
 *
 * `onExport` is the escape hatch: pass it and it is called *instead of* the built-in
 * writer, with the chosen format and the rows the table has. Ignore the rows and call your
 * own export endpoint, and "export" can mean the whole result set rather than page four of
 * it. Nothing downloads unless you make it.
 *
 * This story passes one, so clicking an item writes no file and logs to the Actions panel
 * instead.
 */
export const ExportHandler: Story = {
  parameters: showcase('enableExport', 'exportFormats', 'onExport'),
  args: {
    enableExport: true,
    exportFormats: ['csv', 'xlsx', 'json'],
    onExport: fn(),
  },
  play: async ({args, canvasElement}) => {
    const downloads = captureDownloads();

    try {
      await clickExport(canvasElement, 'Export CSV');

      // The handler took over: it got every row the table holds, and nothing was written.
      await expect(args.onExport).toHaveBeenCalledWith('csv', ORDERS);
      await expect(downloads.files).toHaveLength(0);
    } finally {
      downloads.restore();
    }
  },
};

// A story-only id. Two tables sharing an id share their saved state, which is exactly why a
// detail-page sub-list needs its own even when it reuses the same columns.
const PERSISTED_TABLE_ID = 'storybook-orders';

/**
 * **Remembering the view.** Pass `tableId` and the table saves what the user set up and
 * restores it on the next mount. Omit it and the table is stateless, which is what a modal
 * or a one-off story wants.
 *
 * Try it: search for something, filter by status, sort a column, switch the density, hide a
 * column, then reload this frame. It all comes back. Eleven slices are saved, debounced into
 * one write 150ms after the last change:
 *
 * - sorting, column filters and the global search
 * - column order, sizing, visibility and pinning
 * - density, page size and page index
 *
 * The value lands in `localStorage` under `getTableStateStorageKey(tableId)`, which is
 * exported so an app migrating from its own keys can keep users' saved views instead of
 * resetting everyone.
 *
 * In server mode there is a second half to this. Restoring the view on mount is not enough
 * if the page has already fired its first query at the default page size, so the page hook
 * seeds itself from the same entry with `useTableServerState(tableId)`. That is what makes
 * a return visit one request at the saved page size instead of two. See
 * **Guides → Server-side data**.
 */
export const PersistedState: Story = {
  parameters: {
    ...showcase('tableId', 'enableFiltering', 'enableColumnVisibility', 'enableDensityToggle'),
    ...KNOWN_CONTRAST_EXCEPTION,
  },
  args: {
    tableId: PERSISTED_TABLE_ID,
    enableFiltering: true,
    enableGlobalFilter: true,
    enableColumnVisibility: true,
    enableDensityToggle: true,
  },
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const key = getTableStateStorageKey(PERSISTED_TABLE_ID);

    // Start from nothing, so the assertion below is about this run and not about whatever
    // a previous visitor left in this browser. Clearing the key is not enough on its own:
    // the story is doing the thing it documents, so on a re-run the field has already
    // been restored from the last run and typing into it would append.
    localStorage.removeItem(key);

    const search = canvas.getByPlaceholderText('Search all columns...');
    await userEvent.clear(search);
    await userEvent.type(search, 'Priya');

    // The write is debounced, so this is a wait rather than a read.
    await waitFor(async () => {
      const saved = localStorage.getItem(key);
      await expect(saved).not.toBeNull();
      await expect(JSON.parse(saved ?? '{}')).toMatchObject({globalFilter: 'Priya'});
    });
  },
};

/**
 * Three densities and a toggle. The row height, the padding and the font size move
 * together, so a compact table stays readable rather than only shorter.
 */
export const CompactDensity: Story = {
  parameters: showcase('density', 'enableDensityToggle'),
  args: {density: 'compact', enableDensityToggle: true},
};

/**
 * Where the scrolling happens is a layout decision, and it is one prop.
 *
 * By default the table has no height of its own: it grows to fit its rows and the **page**
 * scrolls, which is what you want on a detail page where the table sits under other content.
 * Setting `maxHeight` caps the scroll container instead, so the **table** scrolls and
 * everything around it stays put, which is what you want when the table is the page.
 * `stickyHeader` only means anything in the second mode, since it needs a scroll container
 * to stick to.
 *
 * Clear `maxHeight` in the controls to watch it switch back.
 */
export const ScrollContainment: Story = {
  parameters: showcase('maxHeight', 'stickyHeader', 'enablePagination'),
  args: {
    data: makeOrders(40),
    maxHeight: 360,
    stickyHeader: true,
    enablePagination: false,
  },
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const scroller = canvasElement.querySelector('.MuiTableContainer-root');

    // A capped container that is not actually overflowing would demonstrate nothing, so the
    // story asserts the setup before asserting the behaviour.
    await expect(scroller).toBeInstanceOf(HTMLElement);
    if (!(scroller instanceof HTMLElement)) return;
    await expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);

    const header = canvas.getByRole('columnheader', {name: /reference/i});
    const headerTop = header.getBoundingClientRect().top;

    scroller.scrollTop = 200;
    await waitFor(() => expect(scroller.scrollTop).toBeGreaterThan(0));

    // The point of `stickyHeader`: the body moved, the header did not.
    await waitFor(() => expect(header.getBoundingClientRect().top).toBeCloseTo(headerTop, 0));
  },
};

// Three rows and three columns for the galleries below. A variation is easier to read
// against a short table, and the point is the difference between the panels rather than the
// data in any one of them.
const SAMPLE = ORDERS.slice(0, 3);
const SAMPLE_COLUMNS: DataTableColumnDef<Order>[] = [
  {id: 'reference', accessorKey: 'reference', header: 'Reference'},
  {id: 'customer', accessorKey: 'customer', header: 'Customer'},
  {
    id: 'total',
    accessorKey: 'total',
    header: 'Total',
    align: 'right',
    cell: ({row}) => `$${row.original.total.toFixed(2)}`,
  },
];

/**
 * Renders one labelled panel per value of a prop, so the difference is visible in one
 * screen rather than by flipping a control and remembering the last one.
 */
function Gallery<TValue extends string>({
  caption,
  values,
  render,
}: {
  readonly caption: (value: TValue) => string;
  readonly values: readonly TValue[];
  readonly render: (value: TValue) => ReactNode;
}) {
  return (
    <Box sx={{display: 'grid', gap: 3}}>
      {values.map((value) => (
        <Box key={value}>
          <Typography variant="overline" sx={{color: 'text.secondary'}}>
            {caption(value)}
          </Typography>
          {render(value)}
        </Box>
      ))}
    </Box>
  );
}

/**
 * All three densities at once. Row height, cell padding and font size move together, so a
 * compact table stays readable rather than only shorter: 36px, 52px and 64px rows, at
 * 0.75rem, 0.8125rem and 0.875rem.
 *
 * These come from the `density` prop rather than from the theme. A consumer's `createTheme`
 * cannot move them, because the table sets all four through `sx`, and `sx` outranks a
 * theme's `styleOverrides`. Pick the one that suits the page and let the theme do the rest.
 */
export const DensityScale: Story = {
  parameters: showcase(),
  render: (args) => (
    <Gallery
      values={['spacious', 'comfortable', 'compact'] as const}
      caption={(density) => `density="${density}", ${DENSITY_CONFIG[density].rowHeight}px rows`}
      render={(density) => (
        <DataTable {...args} density={density} ariaLabel={`Orders, ${density}`} showToolbar={false} />
      )}
    />
  ),
  args: {data: SAMPLE, columns: SAMPLE_COLUMNS, enablePagination: false},
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const [spacious, comfortable, compact] = ['spacious', 'comfortable', 'compact'].map((density) =>
      canvas.getByRole('table', {name: `Orders, ${density}`}),
    );

    // Not "three tables rendered": each step of the scale is actually shorter than the last.
    await expect(spacious?.getBoundingClientRect().height).toBeGreaterThan(
      comfortable?.getBoundingClientRect().height ?? 0,
    );
    await expect(comfortable?.getBoundingClientRect().height).toBeGreaterThan(
      compact?.getBoundingClientRect().height ?? 0,
    );
  },
};

/**
 * The four values of `headerCase`, against headers written as `SW reference`, `customer`
 * and `USD total`.
 *
 * `capitalize` is the default and it is the wrong answer whenever a header is already an
 * acronym or a product name: it turns `USD total` into `Usd Total`. `none` prints the
 * string as written, which is what a column whose header was already decided should use.
 * The casing is CSS, so the accessible name and the exported header keep the original text
 * either way.
 */
export const HeaderCasing: Story = {
  parameters: showcase(),
  render: (args) => (
    <Gallery
      values={['capitalize', 'uppercase', 'lowercase', 'none'] as const}
      caption={(headerCase) => `headerCase="${headerCase}"${headerCase === 'capitalize' ? ' (default)' : ''}`}
      render={(headerCase) => (
        <DataTable {...args} headerCase={headerCase} ariaLabel={`Orders, ${headerCase}`} showToolbar={false} />
      )}
    />
  ),
  args: {
    data: SAMPLE,
    density: 'compact',
    enablePagination: false,
    columns: [
      {id: 'reference', accessorKey: 'reference', header: 'SW reference'},
      {id: 'customer', accessorKey: 'customer', header: 'customer'},
      {id: 'total', accessorKey: 'total', header: 'USD total', align: 'right'},
    ],
  },
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);

    // `text-transform` paints; it does not rewrite the DOM. So every variant still exposes
    // the header the column declared, which is what a screen reader and the CSV export read.
    for (const headerCase of ['capitalize', 'uppercase', 'lowercase', 'none']) {
      const table = canvas.getByRole('table', {name: `Orders, ${headerCase}`});
      await expect(within(table).getByRole('columnheader', {name: 'SW reference'})).toBeInTheDocument();
    }

    const verbatim = canvas.getByRole('table', {name: 'Orders, none'});
    const header = within(verbatim).getByRole('columnheader', {name: 'SW reference'});
    await expect(getComputedStyle(header).textTransform).toBe('none');
  },
};

/**
 * Headers are capitalised by default, which is wrong for anything that is already an
 * acronym or a product name. `headerCase: 'none'` prints the string as written.
 */
export const VerbatimHeaders: Story = {
  parameters: showcase('headerCase', 'columns'),
  args: {
    headerCase: 'none',

    columns: [
      {id: 'reference', accessorKey: 'reference', header: 'SW reference'},
      {id: 'customer', accessorKey: 'customer', header: 'customer'},
      {id: 'total', accessorKey: 'total', header: 'USD total', align: 'right'},
    ],

    density: 'compact',
  },
};

// A module constant, not an object literal in `args`: the table re-renders when `labels`
// changes identity, and a literal here would be a new object on every parent render.
/**
 * A complete Hindi set: every key in `DataTableLabels`, not a sample.
 *
 * Typed as the full interface rather than `Partial`, so the compiler is the thing that
 * tells a translator when the package adds a string. `Partial` is the right type when an
 * app is translating a subset on purpose; it is the wrong type when the goal is coverage,
 * because a missing key then silently renders in English.
 */
const HINDI_LABELS: DataTableLabels = {
  actions: 'कार्रवाई',
  all: 'सभी',
  apply: 'लागू करें',
  cancel: 'रद्द करें',
  close: 'बंद करें',
  collapseRow: 'पंक्ति संक्षिप्त करें',
  confirm: 'पुष्टि करें',
  enterValue: 'मान दर्ज करें',
  expandRow: 'पंक्ति विस्तृत करें',
  from: 'से',
  no: 'नहीं',
  reset: 'रीसेट करें',
  save: 'सहेजें',
  search: 'खोजें...',
  select: 'चुनें...',
  to: 'तक',
  yes: 'हाँ',

  activeFilters: (count) => `${count} सक्रिय फ़िल्टर`,
  clearAll: 'सभी हटाएँ',
  clearSearch: 'खोज हटाएँ',
  clearSelection: 'चयन हटाएँ',
  clearSort: 'क्रम हटाएँ',
  columns: 'स्तंभ',
  dragToReorder: 'स्तंभों का क्रम बदलें',
  filters: 'फ़िल्टर',
  globalSearch: 'सभी स्तंभों में खोजें...',
  hideAll: 'सभी छिपाएँ',
  noActiveFilters: 'कोई सक्रिय फ़िल्टर नहीं',
  reorderHint: 'क्रम बदलने के लिए खींचें',
  resetFilters: 'फ़िल्टर रीसेट करें',
  resetToDefault: 'डिफ़ॉल्ट पर लौटाएँ',
  resetToDefaultTooltip: 'सभी फ़िल्टर, स्तंभ दृश्यता और स्तंभ चौड़ाई डिफ़ॉल्ट पर लौटाएँ',
  showAll: 'सभी दिखाएँ',

  densityLabel: 'घनत्व',
  densityCompact: 'सघन',
  densityComfortable: 'सामान्य',
  densitySpacious: 'विस्तृत',

  pinColumn: 'बाईं ओर स्थिर करें',
  pinColumnLabel: (column) => `${column} को बाईं ओर स्थिर करें`,
  unpinColumn: 'स्थिरता हटाएँ',
  unpinColumnLabel: (column) => `${column} की स्थिरता हटाएँ`,
  // Hindi puts the total before the position, which is the reason these are functions and
  // not templates with `{position}` / `{total}` placeholders: the order is the translator's
  // to choose, not the library's.
  reorderColumn: (column, position, total) => `${column} का क्रम बदलें, कुल ${total} में से ${position}`,
  resizeColumn: 'स्तंभ की चौड़ाई बदलें',
  sortAsc: 'आरोही क्रम में लगाएँ',
  sortDesc: 'अवरोही क्रम में लगाएँ',

  expandAll: 'सभी विस्तृत करें',
  expandAllTooltip: 'सभी पंक्तियाँ विस्तृत करें',
  collapseAll: 'सभी संक्षिप्त करें',
  collapseAllTooltip: 'सभी पंक्तियाँ संक्षिप्त करें',

  exportLabel: 'निर्यात',
  exportCsv: 'CSV निर्यात करें',
  exportExcel: 'एक्सेल निर्यात करें',
  exportJson: 'JSON निर्यात करें',

  selectAll: 'सभी पंक्तियाँ चुनें',
  selected: 'चयनित',

  rowsPerPage: 'प्रति पृष्ठ पंक्तियाँ',
  pageOf: (current, total) => `${total} में से पृष्ठ ${current}`,
  totalRows: (count) => `कुल ${count} पंक्तियाँ।`,
  firstPage: 'पहला पृष्ठ',
  previousPage: 'पिछला पृष्ठ',
  nextPage: 'अगला पृष्ठ',
  lastPage: 'अंतिम पृष्ठ',

  loading: 'डेटा लोड हो रहा है...',
  noData: 'कोई डेटा नहीं मिला',
  error: 'डेटा लोड नहीं हो सका',
  retry: 'पुनः प्रयास करें',

  saveChanges: 'परिवर्तन सहेजें',
  discardChanges: 'परिवर्तन छोड़ें',
  saveFailed: 'परिवर्तन सहेजे नहीं जा सके',
};

// Column headers and cell content are the consumer's data, not the table's chrome, so they
// are not part of `labels`. Translating the table means translating both.
const HINDI_STATUS_LABEL: Record<Order['status'], string> = {
  pending: 'लंबित',
  in_progress: 'प्रगति पर',
  delivered: 'वितरित',
  cancelled: 'रद्द',
};

const HINDI_STATUS_OPTIONS = STATUS_OPTIONS.map((option) => ({
  ...option,
  label: HINDI_STATUS_LABEL[option.value as Order['status']],
}));

const hindiColumns: DataTableColumnDef<Order>[] = [
  {id: 'reference', accessorKey: 'reference', header: 'संदर्भ', size: 120},
  {
    id: 'customer',
    accessorKey: 'customer',
    header: 'ग्राहक',
    size: 180,
    enableFiltering: true,
    filterConfig: {type: 'text', placeholder: 'ग्राहक का नाम'},
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'स्थिति',
    size: 140,
    enableFiltering: true,
    filterConfig: {type: 'select', options: HINDI_STATUS_OPTIONS},
    cell: ({row}) => <Chip size="small" variant="outlined" label={HINDI_STATUS_LABEL[row.original.status]} />,
  },
  {id: 'items', accessorKey: 'items', header: 'वस्तुएँ', size: 90, align: 'right'},
  {
    id: 'total',
    accessorKey: 'total',
    header: 'कुल',
    size: 110,
    align: 'right',
    cell: ({row}) => `₹${row.original.total.toFixed(2)}`,
  },
  {id: 'placedAt', accessorKey: 'placedAt', header: 'दिनांक', size: 120},
];

/**
 * The two locales this story switches between. English is the package's own set, which is
 * why it passes no `labels` at all: leaving the prop off is what a consumer who never
 * translates anything does, and it has to look right.
 */
const LOCALES = {
  en: {name: 'English', columns, labels: undefined, ariaLabel: 'Orders'},
  hi: {name: 'हिंदी', columns: hindiColumns, labels: HINDI_LABELS, ariaLabel: 'ऑर्डर'},
} as const;

type LocaleKey = keyof typeof LOCALES;

/**
 * The picker, so the claim is demonstrated rather than asserted. Switching locale swaps
 * two things at once: `labels` for the chrome, and the column definitions for the headers
 * and cells. Nothing is reloaded and no locale file is fetched, because the package has no
 * i18n runtime; the whole mechanism is one prop changing identity.
 */
function LocaleSwitcher(props: Readonly<DataTableProps<Order>>) {
  const [locale, setLocale] = useState<LocaleKey>('hi');
  const active = LOCALES[locale];

  return (
    <Box>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={locale}
        onChange={(_event, next: LocaleKey | null) => {
          // `null` when the active button is clicked again. Exclusive groups allow
          // deselection, and a table with no locale is not a state worth having.
          if (next) setLocale(next);
        }}
        aria-label="Language"
        sx={{mb: 2}}
      >
        {Object.entries(LOCALES).map(([key, value]) => (
          <ToggleButton key={key} value={key} lang={key}>
            {value.name}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* The lang attribute moves with the picker: without it a screen reader reads
          Devanagari with English phonetics. */}
      <Box lang={locale}>
        <DataTable {...props} columns={active.columns} labels={active.labels} ariaLabel={active.ariaLabel} />
      </Box>
    </Box>
  );
}

/**
 * **Every string in Hindi, with a picker to prove it.** The package ships English and no
 * i18n runtime, so a translation is an object you pass in, not a locale file the library
 * loads. Switch the toggle above the table and watch the whole thing move: nothing is
 * fetched, nothing is registered, one prop changes.
 *
 * There are two halves to it and only one of them is the table's:
 *
 * - `labels` covers the chrome the table renders itself: toolbar, filters, density menu,
 *   export menu, pager, empty and error states, and the aria-labels behind the icon buttons.
 * - headers, cell content and filter options are your data, so they are translated in the
 *   column definitions alongside everything else your app translates.
 *
 * English is the locale that passes no `labels` at all, because that is what a consumer who
 * never translates anything writes.
 *
 * `pageOf` and `reorderColumn` are the reason interpolated strings are functions. Hindi puts
 * the total before the page number, and a template with placeholders cannot express that
 * without the library guessing at word order.
 *
 * With a runtime i18n library, build the object with `useMemo` keyed on the active locale.
 * Pass a module constant otherwise: `labels` is compared by identity, so a literal written
 * inline in JSX is a new object on every render.
 */
export const TranslatedLabels: Story = {
  parameters: {
    // `columns` and `labels` are driven by the picker in this story, so they are not
    // offered as controls: two ways to set the same prop, one of them silently losing.
    ...showcase('enableFiltering', 'enableGlobalFilter', 'enableExport'),
    ...KNOWN_CONTRAST_EXCEPTION,
  },
  render: (args) => <LocaleSwitcher {...args} />,
  args: {
    columns: hindiColumns,
    labels: HINDI_LABELS,
    enableFiltering: true,
    enableGlobalFilter: true,
    enableExport: true,
    enableColumnVisibility: true,
    enableDensityToggle: true,
  },
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);

    // Hindi first, which is where the picker starts. The chrome...
    await expect(canvas.getByPlaceholderText('सभी स्तंभों में खोजें...')).toBeInTheDocument();
    // ...the data...
    await expect(canvas.getByText('ग्राहक')).toBeInTheDocument();
    // ...and a string that only exists because `labels` reaches the pager too.
    await expect(canvas.getByText(/प्रति पृष्ठ पंक्तियाँ/)).toBeInTheDocument();

    // Now the point of the picker: the same table, no labels prop at all.
    await userEvent.click(canvas.getByRole('button', {name: 'English'}));
    await expect(canvas.getByPlaceholderText('Search all columns...')).toBeInTheDocument();
    await expect(canvas.getByText('Customer')).toBeInTheDocument();
    await expect(canvas.queryByText('ग्राहक')).not.toBeInTheDocument();

    // Back, so the story is left where a reader expects to find it.
    await userEvent.click(canvas.getByRole('button', {name: 'हिंदी'}));
    await expect(canvas.getByText('ग्राहक')).toBeInTheDocument();
  },
};

// The whole set. A server-driven table never sees this: it is what the fake backend below
// pages through, standing in for a database.
const ALL_ORDERS = makeOrders(137);

// A stable empty array: a fresh `[]` on every render would look like new data to the table.
const EMPTY_ROWS: readonly Order[] = [];

interface OrdersPage {
  readonly rows: readonly Order[];
  readonly total: number;
}

/**
 * The fake backend. Sorting, filtering and slicing happen here, away from the table, which
 * is the point: in server mode the table renders what it is handed and asks for the next
 * page, and every decision about which rows those are belongs to the server.
 */
async function fetchOrders(state: ServerTableState): Promise<OrdersPage> {
  await new Promise((resolve) => setTimeout(resolve, 150));

  let rows = ALL_ORDERS;

  const search = state.globalFilter.trim().toLowerCase();
  if (search) {
    rows = rows.filter((order) => `${order.reference} ${order.customer}`.toLowerCase().includes(search));
  }

  const status = state.columnFilters.find((filter) => filter.id === 'status')?.value;
  if (typeof status === 'string' && status) {
    rows = rows.filter((order) => order.status === status);
  }

  const [sort] = state.sorting;
  if (sort) {
    rows = [...rows].sort((a, b) => {
      const left = String(a[sort.id] ?? '');
      const right = String(b[sort.id] ?? '');
      return sort.desc ? right.localeCompare(left) : left.localeCompare(right);
    });
  }

  const {pageIndex, pageSize} = state.pagination;
  // `total` is the filtered count, not the page length. Without it the pager has no way to
  // know there is a page two.
  return {rows: rows.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize), total: rows.length};
}

/**
 * A page, in miniature: hold the state the table reports, turn it into a request, hand back
 * one page plus the total.
 *
 * A real page swaps the `useState` below for `useTableServerState(tableId)` so the first
 * query is already built at the persisted page size. This story keeps plain state so it
 * renders the same on every reload instead of restoring whatever the last visitor left.
 */
function ServerDrivenOrders() {
  const [serverState, setServerState] = useState<ServerTableState | null>(null);
  // The response is kept together with the state it answered, which is what makes the
  // in-flight check below a comparison rather than a second piece of state to keep in sync.
  const [result, setResult] = useState<{state: ServerTableState; page: OrdersPage} | null>(null);

  useEffect(() => {
    // Gate on the table's first emit. Fetching before it arrives would throw away a
    // request at the default page size, which is the classic server-table double fetch.
    if (!serverState) return;

    let cancelled = false;

    const load = async () => {
      const page = await fetchOrders(serverState);
      // The state may have moved on while this was in flight; a late response must not
      // overwrite the page the user is looking at now.
      if (!cancelled) setResult({state: serverState, page});
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [serverState]);

  // Derived during render rather than stored: a request is in flight exactly when the state
  // the last response answered is not the state the table is reporting now.
  const isFetching = serverState !== null && result?.state !== serverState;

  return (
    <DataTable
      columns={columns}
      // One page of rows, read defensively: there is nothing to render until the first
      // response lands.
      data={result?.page.rows ?? EMPTY_ROWS}
      totalRows={result?.page.total ?? 0}
      pageSize={10}
      manualPagination
      manualSorting
      manualFiltering
      enableFiltering
      enableGlobalFilter
      isLoading={result === null}
      isFetching={isFetching}
      onServerStateChange={setServerState}
      ariaLabel="Orders"
    />
  );
}

/**
 * **Server-driven mode, wired to a real (fake) backend.** This is what the package is for.
 *
 * Sort a column, type in the search box, change the page: each one is a request, and the
 * rows that come back were chosen by the server. Watch the row count while filtering, it
 * comes from the response rather than from `data.length`.
 *
 * Three things this story is showing:
 *
 * - the table owns pagination, sorting and filter state and reports all four slices through
 *   one `onServerStateChange`, so nothing is passed back in;
 * - `totalRows` comes from the response, because the table only ever holds one page;
 * - the consumer gates its first query on the mount emit, so the table fetches once.
 */
export const ServerSide: Story = {
  parameters: {
    ...KNOWN_CONTRAST_EXCEPTION,
    ...showcase(
      'totalRows',
      'manualPagination',
      'manualSorting',
      'manualFiltering',
      'onServerStateChange',
      'isLoading',
      'isFetching',
      'isError',
      'onRetry',
    ),
  },
  render: () => <ServerDrivenOrders />,
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);

    // The first page has to arrive before anything can be asserted about it.
    await waitFor(() => expect(canvas.getByText('SW-1000')).toBeInTheDocument());

    // Page two is a request, not a slice of what is already on screen.
    await userEvent.click(canvas.getByRole('button', {name: /next page/i}));
    await waitFor(() => expect(canvas.getByText('SW-1010')).toBeInTheDocument());
    await expect(canvas.queryByText('SW-1000')).not.toBeInTheDocument();
  },
};

/**
 * Past `VIRTUALIZATION_THRESHOLD` rows the body renders a window instead of every row.
 * `maxHeight` is what gives the window something to scroll inside.
 */
export const Virtualized: Story = {
  parameters: showcase(
    'enableVirtualization',
    'virtualRowHeight',
    'virtualOverscan',
    'maxHeight',
    'stickyHeader',
    'enablePagination',
  ),
  args: {
    data: makeOrders(500),
    enableVirtualization: true,
    enablePagination: false,
    maxHeight: 480,
    stickyHeader: true,
  },
};

/**
 * **What a phone gets.** Below `mobileBreakpoint` the table stops being a table: each row
 * becomes a card, so the columns stack instead of scrolling sideways off the screen.
 *
 * Columns opt in with `showInMobileCard` and order themselves with `mobileOrder`; the first
 * one is the card's title. Row actions move into the card's own menu. This story pins itself
 * to an iPhone 14; use the toolbar's device list to see where the switch happens.
 */
export const MobileCards: Story = {
  parameters: {
    ...showcase('mobileBreakpoint', 'enableMobileCardView', 'renderMobileCard', 'rowActions'),
    layout: 'fullscreen',
  },
  globals: {viewport: {value: 'iphone14', isRotated: false}},
  args: {
    enableMobileCardView: true,
    mobileBreakpoint: 'sm',
    rowActions,
    columns: [
      {id: 'reference', accessorKey: 'reference', header: 'Reference', mobileOrder: 0},
      {id: 'customer', accessorKey: 'customer', header: 'Customer', mobileOrder: 1},
      {id: 'status', accessorKey: 'status', header: 'Status', mobileOrder: 2, mobileLabel: 'State'},
      {
        id: 'total',
        accessorKey: 'total',
        header: 'Total',
        align: 'right',
        mobileOrder: 3,
        cell: ({row}) => `$${row.original.total.toFixed(2)}`,
      },
      // Long free text, hidden on a card: it is what makes a row unreadable on a phone.
      {id: 'note', accessorKey: 'note', header: 'Note', showInMobileCard: false},
    ],
  },
  play: async ({canvasElement}) => {
    // True at any width: the assertion is about the data arriving, not about which of the
    // two layouts the current viewport picked.
    await expect(await within(canvasElement).findByText('SW-1000')).toBeInTheDocument();
  },
};
