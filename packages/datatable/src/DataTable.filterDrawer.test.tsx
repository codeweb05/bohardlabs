import {LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {DataTable} from './DataTable';
import {DEFAULT_LABELS as L} from './i18n';
import {render} from './test/test-utils';
import type {DataTableColumnDef, ServerTableState} from './types';

interface Order {
  readonly id: string;
  readonly customer: string;
  readonly status: string;
  readonly total: number;
  readonly paid: boolean;
  readonly [key: string]: unknown;
}

const orders: Order[] = Array.from({length: 30}, (_unused, index) => ({
  id: `order-${index + 1}`,
  customer: `Customer ${index + 1}`,
  status: index % 2 === 0 ? 'OPEN' : 'REOPENED',
  total: index + 1,
  paid: index % 3 === 0,
}));

const columns: DataTableColumnDef<Order>[] = [
  {id: 'customer', accessorKey: 'customer', header: 'Customer'},
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    filterConfig: {
      type: 'select',
      options: [
        {value: 'OPEN', label: 'Open'},
        {value: 'REOPENED', label: 'Reopened'},
      ],
    },
  },
  {id: 'total', accessorKey: 'total', header: 'Total', filterConfig: {type: 'number'}},
  {id: 'paid', accessorKey: 'paid', header: 'Paid', filterConfig: {type: 'boolean'}},
];

/** Longer than the 500 ms the filters wait before committing. */
const PAST_THE_DEBOUNCE = 700;

async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', {name: L.filters}));
  return screen.findByRole('dialog');
}

function lastState(onServerStateChange: ReturnType<typeof vi.fn<(state: ServerTableState) => void>>) {
  const state = onServerStateChange.mock.lastCall?.[0];
  if (!state) throw new Error('Expected the table to have reported its state');
  return state;
}

