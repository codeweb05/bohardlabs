/**
 * Coverage for `getHeaderTooltipText` (TableHeader.tsx:668-683), which nothing reached.
 *
 * Same blind spot as the cell tooltip: jsdom reports every element as 0 wide, so
 * `useHeaderTruncation` never flipped and the whole tooltip branch was dead in the
 * coverage report. Stubbing the two width properties is the only way in.
 *
 * What it guards: a truncated header is unreadable, and the tooltip is the only way a
 * user learns what the column is. Headers are not always plain strings, so the function
 * has a DOM fallback that reads the rendered text back out of `.header-content` when the
 * header is a custom node. If that fallback broke, every table with an icon or badge in
 * a header would lose its tooltip while the plain ones kept theirs, which is exactly the
 * kind of gap nobody notices until a user asks what a column means.
 */
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {act, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {DataTableProvider} from '../DataTableContext';
import {render} from '../test/test-utils';
import type {CellOverflowMode, DataTableColumnDef, RowData} from '../types';
import {TableHeader} from './TableHeader';

interface Item extends RowData {
  readonly id: number;
  readonly name: string;
}

const data: Item[] = [{id: 1, name: 'Detergent'}];

const LONG_LABEL = 'A column label far too long for the width it was given';

interface HarnessProps {
  readonly header: DataTableColumnDef<Item>['header'];
  readonly overflow?: CellOverflowMode;
}

function Harness({header, overflow = 'ellipsis'}: Readonly<HarnessProps>) {
  'use no memo';
  const columns: DataTableColumnDef<Item>[] = [{id: 'name', accessorKey: 'name', header}];
  const table = useReactTable({data, columns, getCoreRowModel: getCoreRowModel()});

  return (
    <DataTableProvider table={table} density="comfortable" setDensity={() => {}} isMobile={false}>
      <table>
        <TableHeader table={table} defaultOverflow={overflow} />
      </table>
    </DataTableProvider>
  );
}

/** jsdom reports 0 for both, so the header can never see an overflow on its own. */
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

/**
 * The header measures itself from a `setTimeout(…, 0)` after mount, so the tooltip
 * wrapper does not exist yet on the first paint. Hovering before that flush would open
 * nothing, and no second hover event ever arrives to make up for it.
 */
async function flushTruncationCheck() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('TableHeader — the truncation tooltip', () => {
  it('shows the full label of a truncated string header', async () => {
    render(<Harness header={LONG_LABEL} />);
    await flushTruncationCheck();

    await userEvent.hover(screen.getByText(LONG_LABEL));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(LONG_LABEL);
  });

  it('reads the rendered text back out of a custom header node', async () => {
    // A header rendered from a function is a React element, not a string, so the text
    // has to come from the DOM. Columns with an icon or a count badge beside the label
    // all take this path.
    render(<Harness header={() => <span>Orders this week</span>} />);
    await flushTruncationCheck();

    await userEvent.hover(screen.getByText('Orders this week'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Orders this week');
  });

  it('shows no tooltip when the label fits', async () => {
    stubOverflow(100, 100);
    render(<Harness header="Name" />);
    await flushTruncationCheck();

    await userEvent.hover(screen.getByText('Name'));

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('shows no tooltip in wrap mode, however long the label is', async () => {
    // `wrap` shows the whole label already, so a tooltip would only repeat it. The
    // truncation effect returns early for that mode, which is why the check is here
    // rather than inside `getHeaderTooltipText`.
    render(<Harness header={LONG_LABEL} overflow="wrap" />);
    await flushTruncationCheck();

    await userEvent.hover(screen.getByText(LONG_LABEL));

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});
