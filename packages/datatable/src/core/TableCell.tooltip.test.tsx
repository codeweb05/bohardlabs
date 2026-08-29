/**
 * Coverage for `getTooltipText` (TableCell.tsx:103-111), which nothing reached.
 *
 * The truncation tooltip only exists when the cell has actually overflowed, and jsdom
 * reports every element as 0 wide, so `isTruncated` could never become true and the whole
 * tooltip branch sat dead in the coverage report. Stubbing the two width properties is the
 * only way in.
 *
 * What it guards: a cell renders whatever the row's accessor returns, which is not always
 * text. A column showing a nested object through a custom `cell` renderer would put
 * "[object Object]" in the tooltip if `getTooltipText` ever fell back to `String(value)`,
 * and an empty title is what tells MUI to render no tooltip at all.
 */
import type {ColumnDef} from '@tanstack/react-table';
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {DataTableProvider} from '../DataTableContext';
import {render} from '../test/test-utils';
import type {DataTableColumnDef} from '../types';
import {TableCell} from './TableCell';

interface Item {
  readonly id: string;
  readonly label: unknown;
  readonly [key: string]: unknown;
}

function Harness({value}: Readonly<{value: unknown}>) {
  'use no memo';
  const data: Item[] = [{id: 'item-1', label: value}];
  const columns: DataTableColumnDef<Item>[] = [
    {id: 'label', accessorKey: 'label', header: 'Label', cell: () => <span>cell</span>},
  ];
  const table = useReactTable({data, columns: columns as ColumnDef<Item>[], getCoreRowModel: getCoreRowModel()});
  const row = table.getRowModel().rows[0];
  const cell = row?.getVisibleCells()[0];

  if (!row || !cell) return <div>no data</div>;

  return (
    <DataTableProvider table={table} density="comfortable" setDensity={() => {}} isMobile={false}>
      <table>
        <tbody>
          <tr>
            <TableCell cell={cell} row={row} table={table} defaultOverflow="ellipsis" />
          </tr>
        </tbody>
      </table>
    </DataTableProvider>
  );
}

/** jsdom reports 0 for both, so the component can never see an overflow on its own. */
function stubOverflow(scrollWidth: number, clientWidth: number) {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {configurable: true, value: scrollWidth});
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {configurable: true, value: clientWidth});
}

beforeEach(() => {
  stubOverflow(300, 100);
});

afterEach(() => {
  stubOverflow(0, 0);
});

async function hoverCell() {
  const [content] = screen.getAllByText('cell');
  await userEvent.hover(content);
}

describe('TableCell — the truncation tooltip', () => {
  it('shows the full text of a truncated string cell', async () => {
    render(<Harness value="A product name too long for its column" />);

    await hoverCell();

    expect(await screen.findByRole('tooltip')).toHaveTextContent('A product name too long for its column');
  });

  it('shows a numeric value as text', async () => {
    // `String(value)` is reached for numbers too; a number is not a string, so an
    // over-narrow type check here would silently drop the tooltip on every amount column.
    render(<Harness value={1234.56} />);

    await hoverCell();

    expect(await screen.findByRole('tooltip')).toHaveTextContent('1234.56');
  });

  it('shows no tooltip for a value that is not text', async () => {
    render(<Harness value={{first: 'Ada', last: 'Lovelace'}} />);

    await hoverCell();

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('shows no tooltip for an empty cell', async () => {
    render(<Harness value={null} />);

    await hoverCell();

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('shows no tooltip when the content fits', async () => {
    stubOverflow(100, 100);
    render(<Harness value="Short" />);

    await hoverCell();

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});
