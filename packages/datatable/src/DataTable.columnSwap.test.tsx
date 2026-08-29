/**
 * Swapping `columns` at runtime.
 *
 * This is what an app does when the user changes language, or when a page shows a
 * different shape of the same list. It is also the case the React Compiler quietly breaks:
 * `table` is a stable reference, so a component that reads headers and cells through it
 * has no changing input the compiler can see, and it serves the previous render's markup.
 * The table then shows the old headers over the new data, or the reverse.
 */
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it} from 'vitest';

import {DataTable} from './DataTable';
import {render} from './test/test-utils';
import type {DataTableColumnDef} from './types';

interface Order {
  readonly id: string;
  readonly reference: string;
  readonly total: number;
  readonly [key: string]: unknown;
}

const rows: Order[] = [
  {id: '1', reference: 'SW-1000', total: 42},
  {id: '2', reference: 'SW-1001', total: 17},
];

const english: DataTableColumnDef<Order>[] = [
  {id: 'reference', accessorKey: 'reference', header: 'Reference'},
  {id: 'total', accessorKey: 'total', header: 'Total', cell: ({row}) => `$${row.original.total}`},
];

const hindi: DataTableColumnDef<Order>[] = [
  {id: 'reference', accessorKey: 'reference', header: 'संदर्भ'},
  {id: 'total', accessorKey: 'total', header: 'कुल', cell: ({row}) => `₹${row.original.total}`},
];

function Harness() {
  const [columns, setColumns] = useState(english);

  return (
    <>
      <button type="button" onClick={() => setColumns(columns === english ? hindi : english)}>
        Swap
      </button>
      <DataTable columns={columns} data={rows} ariaLabel="Orders" />
    </>
  );
}

describe('changing columns at runtime', () => {
  it('re-renders headers and cells from the new column definitions', async () => {
    render(<Harness />);

    expect(screen.getByText('Reference')).toBeInTheDocument();
    expect(screen.getByText('$42')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Swap'}));

    await waitFor(() => {
      expect(screen.getByText('संदर्भ')).toBeInTheDocument();
    });
    // The cell renderer comes from the same object, so a stale header and a fresh cell are
    // both possible; assert on each.
    expect(screen.getByText('₹42')).toBeInTheDocument();
    expect(screen.queryByText('Reference')).not.toBeInTheDocument();
    expect(screen.queryByText('$42')).not.toBeInTheDocument();
  });
});
