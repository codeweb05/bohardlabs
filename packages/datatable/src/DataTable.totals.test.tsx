/**
 * The totals footer end to end. A client table totals every row its filters keep, across
 * pages; a server table only ever shows the totals it was handed.
 */
import {within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';

import {DataTable} from './DataTable';
import {render, screen, waitFor} from './test/test-utils';
import type {DataTableColumnDef} from './types';

interface Order {
  readonly id: string;
  readonly reference: string;
  readonly amount: number | null;
  readonly [key: string]: unknown;
}

const orders: Order[] = [
  {id: '1', reference: 'North-1', amount: 100},
  {id: '2', reference: 'North-2', amount: 50},
  {id: '3', reference: 'South-1', amount: 25},
  {id: '4', reference: 'South-2', amount: null},
];

const columns: DataTableColumnDef<Order>[] = [
  {id: 'reference', accessorKey: 'reference', header: 'Reference', meta: {aggregate: 'count'}},
  {id: 'amount', accessorKey: 'amount', header: 'Amount', align: 'right', meta: {aggregate: 'sum'}},
];

const format = (value: number) => new Intl.NumberFormat().format(value);

/** The footer's cells; thead, tbody and tfoot are the table's three row groups. */
function footerCells() {
  const groups = screen.getAllByRole('rowgroup');
  expect(groups).toHaveLength(3);
  return within(groups[2]).getAllByRole('cell');
}

describe('DataTable, totals footer', () => {
  it('totals every row, not just the page on screen', () => {
    render(<DataTable columns={columns} data={orders} pageSize={2} enableColumnPinning={false} />);

    expect(footerCells().map((cell) => cell.textContent)).toEqual(['4', format(175)]);
  });

  it('follows the filters', async () => {
    render(<DataTable columns={columns} data={orders} enableColumnPinning={false} />);

    await userEvent.type(screen.getByRole('textbox'), 'South');

    await waitFor(() => expect(footerCells().map((cell) => cell.textContent)).toEqual(['2', format(25)]));
  });

  it('adds nothing when no column asks for a total', () => {
    const plain: DataTableColumnDef<Order>[] = [{id: 'reference', accessorKey: 'reference', header: 'Reference'}];
    render(<DataTable columns={plain} data={orders} />);

    // thead and tbody, no tfoot
    expect(screen.getAllByRole('rowgroup')).toHaveLength(2);
  });

  it('shows a total the column formats itself', () => {
    const formatted: DataTableColumnDef<Order>[] = [
      {
        id: 'amount',
        accessorKey: 'amount',
        header: 'Amount',
        meta: {aggregate: 'max', formatAggregate: (value: number) => `max ${value}`},
      },
    ];
    render(<DataTable columns={formatted} data={orders} enableColumnPinning={false} />);

    expect(footerCells().map((cell) => cell.textContent)).toEqual(['max 100']);
  });

  it('leaves the cell of a column without a total empty, and keeps a frozen column frozen', () => {
    render(
      <DataTable
        columns={columns.map((column) => (column.id === 'reference' ? {...column, meta: undefined} : column))}
        data={orders}
        enableRowSelection
        initialColumnPinning={{left: ['reference'], right: []}}
      />,
    );

    const [select, reference, amount] = footerCells();
    expect(select).toBeEmptyDOMElement();
    expect(reference).toBeEmptyDOMElement();
    expect(reference).toHaveStyle({position: 'sticky'});
    expect(amount).toHaveTextContent(format(175));
  });

  it('drops the cell of a hidden column', () => {
    render(
      <DataTable
        columns={columns}
        data={orders}
        enableColumnPinning={false}
        initialColumnVisibility={{reference: false}}
      />,
    );

    expect(footerCells().map((cell) => cell.textContent)).toEqual([format(175)]);
  });

  it('keeps its totals when the table re-renders with nothing changed', () => {
    const {rerender} = render(<DataTable columns={columns} data={orders} enableColumnPinning={false} />);

    // The same props again, so the compiled footer reuses everything it drew last time.
    rerender(<DataTable columns={columns} data={orders} enableColumnPinning={false} />);

    expect(footerCells().map((cell) => cell.textContent)).toEqual(['4', format(175)]);
  });

  describe('in server mode', () => {
    it('shows the totals it was handed and never adds up the page', () => {
      render(
        <DataTable
          columns={columns}
          data={orders.slice(0, 2)}
          totalRows={40}
          manualPagination
          enableColumnPinning={false}
          aggregates={{amount: 9000}}
        />,
      );

      // Nothing for the reference count: the API sent none, and a zero would be a lie.
      expect(footerCells().map((cell) => cell.textContent)).toEqual(['', format(9000)]);
    });

    it('shows no footer while it has no totals', () => {
      render(
        <DataTable
          columns={columns}
          data={orders}
          manualFiltering
          enableColumnPinning={false}
          aggregates={{amount: null}}
        />,
      );

      // thead and tbody, no tfoot
      expect(screen.getAllByRole('rowgroup')).toHaveLength(2);
    });

    it('shows no footer when none were handed over', () => {
      render(<DataTable columns={columns} data={orders} manualPagination totalRows={4} />);

      // thead and tbody, no tfoot
      expect(screen.getAllByRole('rowgroup')).toHaveLength(2);
    });
  });
});
