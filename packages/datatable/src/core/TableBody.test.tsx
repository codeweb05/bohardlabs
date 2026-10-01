/**
 * `TableBody` on its own, with no frozen columns.
 *
 * Through `TableContainer` the select and expand cells are always frozen, so their unfrozen
 * form never reached a second render: the cell that repaints when a row is ticked was only
 * ever the frozen one. A body composed without the container (no `pinnedColumns`) has to
 * keep its checkboxes in step with the selection all the same.
 */
import type {RowSelectionState} from '@tanstack/react-table';
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it} from 'vitest';

import {DataTableProvider} from '../DataTableContext';
import {render, screen} from '../test/test-utils';
import type {DataTableColumnDef, RowData} from '../types';
import {TableBody} from './TableBody';

interface Item extends RowData {
  readonly id: number;
  readonly name: string;
}

const data: Item[] = [
  {id: 1, name: 'Detergent'},
  {id: 2, name: 'Softener'},
];

const columns: DataTableColumnDef<Item>[] = [
  {id: 'select', header: () => null, cell: () => null},
  {id: 'name', accessorKey: 'name', header: 'Name'},
];

function Harness() {
  'use no memo';
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const table = useReactTable({
    data,
    columns,
    state: {rowSelection},
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DataTableProvider table={table} density="comfortable" setDensity={() => {}} rowSelection={rowSelection}>
      <table>
        <TableBody table={table} />
      </table>
    </DataTableProvider>
  );
}

describe('TableBody without frozen columns', () => {
  it('ticks and unticks a row, leaving the others alone', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('checkbox', {name: 'Select row 0'}));

    expect(screen.getByRole('checkbox', {name: 'Select row 0'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select row 1'})).not.toBeChecked();
    expect(screen.getByRole('row', {name: /Detergent/})).toHaveClass('Mui-selected');

    await user.click(screen.getByRole('checkbox', {name: 'Select row 0'}));

    expect(screen.getByRole('checkbox', {name: 'Select row 0'})).not.toBeChecked();
    expect(screen.getByRole('row', {name: /Detergent/})).not.toHaveClass('Mui-selected');
  });

  it('keeps the select cell in the normal flow', () => {
    render(<Harness />);

    const [selectCell] = within(screen.getByRole('row', {name: /Detergent/})).getAllByRole('cell');

    expect(within(selectCell).getByRole('checkbox', {name: 'Select row 0'})).toBeInTheDocument();
    expect(selectCell).not.toHaveStyle({position: 'sticky'});
  });
});
