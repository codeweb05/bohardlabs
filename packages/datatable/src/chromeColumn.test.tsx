/**
 * `chromeColumn` builds the expand, select and actions columns. The table paints those
 * cells itself from the column id, so the definition's own `header` and `cell` only run
 * when something renders the column generically (a consumer calling `flexRender` on the
 * table instance, for example). They have to come out empty there, and the column has
 * to stay out of every feature that only makes sense for data.
 */
import {flexRender, getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {describe, expect, it} from 'vitest';

import {chromeColumn} from './chromeColumn';
import {render, screen} from './test/test-utils';

interface Item {
  readonly id: string;
  readonly [key: string]: unknown;
}

const data: Item[] = [{id: 'row-1'}];

function GenericTable({header}: Readonly<{header?: string}>) {
  'use no memo';
  const columns = [header === undefined ? chromeColumn<Item>('select', 48) : chromeColumn<Item>('actions', 56, header)];
  const table = useReactTable({data, columns, getCoreRowModel: getCoreRowModel()});
  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((group) => (
          <tr key={group.id}>
            {group.headers.map((cell) => (
              <th key={cell.id}>{flexRender(cell.column.columnDef.header, cell.getContext())}</th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getAllCells().map((cell) => (
              <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

describe('chromeColumn', () => {
  it('is fixed width and opted out of every data feature', () => {
    expect(chromeColumn<Item>('select', 48)).toMatchObject({
      id: 'select',
      size: 48,
      minSize: 48,
      maxSize: 48,
      enableSorting: false,
      enableFiltering: false,
      enableResizing: false,
      enableHiding: false,
    });
  });

  it('renders an empty header and an empty cell when drawn generically', () => {
    render(<GenericTable />);

    expect(screen.getByRole('columnheader')).toBeEmptyDOMElement();
    expect(screen.getByRole('cell')).toBeEmptyDOMElement();
  });

  it('uses the header it was given', () => {
    render(<GenericTable header="Actions" />);

    expect(screen.getByRole('columnheader', {name: 'Actions'})).toBeInTheDocument();
  });
});
