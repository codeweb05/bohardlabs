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
 *
 * Everything comes through the package test-utils, and hovering is `fireEvent.mouseOver`,
 * the event MUI's Tooltip opens on. The layout tests at the bottom read the label's parent
 * element, because the flex item they guard has no role or text of its own.
 */
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {act} from 'react';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {DataTableProvider} from '../DataTableContext';
import {fireEvent, render, screen, waitFor} from '../test/test-utils';
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
  readonly enableSorting?: boolean;
}

function Harness({header, overflow = 'ellipsis', enableSorting = true}: Readonly<HarnessProps>) {
  'use no memo';
  const columns: DataTableColumnDef<Item>[] = [{id: 'name', accessorKey: 'name', header, enableSorting}];
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

    fireEvent.mouseOver(screen.getByText(LONG_LABEL));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(LONG_LABEL);
  });

  it('reads the rendered text back out of a custom header node', async () => {
    // A header rendered from a function is a React element, not a string, so the text
    // has to come from the DOM. Columns with an icon or a count badge beside the label
    // all take this path.
    render(<Harness header={() => <span>Orders this week</span>} />);
    await flushTruncationCheck();

    fireEvent.mouseOver(screen.getByText('Orders this week'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Orders this week');
  });

  it('shows a numeric header as text', async () => {
    // A year column built from data in a plain-JS app hands the header over as a number.
    // The column type rejects that, so the number is merged in the way untyped code would.
    const yearColumn = Object.assign({header: ''} satisfies Pick<DataTableColumnDef<Item>, 'header'>, {header: 2024});
    render(<Harness header={yearColumn.header} />);
    await flushTruncationCheck();

    fireEvent.mouseOver(screen.getByText('2024'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('2024');
  });

  it('shows no tooltip when the label fits', async () => {
    stubOverflow(100, 100);
    render(<Harness header="Name" />);
    await flushTruncationCheck();

    fireEvent.mouseOver(screen.getByText('Name'));

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

    fireEvent.mouseOver(screen.getByText(LONG_LABEL));

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});

/**
 * The tooltip used to be attached to a bare `<span>` wrapped around the ellipsis box.
 * On a non-sortable column that span becomes the flex item of the header row, and its
 * `min-width: auto` (content-based, because the label is `white-space: nowrap`) means it
 * cannot shrink. The ellipsis box then gets its full content width, `text-overflow`
 * never fires, and the label runs past the cell edge where `overflow: hidden` clips it
 * mid-character. Verified in Chromium: with a 70px column the wrapped label measured
 * clientWidth 97 === scrollWidth 97 and spilled 9.3px past the cell, while the unwrapped
 * one measured clientWidth 75 < scrollWidth 97 and ellipsized inside the cell.
 *
 * A consumer sees this on any column with `enableSorting: false`, which is most of the
 * chrome columns and every column whose data has no meaningful order.
 */
describe('TableHeader — the truncated label stays inside its column', () => {
  it('leaves the ellipsis box as the direct flex child of the header row', async () => {
    render(<Harness header={LONG_LABEL} enableSorting={false} />);
    await flushTruncationCheck();

    // The truncation check has flushed, so this is the post-wrap tree.
    const content = screen.getByText(LONG_LABEL);
    const parent = content.parentElement;

    expect(content).toHaveClass('header-content');
    expect(parent).toBeInTheDocument();
    expect(globalThis.getComputedStyle(parent!).display).toBe('flex');
  });

  it('keeps the ellipsis box able to shrink on a sortable column too', async () => {
    render(<Harness header={LONG_LABEL} />);
    await flushTruncationCheck();

    const content = screen.getByText(LONG_LABEL);
    const parent = content.parentElement;

    expect(content).toHaveClass('header-content');
    expect(parent).toBeInTheDocument();
    // The label slot inside the sort button: a flex item with `min-width: 0` so the
    // ellipsis box below it inherits a constrained width. Parsed rather than string-matched
    // because emotion serialises the zero as `0` or `0px` depending on its version, and
    // the bug this guards is `auto` (NaN here), not the unit.
    expect(Number.parseFloat(globalThis.getComputedStyle(parent!).minWidth)).toBe(0);
  });
});
