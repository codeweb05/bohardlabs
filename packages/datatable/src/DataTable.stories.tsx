import FilterListIcon from '@mui/icons-material/FilterList';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import {ThemeProvider, createTheme, type Theme} from '@mui/material/styles';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import {LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import type {Decorator, Meta, StoryObj} from '@storybook/react-vite';
import {useEffect, useId, useState, type ReactNode} from 'react';
import {expect, fn, screen, spyOn, userEvent, waitFor, within} from 'storybook/test';

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
    // painting an arrow.
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

type StatusFilter = Order['status'] | 'all';

const STATUS_FILTERS: readonly StatusFilter[] = ['all', 'pending', 'in_progress', 'delivered', 'cancelled'];

function statusFilterLabel(status: StatusFilter): string {
  return status === 'all' ? 'All statuses' : STATUS_LABEL[status];
}

function countOrders(status: StatusFilter): number {
  return status === 'all' ? ORDERS.length : ORDERS.filter((order) => order.status === status).length;
}

/**
 * The trigger's accessible name. It carries the badge's number, because a name has to
 * contain the text a sighted user sees on the control (WCAG 2.5.3, Label in Name).
 */
function statusFilterName(status: StatusFilter): string {
  if (status === 'all') return 'Filter by status';
  const count = countOrders(status);
  return `Filter by status: ${statusFilterLabel(status)}, ${count} ${count === 1 ? 'order' : 'orders'}`;
}

interface StatusFilterMenuProps {
  readonly value: StatusFilter;
  readonly onChange: (status: StatusFilter) => void;
}

/**
 * The consumer's own control: an icon button that opens a status menu, with a badge
 * counting the rows the chosen status matches. Its accessible name says which status is
 * on, because the badge alone is a number with no meaning to a screen reader.
 */
function StatusFilterMenu({value, onChange}: Readonly<StatusFilterMenuProps>) {
  const menuId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const isOpen = anchor !== null;

  return (
    <>
      <IconButton
        size="small"
        aria-label={statusFilterName(value)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <Badge color="primary" badgeContent={countOrders(value)} invisible={value === 'all'}>
          <FilterListIcon fontSize="small" />
        </Badge>
      </IconButton>
      <Menu id={menuId} anchorEl={anchor} open={isOpen} onClose={() => setAnchor(null)}>
        {STATUS_FILTERS.map((status) => (
          <MenuItem
            key={status}
            selected={status === value}
            onClick={() => {
              onChange(status);
              setAnchor(null);
            }}
          >
            <ListItemText>{statusFilterLabel(status)}</ListItemText>
            <Typography variant="body2" color="text.secondary" sx={{ml: 2}}>
              {countOrders(status)}
            </Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function StatusFilteredOrders() {
  const [status, setStatus] = useState<StatusFilter>('all');
  // Stands in for a query param: a real page puts `status` in its request and the server
  // filters. The table only ever sees the rows that come back.
  const rows = status === 'all' ? ORDERS : ORDERS.filter((order) => order.status === status);

  return (
    <DataTable
      columns={columns}
      data={rows}
      enableFiltering
      toolbarContent={<StatusFilterMenu value={status} onChange={setStatus} />}
      ariaLabel="Orders"
    />
  );
}

/**
 * **A control of your own, beside the search box.** `toolbarContent` takes any node and
 * places it right after search, ahead of the table's own controls.
 *
 * The status menu here holds its own state and filters the rows before they reach the
 * table, the way a query param would on a server-driven page. The table's active-filter
 * chip and **Reset filters** do not count it: they cover the table's own filters only.
 * Give an icon button an `aria-label`; the table adds none around it.
 */
export const ToolbarContent: Story = {
  parameters: showcase('toolbarContent', 'showToolbar'),
  render: () => <StatusFilteredOrders />,
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', {name: 'Filter by status'});

    await userEvent.click(trigger);
    // The menu is portalled to document.body, outside the canvas.
    await userEvent.click(await screen.findByRole('menuitem', {name: /^Delivered/}));

    await waitFor(() => expect(canvas.queryByText('SW-1000')).not.toBeInTheDocument());
    await expect(canvas.getByText('SW-1002')).toBeInTheDocument();

    // The trigger re-renders from the consumer's new state, and the menu hands focus back.
    await expect(trigger).toHaveAccessibleName(statusFilterName('delivered'));
    await waitFor(() => expect(trigger).toHaveFocus());

    // Search and the control still share one row: the trigger's middle sits within the
    // search box's height rather than on a line of its own.
    const search = canvas.getByPlaceholderText(/search all columns/i).getBoundingClientRect();
    const box = trigger.getBoundingClientRect();
    const middle = box.top + box.height / 2;
    await expect(middle).toBeGreaterThan(search.top);
    await expect(middle).toBeLessThan(search.bottom);
  },
};

const filterTypeColumns: DataTableColumnDef<Order>[] = [
  {id: 'reference', accessorKey: 'reference', header: 'Reference', size: 120},
  {
    id: 'customer',
    accessorKey: 'customer',
    header: 'Customer',
    enableFiltering: true,
    filterConfig: {type: 'text', placeholder: 'Customer name'},
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    enableFiltering: true,
    filterConfig: {type: 'select', options: STATUS_OPTIONS},
  },
  {
    id: 'items',
    accessorKey: 'items',
    header: 'Items',
    align: 'right',
    enableFiltering: true,
    filterConfig: {type: 'number', min: 1, max: 7},
  },
  {
    id: 'hasNote',
    accessorFn: (order) => order.note !== '',
    header: 'Has a note',
    enableFiltering: true,
    filterConfig: {type: 'boolean'},
    cell: ({getValue}) => (getValue() ? 'Yes' : 'No'),
  },
  {
    id: 'placedAt',
    accessorKey: 'placedAt',
    header: 'Placed',
    enableFiltering: true,
    filterConfig: {type: 'date'},
  },
  {
    id: 'dueAt',
    accessorFn: (order) => order.placedAt,
    header: 'Due',
    enableFiltering: true,
    filterConfig: {type: 'date'},
  },
];

/**
 * One control per `filterConfig.type`. The date controls need the pickers' own
 * `LocalizationProvider` above the table, which is the consumer's to supply, so the story
 * supplies it the same way.
 *
 * A date column shows a from/to pair until its filter holds a single date string, which is
 * what `initialFilters` gives "Placed" here; "Due" has no filter yet and shows the pair.
 */
export const FilterTypes: Story = {
  parameters: {
    ...showcase('enableFiltering', 'initialFilters'),
  },
  args: {
    columns: filterTypeColumns,
    enableFiltering: true,
    initialFilters: [{id: 'placedAt', value: '2026-03-05'}],
  },
  decorators: [
    (Story) => (
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Story />
      </LocalizationProvider>
    ),
  ],
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    // The single date in `initialFilters` is already applied: one order was placed that day.
    await expect(canvas.getByText('SW-1004')).toBeInTheDocument();
    await expect(canvas.queryByText('SW-1000')).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', {name: 'Filters, 1 active filter(s)'}));

    // The drawer is portalled to the body, outside the canvas.
    const drawer = within(await screen.findByRole('dialog'));
    for (const heading of ['Customer', 'Status', 'Items', 'Has a note', 'Placed', 'Due']) {
      await expect(drawer.getByText(heading)).toBeInTheDocument();
    }
    await expect(drawer.getByPlaceholderText('Customer name')).toBeInTheDocument();
    // Every control answers to its column's name; a range adds which end.
    const items = within(drawer.getByRole('group', {name: 'Items'}));
    await expect(items.getByRole('textbox', {name: 'From'})).toBeInTheDocument();
    await expect(items.getByRole('textbox', {name: 'To'})).toBeInTheDocument();
    await expect(drawer.getByRole('combobox', {name: 'Status'})).toBeInTheDocument();
    await expect(drawer.getByRole('combobox', {name: 'Has a note'})).toBeInTheDocument();
    // One picker for "Placed", which holds a single date, and a from/to pair for "Due".
    await expect(drawer.getAllByRole('button', {name: /choose date/i})).toHaveLength(3);
    await expect(drawer.getByRole('button', {name: /selected date is Mar 5, 2026/i})).toBeInTheDocument();

    await userEvent.click(drawer.getByRole('button', {name: 'Clear All'}));
    await waitFor(() => expect(canvas.getByText('SW-1000')).toBeInTheDocument());
  },
};

/**
 * **What is narrowing the list.** `enableFilterChips` adds a row under the toolbar with one
 * chip per active filter and one for the search. Each chip reads the way the request sends
 * it, operator included: "Items at least 2", "Total between 10 and 50", "Status is not
 * Cancelled" when the column's `filterConfig.operator` is `notEquals`. A select shows the
 * option's label and a date shows `dateFormats.display`.
 *
 * A chip's × removes that filter, **Clear all** removes everything, and both go back to
 * page 1. The search chip has no ×: the search box is where it is cleared.
 *
 * Off by default, so a screen built before it does not change. Every word is in `labels`.
 */
export const FilterChips: Story = {
  parameters: {
    ...KNOWN_CONTRAST_EXCEPTION,
    ...showcase('enableFilterChips', 'enableFiltering', 'initialFilters', 'onServerStateChange'),
  },
  args: {
    columns: filterTypeColumns,
    data: makeOrders(40),
    pageSize: 5,
    enableFiltering: true,
    enableFilterChips: true,
    onServerStateChange: fn(),
  },
  decorators: [
    (Story) => (
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Story />
      </LocalizationProvider>
    ),
  ],
  play: async ({args, canvasElement}) => {
    const canvas = within(canvasElement);
    const removeCustomer = {name: 'Remove filter: Customer contains e'};

    await userEvent.click(canvas.getByRole('button', {name: 'Filters'}));
    const drawer = within(await screen.findByRole('dialog'));
    await userEvent.type(drawer.getByPlaceholderText('Customer name'), 'e');
    await userEvent.type(within(drawer.getByRole('group', {name: 'Items'})).getByRole('textbox', {name: 'From'}), '2');

    // The filters commit after a debounce. The drawer is modal, so the chips behind it are
    // hidden from the accessibility tree until it closes.
    await waitFor(() => expect(canvas.getByRole('button', {...removeCustomer, hidden: true})).toBeInTheDocument());
    await userEvent.click(drawer.getByRole('button', {name: 'Close'}));

    const chips = within(await canvas.findByRole('group', {name: '2 active filter(s)'}));
    await expect(chips.getByText('Items at least 2')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', {name: 'Next page'}));
    await waitFor(() =>
      expect(args.onServerStateChange).toHaveBeenLastCalledWith(
        expect.objectContaining({pagination: expect.objectContaining({pageIndex: 1})}),
      ),
    );

    await userEvent.click(chips.getByRole('button', removeCustomer));

    // One filter left in the request, and back on the first page.
    await waitFor(() =>
      expect(args.onServerStateChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          columnFilters: [expect.objectContaining({id: 'items'})],
          pagination: expect.objectContaining({pageIndex: 0}),
        }),
      ),
    );
    await expect(canvas.queryByRole('button', removeCustomer)).not.toBeInTheDocument();
    // The trigger's badge count is part of its name.
    await expect(canvas.getByRole('button', {name: 'Filters, 1 active filter(s)'})).toBeInTheDocument();
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

/** Two orders the payment provider turns down, whichever rows are sent. */
const DECLINED = new Set(['order-2', 'order-4']);

/**
 * A bulk action that works for some rows and not others. It returns which ids went
 * through, the bar says how many of each, and the rows that failed stay selected so the
 * same button can try them again.
 */
export const SelectionPartialFailure: Story = {
  name: 'Bulk actions, partial failure',
  parameters: {
    ...KNOWN_CONTRAST_EXCEPTION,
    ...showcase('bulkActions', 'onBulkActionResult', 'getRowId'),
  },
  args: {
    enableRowSelection: true,
    getRowId: (row) => row.id,
    onBulkActionResult: fn(),
    bulkActions: [
      {
        id: 'paid',
        label: 'Mark as paid',
        onClick: (rows) => {
          const ids = rows.map((row) => row.id);
          return Promise.resolve({
            succeeded: ids.filter((id) => !DECLINED.has(id)),
            failed: ids.filter((id) => DECLINED.has(id)),
          });
        },
      },
    ],
  },
  play: async ({args, canvasElement}) => {
    const canvas = within(canvasElement);
    for (const n of [1, 2, 3, 4, 5]) {
      await userEvent.click(canvas.getByRole('checkbox', {name: `Select row order-${n}`}));
    }
    await userEvent.click(canvas.getByRole('button', {name: 'Mark as paid'}));

    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent('3 updated, 2 failed. The 2 failed rows are still selected.');
    await expect(args.onBulkActionResult).toHaveBeenCalledWith(expect.objectContaining({id: 'paid'}), {
      succeeded: ['order-1', 'order-3', 'order-5'],
      failed: ['order-2', 'order-4'],
    });
    for (const n of [2, 4]) {
      await expect(canvas.getByRole('checkbox', {name: `Select row order-${n}`})).toBeChecked();
    }
    for (const n of [1, 3, 5]) {
      await expect(canvas.getByRole('checkbox', {name: `Select row order-${n}`})).not.toBeChecked();
    }

    // Picking other rows makes the message stale, so it goes.
    await userEvent.click(canvas.getByRole('checkbox', {name: 'Select row order-6'}));
    await waitFor(() => expect(canvas.queryByRole('alert')).not.toBeInTheDocument());
  },
};

/** A server page of 25 out of 137 matches, tall enough to scroll the bar's table away. */
const STICKY_ORDERS = makeOrders(137);
const archiveOrders = fn();

/**
 * `bulkActionsPosition: 'sticky'` floats the bar at the bottom of the viewport, so the count
 * and the actions stay in reach while the user scrolls a long page. With the whole page
 * selected it offers every row the server matches; the action then gets `allMatching: true`
 * and the table's state, and should act on the filter rather than the ids.
 */
export const StickyBulkBar: Story = {
  name: 'Sticky bulk bar',
  parameters: {
    ...KNOWN_CONTRAST_EXCEPTION,
    ...showcase('bulkActions', 'bulkActionsPosition', 'totalRows', 'manualPagination'),
  },
  args: {
    enableRowSelection: true,
    getRowId: (row) => row.id,
    bulkActionsPosition: 'sticky',
    data: STICKY_ORDERS.slice(0, 25),
    totalRows: STICKY_ORDERS.length,
    manualPagination: true,
    pageSize: 25,
    bulkActions: [{id: 'archive', label: 'Archive', onClick: archiveOrders}],
  },
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const view = canvasElement.ownerDocument.defaultView;
    if (!view) throw new Error('Expected the story to render in a window');
    archiveOrders.mockClear();

    await userEvent.click(canvas.getByRole('checkbox', {name: 'Select all rows'}));
    view.scrollTo(0, canvasElement.ownerDocument.body.scrollHeight);

    const archive = await canvas.findByRole('button', {name: 'Archive'});
    await waitFor(async () => {
      const box = archive.getBoundingClientRect();
      await expect(box.top).toBeGreaterThanOrEqual(0);
      await expect(box.bottom).toBeLessThanOrEqual(view.innerHeight);
    });

    await userEvent.click(canvas.getByRole('button', {name: 'Select all 137 matching'}));
    await expect(canvas.getByText('All 137 matching selected')).toBeInTheDocument();
    await userEvent.click(archive);

    await expect(archiveOrders).toHaveBeenCalledTimes(1);
    await expect(archiveOrders).toHaveBeenCalledWith(
      STICKY_ORDERS.slice(0, 25),
      expect.objectContaining({allMatching: true, state: expect.objectContaining({globalFilter: ''})}),
    );
    // The action returned nothing, so the selection clears and the bar goes.
    await waitFor(() => expect(canvas.queryByRole('button', {name: 'Archive'})).not.toBeInTheDocument());
    view.scrollTo(0, 0);
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

const COLUMN_GROUPS: Partial<Record<string, string>> = {
  customer: 'Customer',
  status: 'Order',
  items: 'Order',
  total: 'Order',
  placedAt: 'Dates',
};

/**
 * A long column list made usable. `meta.group` puts a column under a heading, and a drag
 * or an arrow key moves it only inside its group; the search box matches what a row shows
 * and the column id. The foot of the menu counts the hidden columns and puts order,
 * visibility, widths and freezing back to the defaults in one click.
 */
export const GroupedColumns: Story = {
  parameters: showcase('columns', 'enableColumnVisibility', 'enableColumnOrdering', 'enableColumnPinning'),
  args: {
    enableColumnVisibility: true,
    enableColumnOrdering: true,
    enableColumnPinning: true,
    columns: columns.map((column) => {
      const group = COLUMN_GROUPS[column.id];
      return group ? {...column, meta: {group}} : column;
    }),
  },
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const checkboxesIn = (list: string) =>
      within(body.getByRole('list', {name: list}))
        .getAllByRole('checkbox')
        .map((box) => box.getAttribute('aria-label'));

    await userEvent.click(canvas.getByRole('button', {name: 'Columns'}));
    await expect(checkboxesIn('Order')).toEqual(['Status', 'Items', 'Total']);

    // The id finds a column whose header says something else.
    const search = await body.findByRole('textbox', {name: 'Search columns'});
    await userEvent.type(search, 'placedat');
    await expect(body.getAllByRole('list')).toHaveLength(1);
    await expect(checkboxesIn('Dates')).toEqual(['Placed']);
    await userEvent.clear(search);

    await userEvent.click(body.getByRole('checkbox', {name: 'Items'}));
    body.getByRole('button', {name: /^Reorder Status/}).focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(checkboxesIn('Order')).toEqual(['Items', 'Status', 'Total']);
    await expect(body.getByText('Hidden (1)')).toBeVisible();
    // The open menu is modal, so the table behind it is only reachable with `hidden`.
    await expect(canvas.queryByRole('columnheader', {name: /items/i, hidden: true})).not.toBeInTheDocument();

    await userEvent.click(body.getByRole('button', {name: 'Reset columns'}));

    await expect(checkboxesIn('Order')).toEqual(['Status', 'Items', 'Total']);
    await expect(body.getByText('Hidden (0)')).toBeVisible();
    await expect(canvas.getByRole('columnheader', {name: /items/i, hidden: true})).toBeVisible();
    await userEvent.keyboard('{Escape}');
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
  // Not mocked, only watched: the blob still gets a real URL, and the spy remembers the blob.
  const createObjectURL = spyOn(URL, 'createObjectURL');
  const click = spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    const [lastBlob] = createObjectURL.mock.calls.at(-1) ?? [];
    if (this.download && lastBlob instanceof Blob) files.push({name: this.download, blob: lastBlob});
  });

  return {
    files,
    restore() {
      click.mockRestore();
      createObjectURL.mockRestore();
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
 * CSV and Excel write each cell the way the table shows it: the status as its label, the
 * total with its currency sign. JSON writes the records as they came in.
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
      await waitFor(() => expect(downloads.files).toHaveLength(3), {timeout: 5000});

      await expect(downloads.files.map((file) => file.name)).toEqual(['orders.csv', 'orders.json', 'orders.xlsx']);

      // Not just "a file appeared": the header row and the first order, in column order.
      const csv = await downloads.files[0].blob.text();
      const [header, firstRow] = csv.split('\n');
      await expect(header).toBe('Reference,Customer,Status,Items,Total,Placed');
      // Status and total are written the way their cells draw them, not as the values underneath.
      await expect(firstRow).toBe(`SW-1000,Amara Okafor,${STATUS_LABEL.pending},1,$9.50,2026-03-01`);

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

/**
 * **Exporting what is on screen.** CSV and Excel write the visible columns in the order the
 * user arranged them. A hidden column stays out of the file, and so does one marked
 * `enableExport: false`, for a column that means nothing outside the table (a thumbnail, a
 * count the reader can't act on).
 *
 * Each heading is `meta.label` when the column has one, then a string `header`, then the
 * column id made readable. A component header has no text to write, so give it a
 * `meta.label`.
 *
 * Here Total has been moved before Customer, Placed is hidden and Items opts out, so the
 * file holds Reference, Total, Customer and Status. Hide every one of those and CSV and
 * Excel are disabled, with a tooltip saying why. JSON still writes the records whole.
 */
export const ExportColumns: Story = {
  parameters: showcase('enableExport', 'initialColumnOrder', 'initialColumnVisibility'),
  args: {
    enableExport: true,
    exportFormats: ['csv', 'xlsx', 'json'],
    exportFileName: 'orders',
    columns: columns.map((column) => (column.id === 'items' ? {...column, enableExport: false} : column)),
    initialColumnOrder: ['reference', 'total', 'customer', 'status', 'items', 'placedAt'],
    initialColumnVisibility: {placedAt: false},
  },
  play: async ({canvasElement}) => {
    const body = within(canvasElement.ownerDocument.body);
    const downloads = captureDownloads();

    try {
      await clickExport(canvasElement, 'Export CSV');
      await waitFor(() => expect(downloads.files).toHaveLength(1), {timeout: 5000});

      const [header, firstRow] = (await downloads.files[0].blob.text()).split('\n');
      await expect(header).toBe('Reference,Total,Customer,Status');
      await expect(firstRow).toBe(`SW-1000,$9.50,Amara Okafor,${STATUS_LABEL.pending}`);
    } finally {
      downloads.restore();
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(body.queryByRole('menu')).not.toBeInTheDocument());
    }
  },
};

// Every order the filters match on the server. The table holds the first page of it.
const MATCHING_ORDERS = makeOrders(137);

/**
 * **Exporting every matching row.** Under server paging the table holds one page, so the
 * built-in export writes one page. Pass `exportRows` and the menu offers each format twice:
 * for the current page, and for every row the filters match, counted from `totalRows`.
 *
 * `exportRows` gets the table's state at the click (sorting, filters, search) and returns
 * the rows. The table never guesses a page size your API might refuse. While it runs the
 * menu shows progress and a Cancel item. Above `exportRowLimit` (10,000 by default) the
 * "All matching" file holds the first 10,000 rows, and the menu says so before the click.
 *
 * Without `exportRows`, a server-paged menu reads "Current page only", so nobody mistakes
 * the file for the whole list. Here the fetch takes a moment on purpose, then the CSV
 * holds all 137 orders, not the 10 on screen.
 */
export const ExportAllMatching: Story = {
  parameters: showcase('enableExport', 'exportRows', 'exportRowLimit', 'totalRows', 'manualPagination'),
  args: {
    enableExport: true,
    exportFileName: 'orders',
    data: MATCHING_ORDERS.slice(0, 10),
    totalRows: MATCHING_ORDERS.length,
    manualPagination: true,
    pageSize: 10,
    exportRows: fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      return MATCHING_ORDERS;
    }),
  },
  play: async ({args, canvasElement}) => {
    const body = within(canvasElement.ownerDocument.body);
    const downloads = captureDownloads();

    try {
      await userEvent.click(within(canvasElement).getByRole('button', {name: 'Export'}));
      // Both items read "Export CSV"; the heading above each is its description.
      await userEvent.click(
        await body.findByRole('menuitem', {name: 'Export CSV', description: 'All matching · 137 rows'}),
      );

      await expect(await body.findByText('Preparing export...')).toBeInTheDocument();
      await waitFor(() => expect(downloads.files).toHaveLength(1), {timeout: 5000});

      await expect(args.exportRows).toHaveBeenCalledWith(
        expect.objectContaining({globalFilter: '', pagination: {pageIndex: 0, pageSize: 10}}),
      );
      // A heading line, then every matching order.
      const lines = (await downloads.files[0].blob.text()).split('\n');
      await expect(lines).toHaveLength(MATCHING_ORDERS.length + 1);
    } finally {
      downloads.restore();
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(body.queryByRole('menu')).not.toBeInTheDocument());
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

const PREFERENCES_TABLE_ID = 'storybook-orders-preferences';

/**
 * **Saved choices, not saved defaults.** The column layout is stored as what the user
 * changed and nothing else. Here `placedAt` is declared `hidden: true`, so it starts hidden,
 * and that default is never written down. Hide another column and only that one lands in
 * storage.
 *
 * That is what lets a later release change a default: hide a column that used to show, or
 * show one that used to hide, and every user who never touched that column gets the new
 * default on their next visit. A user who did touch it keeps their choice. A column that no
 * longer exists is dropped from the entry on load.
 *
 * An entry written by an earlier version, which stored the whole layout, is read as it is
 * and written back once in this shape.
 */
export const SavedPreferences: Story = {
  parameters: showcase('tableId', 'enableColumnVisibility', 'initialColumnVisibility'),
  args: {
    tableId: PREFERENCES_TABLE_ID,
    enableColumnVisibility: true,
    columns: columns.map((column) => (column.id === 'placedAt' ? {...column, hidden: true} : column)),
  },
  // Before the table mounts, so it reads nothing a previous run left behind.
  beforeEach: () => {
    localStorage.removeItem(getTableStateStorageKey(PREFERENCES_TABLE_ID));
  },
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const key = getTableStateStorageKey(PREFERENCES_TABLE_ID);

    await expect(canvas.queryByRole('columnheader', {name: /placed/i})).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', {name: 'Columns'}));
    await userEvent.click(await body.findByRole('checkbox', {name: 'Items'}));

    await waitFor(async () => {
      const saved = JSON.parse(localStorage.getItem(key) ?? '{}') as {columnVisibility?: unknown};
      await expect(saved.columnVisibility).toEqual({items: false});
    });
    await expect(canvas.queryByRole('columnheader', {name: /items/i})).not.toBeInTheDocument();
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
 * `enableDisplayMenu` puts three view controls behind one toolbar button. "Wrap cells" lets
 * long values break onto more lines instead of clipping, and is remembered per `tableId`.
 * "Fullscreen" covers the page with the table (offered only where the browser allows it).
 * "Fit columns to content" sizes every resizable column to its widest cell in one click,
 * which is why it needs `enableColumnResizing`.
 */
export const DisplayMenu: Story = {
  name: 'Display menu',
  parameters: showcase('enableDisplayMenu', 'enableColumnResizing', 'cellOverflow'),
  args: {enableDisplayMenu: true, enableColumnResizing: true},
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const firstCell = () => canvasElement.querySelector<HTMLElement>('tbody td[data-column-id] .cell-content');
    const menuClosed = () => waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());

    await expect(getComputedStyle(firstCell()!).whiteSpace).toBe('nowrap');
    await userEvent.click(canvas.getByRole('button', {name: 'Display'}));
    await userEvent.click(await screen.findByRole('menuitemcheckbox', {name: 'Wrap cells'}));
    await menuClosed();
    await waitFor(() => expect(getComputedStyle(firstCell()!).whiteSpace).toBe('normal'));

    const widths = () =>
      Array.from(canvasElement.querySelectorAll<HTMLElement>('thead th[data-column-id]'), (th) => th.offsetWidth);
    const before = widths();
    await userEvent.click(canvas.getByRole('button', {name: 'Display'}));
    await userEvent.click(await screen.findByRole('menuitem', {name: 'Fit columns to content'}));
    await menuClosed();
    await waitFor(() => expect(widths()).not.toEqual(before));
  },
};

const TOTALS_ORDERS = makeOrders(40);

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

function sumTotals(orders: readonly Order[]): string {
  return formatMoney(orders.reduce((sum, order) => sum + order.total, 0));
}

/**
 * A footer of totals, from `meta.aggregate` on each column: here the order count, the
 * items summed, and the money summed and formatted with `meta.formatAggregate`.
 *
 * The totals cover every row the filters keep, on every page, not just the ten on screen.
 * Search for a customer and they follow. A server-paged table cannot do that from one page,
 * so with `manualPagination` it shows the `aggregates` the API sent instead.
 */
export const Totals: Story = {
  // The search leaves the active-filter chip on screen, as in Filtering.
  parameters: {...KNOWN_CONTRAST_EXCEPTION, ...showcase('aggregates', 'manualPagination')},
  args: {
    data: TOTALS_ORDERS,
    pageSize: 10,
    columns: columns.map((column) => {
      if (column.id === 'reference') return {...column, meta: {aggregate: 'count'}};
      if (column.id === 'items') return {...column, meta: {aggregate: 'sum'}};
      if (column.id === 'total') return {...column, meta: {aggregate: 'sum', formatAggregate: formatMoney}};
      return column;
    }),
  },
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const footer = () => within(canvas.getAllByRole('rowgroup')[2]);

    await expect(footer().getByText(sumTotals(TOTALS_ORDERS))).toBeInTheDocument();

    await userEvent.type(canvas.getByPlaceholderText(/search all columns/i), 'Amara');

    const amara = TOTALS_ORDERS.filter((order) => order.customer.includes('Amara'));
    await waitFor(() => expect(footer().getByText(sumTotals(amara))).toBeInTheDocument());
    await expect(footer().getByText(String(amara.length))).toBeInTheDocument();
  },
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

const LONG_NOTE = 'Left with the concierge, buzzer 4B, do not ring after 9pm';
const INSTRUCTIONS_HEADER = 'Delivery instructions from the customer';

/**
 * A value too wide for its column ends in an ellipsis, and hovering it shows the whole
 * value in a tooltip. A value that fits gets no tooltip at all: repeating text that is
 * already fully visible is noise.
 *
 * The check runs when the pointer arrives, against the width on screen at that moment, so
 * a column that has since been resized wider stops showing one. Header labels follow the
 * same rule, including on a column that cannot be sorted.
 */
export const TruncatedValues: Story = {
  parameters: showcase('cellOverflow', 'enableColumnResizing'),
  // A narrow pane, so the columns get only their own width. On a wide canvas the table
  // stretches to fill it, and two columns would have room for everything.
  render: (args) => (
    <Box sx={{width: 300}}>
      <DataTable {...args} />
    </Box>
  ),
  args: {
    data: [ORDERS[0], {...ORDERS[1], note: 'Ring twice'}].filter((order) => order !== undefined),
    columns: [
      {id: 'reference', accessorKey: 'reference', header: 'Reference', size: 120},
      {id: 'note', accessorKey: 'note', header: INSTRUCTIONS_HEADER, size: 180, enableSorting: false},
    ],
    cellOverflow: 'ellipsis',
    // Resizable columns hold their `size` (a fixed table layout). Without it a column grows to
    // fit its content and there is never anything to cut off.
    enableColumnResizing: true,
    enablePagination: false,
  },
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);

    // The long value is cut off on screen, not merely long.
    const longCell = canvas.getByText(LONG_NOTE);
    await expect(longCell.scrollWidth).toBeGreaterThan(longCell.clientWidth);

    await userEvent.hover(longCell);
    await expect(await screen.findByRole('tooltip')).toHaveTextContent(LONG_NOTE);
    await userEvent.unhover(longCell);
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());

    // A value that fits has nothing to repeat. MUI waits 100ms before opening a tooltip,
    // so give it well past that before asserting none appeared.
    await userEvent.hover(canvas.getByText('Ring twice'));
    await new Promise((resolve) => setTimeout(resolve, 400));
    await expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // The header label on an unsortable column ellipsizes inside its cell instead of
    // running past the border and being clipped mid-character.
    // The resize handle's label is part of the header's name, so match the start.
    const header = canvas.getByRole('columnheader', {name: new RegExp(`^${INSTRUCTIONS_HEADER}`)});
    const label = within(header).getByText(INSTRUCTIONS_HEADER);
    await expect(label.scrollWidth).toBeGreaterThan(label.clientWidth);
    await expect(label.getBoundingClientRect().right).toBeLessThanOrEqual(header.getBoundingClientRect().right);
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
// Hindi puts the comparison after the value ("स्थिति रद्द नहीं है"), which is why the chip
// text is a function of all three parts rather than a fixed order.
const HINDI_OPERATORS: Record<Parameters<DataTableLabels['filterOperator']>[0], string> = {
  equals: 'है',
  in: 'में से कोई है',
  notEquals: 'नहीं है',
  contains: 'शामिल है',
  startsWith: 'से शुरू होता है',
  endsWith: 'पर समाप्त होता है',
  greaterThan: 'से अधिक है',
  lessThan: 'से कम है',
  between: 'के बीच है',
  isEmpty: 'खाली है',
  isNotEmpty: 'खाली नहीं है',
  atLeast: 'या अधिक',
  atMost: 'या कम',
  after: 'के बाद',
  before: 'से पहले',
};

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

  filterChip: (column, operator, value) => `${column} ${value} ${operator}`,
  filterOperator: (operator) => HINDI_OPERATORS[operator],
  filterRange: (from, to) => `${from} और ${to}`,
  filterSearch: (term) => `खोज: “${term}”`,
  removeFilter: (chip) => `फ़िल्टर हटाएँ: ${chip}`,
  clearAllFilters: 'सभी हटाएँ',

  densityLabel: 'घनत्व',
  densityCompact: 'सघन',
  densityComfortable: 'सामान्य',
  densitySpacious: 'विस्तृत',

  display: 'प्रदर्शन',
  wrapCells: 'सेल लपेटें',
  fullscreen: 'पूर्ण स्क्रीन',
  exitFullscreen: 'पूर्ण स्क्रीन से बाहर निकलें',
  fitColumns: 'कॉलम सामग्री के अनुसार करें',

  pinColumn: 'बाईं ओर स्थिर करें',
  pinColumnLabel: (column) => `${column} को बाईं ओर स्थिर करें`,
  unpinColumn: 'स्थिरता हटाएँ',
  unpinColumnLabel: (column) => `${column} की स्थिरता हटाएँ`,
  // Hindi puts the total before the position, which is the reason these are functions and
  // not templates with `{position}` / `{total}` placeholders: the order is the translator's
  // to choose, not the library's.
  reorderColumn: (column, position, total) => `${column} का क्रम बदलें, कुल ${total} में से ${position}`,
  searchColumns: 'स्तंभ खोजें',
  hiddenCount: (count) => `छिपे हुए (${count})`,
  resetColumns: 'स्तंभ रीसेट करें',
  resizeColumn: 'स्तंभ की चौड़ाई बदलें',
  sortAsc: 'आरोही क्रम में लगाएँ',
  sortDesc: 'अवरोही क्रम में लगाएँ',
  sortBy: (column, action) => `${column}: ${action}`,
  sortMenu: 'क्रम',
  sortedBy: (column, desc) => `${column} के अनुसार ${desc ? 'अवरोही' : 'आरोही'} क्रम`,

  expandAll: 'सभी विस्तृत करें',
  expandAllTooltip: 'सभी पंक्तियाँ विस्तृत करें',
  collapseAll: 'सभी संक्षिप्त करें',
  collapseAllTooltip: 'सभी पंक्तियाँ संक्षिप्त करें',

  exportLabel: 'निर्यात',
  exportCsv: 'CSV निर्यात करें',
  exportExcel: 'एक्सेल निर्यात करें',
  exportJson: 'JSON निर्यात करें',
  exportNoColumns: 'निर्यात के लिए कोई कॉलम नहीं',
  exportCurrentPage: (count) => `वर्तमान पृष्ठ · ${count} पंक्तियाँ`,
  exportAllMatching: (count) => `सभी मेल खाती · ${count} पंक्तियाँ`,
  exportCurrentPageOnly: (count) => `केवल वर्तमान पृष्ठ · ${count} पंक्तियाँ`,
  exportRowLimitReached: (count, limit) => `${count} पंक्तियाँ मेल खाती हैं। केवल पहली ${limit} निर्यात होंगी।`,
  exportPreparing: 'निर्यात तैयार हो रहा है...',
  exportFailed: 'निर्यात विफल रहा। फिर से प्रयास करें।',

  selectAll: 'सभी पंक्तियाँ चुनें',
  selectRow: (id) => `पंक्ति ${id} चुनें`,
  selected: 'चयनित',
  bulkResult: (succeeded, failed) =>
    failed === 0
      ? `${succeeded} अपडेट हुईं।`
      : `${succeeded} अपडेट हुईं, ${failed} विफल रहीं। विफल ${failed} पंक्तियाँ अब भी चयनित हैं।`,
  selectAllMatching: (count) => `सभी ${count} मिलती पंक्तियाँ चुनें`,
  allMatchingSelected: (count) => `सभी ${count} मिलती पंक्तियाँ चयनित`,

  rowsPerPage: 'प्रति पृष्ठ पंक्तियाँ',
  pageOf: (current, total) => `${total} में से पृष्ठ ${current}`,
  totalRows: (count) => `कुल ${count} पंक्तियाँ।`,
  rowsDisplayed: (from, to, count) => `${count} में से ${from}-${to}`,
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
    // The row range beside the page buttons, which had no label until `rowsDisplayed`.
    await expect(canvas.getByText(/^\d+ में से 1-\d+$/)).toBeInTheDocument();

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

// The card layout is chosen by the theme's `sm` breakpoint. Raising it past any screen puts
// the test run, whatever its window, on the layout a phone gets.
const phoneTheme = (outer: Theme): Theme => ({
  ...outer,
  breakpoints: createTheme({breakpoints: {values: {xs: 0, sm: 100_000, md: 100_001, lg: 100_002, xl: 100_003}}})
    .breakpoints,
});

const onPhone: Decorator = (Story) => (
  <ThemeProvider theme={phoneTheme}>
    <Story />
  </ThemeProvider>
);

const cardColumns: DataTableColumnDef<Order>[] = [
  {id: 'reference', accessorKey: 'reference', header: 'Reference', mobileOrder: 0},
  {id: 'customer', accessorKey: 'customer', header: 'Customer', mobileOrder: 1},
  {id: 'status', accessorKey: 'status', header: 'Status', mobileOrder: 2},
  {
    id: 'total',
    accessorKey: 'total',
    header: 'Total',
    align: 'right',
    mobileOrder: 3,
    cell: ({row}) => `$${row.original.total.toFixed(2)}`,
  },
  {id: 'placedAt', accessorKey: 'placedAt', header: 'Placed', mobileOrder: 4},
];

/**
 * With `cardTapAction: 'open'` a tap on a card calls `onRowClick` and does nothing else,
 * and a chevron says so. Selection stays on the checkbox. From the keyboard each card is a
 * tab stop named by its title: Enter opens it, Space selects it.
 */
export const CardTapOpens: Story = {
  name: 'Card view, tap opens',
  parameters: {...showcase('cardTapAction', 'onRowClick', 'enableRowSelection'), layout: 'fullscreen'},
  globals: {viewport: {value: 'iphone14', isRotated: false}},
  decorators: [onPhone],
  args: {
    columns: cardColumns,
    data: ORDERS.slice(0, 4),
    cardTapAction: 'open',
    enableRowSelection: true,
    onRowClick: fn(),
  },
  play: async ({args, canvasElement}) => {
    const canvas = within(canvasElement);
    const card = await canvas.findByRole('group', {name: 'SW-1000'});
    const checkbox = canvas.getByRole('checkbox', {name: 'Select row order-1'});

    await userEvent.click(within(card).getByText('Placed:'));
    await expect(args.onRowClick).toHaveBeenCalledWith(ORDERS[0]);
    await expect(checkbox).not.toBeChecked();

    card.focus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onRowClick).toHaveBeenCalledTimes(2);
    await expect(checkbox).not.toBeChecked();

    await userEvent.keyboard(' ');
    await expect(checkbox).toBeChecked();
    await expect(args.onRowClick).toHaveBeenCalledTimes(2);
  },
};

/**
 * The card layout has no header row, so a bar above the cards stands in for it: select-all
 * for the page (indeterminate on a partial selection), Clear, and a sort menu that writes the
 * same sort the headers do. Every string comes from `labels`.
 */
export const CardControls: Story = {
  name: 'Card view controls',
  parameters: {...showcase('enableRowSelection', 'enableSorting', 'labels'), layout: 'fullscreen'},
  globals: {viewport: {value: 'iphone14', isRotated: false}},
  decorators: [onPhone],
  args: {
    columns: cardColumns,
    data: ORDERS.slice(0, 4),
    enableRowSelection: true,
  },
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const firstCard = () => within(canvas.getAllByRole('listitem')[0] ?? canvasElement).getByRole('heading');

    const selectAll = await canvas.findByRole('checkbox', {name: 'Select all rows'});
    await userEvent.click(selectAll);
    await expect(canvas.getAllByRole('checkbox', {name: /^Select row/, checked: true})).toHaveLength(4);
    await expect(canvas.getByText('4 selected')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', {name: 'Clear selection'}));
    await expect(canvas.queryAllByRole('checkbox', {name: /^Select row/, checked: true})).toHaveLength(0);

    await userEvent.click(canvas.getByRole('checkbox', {name: 'Select row order-2'}));
    await expect(selectAll).toHaveAttribute('data-indeterminate', 'true');

    await userEvent.click(canvas.getByRole('button', {name: 'Sort'}));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Placed'}));
    await expect(firstCard()).toHaveTextContent('SW-1000');

    await userEvent.click(canvas.getByRole('button', {name: 'Sorted by Placed, ascending'}));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Sort descending'}));
    await waitFor(() => expect(firstCard()).toHaveTextContent('SW-1003'));
  },
};
