import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {DataTable} from './DataTable';
import {DEFAULT_LABELS as L} from './i18n';
import {render} from './test/test-utils';
import type {BulkAction, DataTableColumnDef, DataTableConfirmProps} from './types';

interface Order {
  readonly id: string;
  readonly customer: string;
  readonly status: string;
  readonly [key: string]: unknown;
}

function orders(from: number, count: number, status = 'OPEN'): Order[] {
  return Array.from({length: count}, (_unused, index) => ({
    id: `order-${from + index}`,
    customer: `Customer ${from + index}`,
    status,
  }));
}

const columns: DataTableColumnDef<Order>[] = [
  {id: 'customer', accessorKey: 'customer', header: 'Customer'},
  {id: 'status', accessorKey: 'status', header: 'Status'},
];

function onAPhone() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe('the header checkbox on a server-driven table', () => {
  it('reflects and clears the selection on a page after the first', async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={columns}
        data={orders(11, 10)}
        totalRows={30}
        pageSize={10}
        manualPagination
        enableRowSelection
      />,
    );
    // The server would answer with the next ten; the same ten stand in for them here.
    await user.click(screen.getByRole('button', {name: L.nextPage}));
    expect(screen.getByText(L.pageOf(2, 3))).toBeInTheDocument();
    const [header] = screen.getAllByRole('checkbox');
    if (!header) throw new Error('Expected a header checkbox');

    await user.click(header);
    expect(header).toBeChecked();
    expect(screen.getAllByRole('checkbox', {checked: true})).toHaveLength(11);

    await user.click(header);
    expect(header).not.toBeChecked();
    expect(screen.queryAllByRole('checkbox', {checked: true})).toHaveLength(0);
  });
});

describe('the header checkbox on a table that does not page', () => {
  it('is only ticked once every row is, not once a page worth of them is', async () => {
    const user = userEvent.setup();
    render(
      <DataTable columns={columns} data={orders(1, 4)} pageSize={2} enablePagination={false} enableRowSelection />,
    );
    const [header, first, second] = screen.getAllByRole('checkbox');
    if (!header || !first || !second) throw new Error('Expected a header checkbox and one per row');

    await user.click(first);
    await user.click(second);

    expect(header).not.toBeChecked();
    expect(header).toBePartiallyChecked();
  });
});

describe('bulk actions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('counts every row as it is selected', async () => {
    const user = userEvent.setup();
    const actions: BulkAction<Order>[] = [{id: 'archive', label: 'Archive', onClick: vi.fn()}];
    render(<DataTable columns={columns} data={orders(1, 3)} enableRowSelection bulkActions={actions} />);
    const [, first, second] = screen.getAllByRole('checkbox');
    if (!first || !second) throw new Error('Expected a checkbox per row');

    await user.click(first);
    expect(screen.getByText(`1 ${L.selected}`)).toBeInTheDocument();

    await user.click(second);
    expect(screen.getByText(`2 ${L.selected}`)).toBeInTheDocument();
  });

  it('hands the action the rows as they are now, not as they were when selected', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const actions: BulkAction<Order>[] = [{id: 'archive', label: 'Archive', onClick}];
    const view = render(<DataTable columns={columns} data={orders(1, 3)} enableRowSelection bulkActions={actions} />);
    const [, first] = screen.getAllByRole('checkbox');
    if (!first) throw new Error('Expected a checkbox per row');
    await user.click(first);

    // The same orders come back from a refetch with a new status.
    view.rerender(
      <DataTable columns={columns} data={orders(1, 3, 'SHIPPED')} enableRowSelection bulkActions={actions} />,
    );
    await user.click(screen.getByRole('button', {name: 'Archive'}));

    expect(onClick).toHaveBeenCalledWith([expect.objectContaining({id: 'order-1', status: 'SHIPPED'})]);
  });

  it('asks before a destructive action on a phone too', async () => {
    onAPhone();
    const user = userEvent.setup();
    const onClick = vi.fn();
    const actions: BulkAction<Order>[] = [
      {id: 'cancel', label: 'Cancel orders', onClick, confirmMessage: (count) => `Cancel ${count} orders?`},
    ];
    render(<DataTable columns={columns} data={orders(1, 3)} enableRowSelection bulkActions={actions} />);
    const [first] = screen.getAllByRole('checkbox');
    if (!first) throw new Error('Expected a checkbox per card');
    await user.click(first);

    await user.click(screen.getByRole('button', {name: L.actions}));
    await user.click(await screen.findByRole('menuitem', {name: 'Cancel orders'}));

    expect(onClick).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Cancel 1 orders?')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', {name: L.confirm}));
    expect(onClick).toHaveBeenCalledWith([expect.objectContaining({id: 'order-1'})]);
  });

  it('runs nothing when the question is answered with cancel', async () => {
    onAPhone();
    const user = userEvent.setup();
    const onClick = vi.fn();
    const actions: BulkAction<Order>[] = [
      {id: 'delete', label: 'Delete orders', color: 'error', onClick, confirmMessage: 'Delete these orders?'},
    ];
    render(<DataTable columns={columns} data={orders(1, 3)} enableRowSelection bulkActions={actions} />);
    const [first] = screen.getAllByRole('checkbox');
    if (!first) throw new Error('Expected a checkbox per card');
    await user.click(first);

    await user.click(screen.getByRole('button', {name: L.actions}));
    await user.click(await screen.findByRole('menuitem', {name: 'Delete orders'}));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete these orders?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', {name: L.cancel}));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByText(`1 ${L.selected}`)).toBeInTheDocument();
  });

  it('runs nothing when a consumer dialog confirms with no action pending', async () => {
    // A dialog passed through `slots.confirmDialog` can keep its confirm button mounted
    // while closed, so `onConfirm` can arrive with nothing to confirm.
    function AlwaysMountedConfirm({open, onConfirm, title}: Readonly<DataTableConfirmProps>) {
      return (
        <button type="button" onClick={() => void onConfirm()}>
          {open ? `Confirm ${title}` : 'Nothing to confirm'}
        </button>
      );
    }
    const slots = {confirmDialog: AlwaysMountedConfirm};
    onAPhone();
    const user = userEvent.setup();
    const onClick = vi.fn();
    const actions: BulkAction<Order>[] = [
      {id: 'cancel', label: 'Cancel orders', onClick, confirmMessage: 'Cancel these orders?'},
    ];
    render(<DataTable columns={columns} data={orders(1, 3)} enableRowSelection bulkActions={actions} slots={slots} />);
    const [first] = screen.getAllByRole('checkbox');
    if (!first) throw new Error('Expected a checkbox per card');
    await user.click(first);

    await user.click(screen.getByRole('button', {name: 'Nothing to confirm'}));

    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByText(`1 ${L.selected}`)).toBeInTheDocument();
  });
});