describe('the filter drawer', () => {
  it('leaves the page alone when it is only opened', async () => {
    const user = userEvent.setup();
    const onServerStateChange = vi.fn<(state: ServerTableState) => void>();
    render(<DataTable columns={columns} data={orders} pageSize={10} onServerStateChange={onServerStateChange} />);
    await user.click(screen.getByRole('button', {name: L.nextPage}));
    expect(screen.getByText(L.pageOf(2, 3))).toBeInTheDocument();
    onServerStateChange.mockClear();

    await openFilters(user);
    await act(() => new Promise((resolve) => setTimeout(resolve, PAST_THE_DEBOUNCE)));

    expect(onServerStateChange).not.toHaveBeenCalled();
    expect(screen.getByText(L.pageOf(2, 3))).toBeInTheDocument();
  });

  it('keeps a choice made just before it is closed', async () => {
    const user = userEvent.setup();
    const onServerStateChange = vi.fn<(state: ServerTableState) => void>();
    render(<DataTable columns={columns} data={orders} manualFiltering onServerStateChange={onServerStateChange} />);
    const drawer = await openFilters(user);

    await user.click(within(drawer).getByRole('combobox', {name: 'Status'}));
    await user.click(await screen.findByRole('option', {name: 'Reopened'}));
    await user.click(within(drawer).getByRole('button', {name: L.close}));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() =>
      expect(lastState(onServerStateChange).columnFilters).toEqual([{id: 'status', value: 'REOPENED'}]),
    );
  });

  it('keeps text typed just before it is closed', async () => {
    const user = userEvent.setup();
    const onServerStateChange = vi.fn<(state: ServerTableState) => void>();
    render(<DataTable columns={columns} data={orders} manualFiltering onServerStateChange={onServerStateChange} />);
    const drawer = await openFilters(user);

    await user.type(within(drawer).getByRole('textbox', {name: 'Customer'}), 'ann');
    await user.click(within(drawer).getByRole('button', {name: L.close}));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(lastState(onServerStateChange).columnFilters).toEqual([{id: 'customer', value: 'ann'}]));
  });

  it('keeps a yes or no chosen just before it is closed', async () => {
    const user = userEvent.setup();
    const onServerStateChange = vi.fn<(state: ServerTableState) => void>();
    render(<DataTable columns={columns} data={orders} manualFiltering onServerStateChange={onServerStateChange} />);
    const drawer = await openFilters(user);

    await user.click(within(drawer).getByRole('combobox', {name: 'Paid'}));
    await user.click(await screen.findByRole('option', {name: L.yes}));
    await user.click(within(drawer).getByRole('button', {name: L.close}));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(lastState(onServerStateChange).columnFilters).toEqual([{id: 'paid', value: true}]));
  });

  it('is named, and names every control in it after its column', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={orders} initialFilters={[{id: 'status', value: 'OPEN'}]} />);

    const drawer = await openFilters(user);

    expect(drawer).toHaveAccessibleName(L.filters);
    expect(within(drawer).getByRole('textbox', {name: 'Customer'})).toBeInTheDocument();
    expect(within(drawer).getByRole('combobox', {name: 'Status'})).toBeInTheDocument();
    expect(within(drawer).getByRole('combobox', {name: 'Paid'})).toBeInTheDocument();
    expect(within(drawer).getByRole('group', {name: 'Total'})).toBeInTheDocument();
    expect(within(drawer).getByRole('textbox', {name: L.from})).toBeInTheDocument();
    expect(within(drawer).getByRole('textbox', {name: L.to})).toBeInTheDocument();
    for (const button of within(drawer).getAllByRole('button')) {
      expect(button).toHaveAccessibleName();
    }
  });

  it('filters a select column by the whole value, not by what the value contains', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={orders} pageSize={50} pageSizeOptions={[50]} />);
    const drawer = await openFilters(user);

    await user.click(within(drawer).getByRole('combobox', {name: 'Status'}));
    await user.click(await screen.findByRole('option', {name: 'Open'}));

    // Fifteen of thirty are OPEN; the other fifteen are REOPENED, which contains "open".
    expect(await screen.findByText(L.totalRows(15))).toBeInTheDocument();
  });

  it('does not lose a digit typed while the last one is being committed', async () => {
    vi.useFakeTimers();
    try {
      render(<DataTable columns={columns} data={orders} manualFiltering />);
      fireEvent.click(screen.getByRole('button', {name: L.filters}));
      const from = within(screen.getByRole('dialog')).getByRole('textbox', {name: L.from});

      fireEvent.change(from, {target: {value: '1'}});
      // Queued behind the commit, so both land before the table has rendered the first.
      setTimeout(() => fireEvent.change(from, {target: {value: '12'}}), 500);
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(from).toHaveValue('12');
    } finally {
      vi.useRealTimers();
    }
  });
});

interface Shipment {
  readonly id: string;
  readonly sent: string | null;
  readonly priority: number;
  readonly [key: string]: unknown;
}

// Ten dated the 1st to the 10th of January, then one with no date and one unreadable.
const shipments: Shipment[] = [
  ...Array.from({length: 10}, (_unused, index) => ({
    id: `shipment-${index + 1}`,
    sent: `2026-01-${String(index + 1).padStart(2, '0')}T09:30:00`,
    priority: (index % 3) + 1,
  })),
  {id: 'shipment-11', sent: null, priority: 1},
  {id: 'shipment-12', sent: 'pending', priority: 1},
];

const shipmentColumns: DataTableColumnDef<Shipment>[] = [
  {id: 'id', accessorKey: 'id', header: 'Shipment'},
  {id: 'sent', accessorKey: 'sent', header: 'Sent', filterConfig: {type: 'date'}},
  {
    id: 'priority',
    accessorKey: 'priority',
    header: 'Priority',
    filterConfig: {
      type: 'select',
      options: [
        {value: 1, label: 'Low'},
        {value: 2, label: 'Normal'},
        {value: 3, label: 'High'},
      ],
    },
  },
];

