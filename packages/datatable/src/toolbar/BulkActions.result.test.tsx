/**
 * A bulk action that reports which rows went through and which did not.
 *
 * An action that returns nothing clears the selection, as it always has. One that returns
 * a `BulkActionResult` keeps the failed rows selected for a retry, says how many of each
 * in the bar, and hands the result to `onResult`.
 */
import type {ColumnDef, RowSelectionState} from '@tanstack/react-table';
import {getCoreRowModel, getFilteredRowModel, useReactTable} from '@tanstack/react-table';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';

import {DEFAULT_LABELS} from '../i18n';
import {render} from '../test/test-utils';
import type {BulkAction, BulkActionResult} from '../types';
import {BulkActions} from './BulkActions';

interface Payout {
  readonly id: string;
  readonly [key: string]: unknown;
}

const data: Payout[] = [{id: 'p-1'}, {id: 'p-2'}, {id: 'p-3'}, {id: 'p-4'}];

const columns: ColumnDef<Payout>[] = [{id: 'id', accessorKey: 'id'}];

const ALL_SELECTED: RowSelectionState = {'p-1': true, 'p-2': true, 'p-3': true, 'p-4': true};

function payAction(onClick: BulkAction<Payout>['onClick']): BulkAction<Payout> {
  return {id: 'pay', label: 'Mark as paid', onClick};
}

/** The bar over a real table, with the selection printed so a test can read it. */
function renderBar(action: BulkAction<Payout>, onResult = vi.fn()) {
  function Harness() {
    'use no memo';
    const [rowSelection, setRowSelection] = useState<RowSelectionState>(ALL_SELECTED);
    const table = useReactTable({
      data,
      columns,
      state: {rowSelection},
      onRowSelectionChange: setRowSelection,
      enableRowSelection: true,
      getRowId: (row) => row.id,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
    });
    return (
      <>
        <BulkActions table={table} actions={[action]} rowSelection={rowSelection} onResult={onResult} />
        <output data-testid="selection">{Object.keys(rowSelection).join(',')}</output>
        <button type="button" onClick={() => setRowSelection({'p-1': true})}>
          Pick another row
        </button>
      </>
    );
  }
  render(<Harness />);
  return {onResult, selection: () => screen.getByTestId('selection').textContent};
}

const mixed: BulkActionResult = {succeeded: ['p-1', 'p-3'], failed: ['p-2', 'p-4']};

async function runPay() {
  await userEvent.click(screen.getByRole('button', {name: 'Mark as paid'}));
}

describe('BulkActions, partial results', () => {
  it('clears the selection when the action returns nothing, as before', async () => {
    const {onResult, selection} = renderBar(payAction(() => Promise.resolve()));

    await runPay();

    await waitFor(() => expect(selection()).toBe(''));
    expect(onResult).not.toHaveBeenCalled();
  });

  it('keeps only the failed rows selected and says how many of each', async () => {
    const action = payAction(() => Promise.resolve(mixed));
    const {onResult, selection} = renderBar(action);

    await runPay();

    await waitFor(() => expect(selection()).toBe('p-2,p-4'));
    expect(await screen.findByRole('alert')).toHaveTextContent(DEFAULT_LABELS.bulkResult(2, 2));
    expect(screen.getByRole('alert')).toHaveTextContent('2 updated, 2 failed. The 2 failed rows are still selected.');
    expect(onResult).toHaveBeenCalledWith(action, mixed);
  });

  it('keeps every row selected when every row failed', async () => {
    const {selection} = renderBar(payAction(() => ({succeeded: [], failed: ['p-1', 'p-2', 'p-3', 'p-4']})));

    await runPay();

    expect(await screen.findByRole('alert')).toHaveTextContent(DEFAULT_LABELS.bulkResult(0, 4));
    expect(selection()).toBe('p-1,p-2,p-3,p-4');
  });

  it('ignores a failed id that was not selected', async () => {
    const {selection} = renderBar(payAction(() => ({succeeded: [], failed: ['p-2', 'p-9']})));

    await runPay();

    await waitFor(() => expect(selection()).toBe('p-2'));
  });

  it('closes the message from its close button and leaves the selection', async () => {
    const {selection} = renderBar(payAction(() => Promise.resolve(mixed)));

    await runPay();
    await userEvent.click(await screen.findByRole('button', {name: DEFAULT_LABELS.close}));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(selection()).toBe('p-2,p-4');
  });

  it('drops the message once the selection changes', async () => {
    renderBar(payAction(() => Promise.resolve(mixed)));

    await runPay();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Pick another row'}));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