describe('filtering rows the table already holds', () => {
  it('keeps the rows inside a date range, both ends included', () => {
    render(
      <DataTable
        columns={shipmentColumns}
        data={shipments}
        initialFilters={[{id: 'sent', value: {from: '2026-01-03', to: '2026-01-05'}}]}
      />,
    );

    expect(screen.getByText(L.totalRows(3))).toBeInTheDocument();
  });

  it('keeps the rows from a date on, and the rows up to one', () => {
    const view = render(
      <DataTable
        columns={shipmentColumns}
        data={shipments}
        initialFilters={[{id: 'sent', value: {from: '2026-01-08'}}]}
      />,
    );
    expect(screen.getByText(L.totalRows(3))).toBeInTheDocument();
    view.unmount();

    render(
      <DataTable
        columns={shipmentColumns}
        data={shipments}
        initialFilters={[{id: 'sent', value: {to: '2026-01-02'}}]}
      />,
    );
    expect(screen.getByText(L.totalRows(2))).toBeInTheDocument();
  });

  it('keeps the rows on a single date', () => {
    render(
      <DataTable columns={shipmentColumns} data={shipments} initialFilters={[{id: 'sent', value: '2026-01-04'}]} />,
    );

    expect(screen.getByText(L.totalRows(1))).toBeInTheDocument();
  });

  it('reads the range in the format the table was told dates are written in', () => {
    render(
      <DataTable
        columns={shipmentColumns}
        data={shipments}
        dateFormats={{value: 'DD/MM/YYYY'}}
        initialFilters={[{id: 'sent', value: {from: '03/01/2026', to: '05/01/2026'}}]}
      />,
    );

    expect(screen.getByText(L.totalRows(3))).toBeInTheDocument();
  });

  it('matches a dropdown whose values are numbers', () => {
    render(<DataTable columns={shipmentColumns} data={shipments} initialFilters={[{id: 'priority', value: 2}]} />);

    expect(screen.getByText(L.totalRows(3))).toBeInTheDocument();
  });

  it('leaves a column that brought its own match alone', () => {
    const own: DataTableColumnDef<Shipment>[] = shipmentColumns.map((column) =>
      column.id === 'priority' ? {...column, filterFn: (row) => row.original.priority > 1} : column,
    );
    render(<DataTable columns={own} data={shipments} initialFilters={[{id: 'priority', value: 1}]} />);

    // Priorities 2 and 3 across the first ten: the column's own rule, not equality with 1.
    expect(screen.getByText(L.totalRows(6))).toBeInTheDocument();
  });
});

describe('the date filter with a day-first value format', () => {
  it('keeps a stored date it cannot guess the order of', async () => {
    const user = userEvent.setup();
    const onServerStateChange = vi.fn<(state: ServerTableState) => void>();
    render(
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DataTable
          columns={shipmentColumns}
          data={shipments}
          manualFiltering
          dateFormats={{display: 'DD/MM/YYYY', value: 'DD/MM/YYYY'}}
          initialFilters={[{id: 'sent', value: {from: '25/04/2026', to: '03/05/2026'}}]}
          onServerStateChange={onServerStateChange}
        />
      </LocalizationProvider>,
    );
    onServerStateChange.mockClear();

    const drawer = await openFilters(user);
    await act(() => new Promise((resolve) => setTimeout(resolve, PAST_THE_DEBOUNCE * 2)));

    // Read month-first, the 25th is no date at all and the filter is thrown away, and the
    // 3rd of May becomes the 5th of March and is written back, then read again, for ever.
    expect(onServerStateChange).not.toHaveBeenCalled();
    const sections = within(drawer)
      .getAllByRole('spinbutton')
      .map((section) => section.textContent);
    expect(sections).toEqual(['25', '04', '2026', '03', '05', '2026']);
  });
});
