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
import {act, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useMemo} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {DataTableProvider} from '../DataTableContext';
import {render} from '../test/test-utils';
import type {DataTableColumnDef, TableDensity} from '../types';
import {TableCell} from './TableCell';

interface Item {
  readonly id: string;
  readonly label: unknown;
  readonly [key: string]: unknown;
}

function Harness({
  value,
  width,
  density = 'comfortable',
}: Readonly<{value: unknown; width?: number; density?: TableDensity}>) {
  'use no memo';
  // Stable identity, not rebuilt per render. `useReactTable` treats new `data` /
  // `columns` as new options and re-derives, and under a rerender that turns into an
  // unbounded render loop rather than a failed assertion. Only the tests that rerender
  // hit it, which is why it survived here until one of them did.
  const data: Item[] = useMemo(() => [{id: 'item-1', label: value}], [value]);
  const columns: DataTableColumnDef<Item>[] = useMemo(
    () => [{id: 'label', accessorKey: 'label', header: 'Label', cell: () => <span>cell</span>}],
    [],
  );
  const table = useReactTable({data, columns: columns as ColumnDef<Item>[], getCoreRowModel: getCoreRowModel()});
  const row = table.getRowModel().rows[0];
  const cell = row?.getVisibleCells()[0];

  if (!row || !cell) return <div>no data</div>;

  return (
    <DataTableProvider table={table} density={density} setDensity={() => {}} isMobile={false}>
      <table>
        <tbody>
          <tr>
            <TableCell
              cell={cell}
              row={row}
              table={table}
              defaultOverflow="ellipsis"
              style={width === undefined ? undefined : {width}}
            />
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

/**
 * The cell measures itself from a `setTimeout(…, 0)` after mount, the same as the header,
 * so the tooltip is not armed yet on the first paint. A real pointer cannot arrive inside
 * one macrotask of mount; `userEvent.hover` can, so the flush stands in for that gap.
 *
 * Kept separate from the hover because the width tests below have to flush *while* the
 * stubbed width they are simulating is still in place. Flushing on the way into the hover
 * instead would measure the width the test had already moved on to, and both of those
 * tests would then pass against the bug they exist to catch.
 */
async function flushTruncationCheck() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function hoverCellContent() {
  const [content] = screen.getAllByText('cell');
  await userEvent.hover(content);
}

// MUI waits out `enterDelay` (100ms by default, and no prop overrides it here) before it
// calls `onOpen`, which is where the re-measure lives. A negative assertion made straight
// after the hover would therefore pass even with the re-measure ripped out.
const TOOLTIP_ENTER_DELAY_MS = 150;

async function flushTooltipEnterDelay() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, TOOLTIP_ENTER_DELAY_MS));
  });
}

async function hoverCell() {
  await flushTruncationCheck();
  await hoverCellContent();
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

/**
 * The truncation used to be measured once, from a `useEffect` keyed on
 * `[truncate, overflowMode, cellValue]`. No width in the deps and no observer, so the
 * flag survived every width change the cell went through afterwards: a drag-resize, a
 * column being hidden, the table stretching to a wider viewport. A cell measured as
 * overflowing while the column was narrow kept its tooltip forever, so a value that had
 * become fully visible still got a tooltip repeating it.
 */
describe('TableCell — the tooltip tracks the current column width', () => {
  const LONG = 'a.long.value.that.started.out.wider.than.its.column';

  it('drops the tooltip once the column is wide enough for the value', async () => {
    // Measured while narrow, so the cell really does mount a Tooltip and the flag really
    // is true. That is the state the bug leaves behind.
    stubOverflow(300, 100);
    render(<Harness value={LONG} />);
    await flushTruncationCheck();

    // The column is now wide enough for the value. Nothing re-runs the mount-time
    // measurement, so the flag stays true and the Tooltip stays mounted.
    stubOverflow(100, 100);

    await hoverCellContent();
    await flushTooltipEnterDelay();

    // Only the re-measure on open can tell that the value now fits.
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('re-arms the tooltip when a resize narrows the column onto the value', async () => {
    // A cell that fits mounts no Tooltip at all, which is what keeps a table body cheap.
    // Dragging the column narrower has to bring it back, so the width is in the deps of
    // the check that decides whether to mount one.
    stubOverflow(100, 100);
    const {rerender} = render(<Harness value={LONG} width={400} />);
    await flushTruncationCheck();

    stubOverflow(300, 100);
    rerender(<Harness value={LONG} width={120} />);
    await flushTruncationCheck();

    await hoverCellContent();

    expect(await screen.findByRole('tooltip')).toHaveTextContent(LONG);
  });

  // Density drives the cell's padding and font size, so switching to compact can truncate a
  // value that fit at comfortable. A cell that fit mounts no Tooltip, so only re-running the
  // mount-time check can arm one.
  it('re-arms the tooltip when a density switch makes the value overflow', async () => {
    stubOverflow(100, 100);
    const {rerender} = render(<Harness value={LONG} />);
    await flushTruncationCheck();

    stubOverflow(300, 100);
    rerender(<Harness value={LONG} density="compact" />);
    await flushTruncationCheck();

    await hoverCellContent();

    expect(await screen.findByRole('tooltip')).toHaveTextContent(LONG);
  });
});

/**
 * Every truncating cell used to schedule its own `setTimeout(…, 0)` to measure itself, 600 of
 * them on a 50x12 table. Each one's `setState` committed in its own macrotask and dirtied layout
 * for the next cell's read. Cells that mount together now share one timer, so their reads hit a
 * single layout and React batches the updates into one render.
 */
describe('TableCell — mount-time measurement', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shares one timer across every cell that mounts together', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    render(
      <>
        {Array.from({length: 20}, (_, index) => (
          <Harness key={index} value="A product name too long for its column" />
        ))}
      </>,
    );

    const measureTimers = setTimeoutSpy.mock.calls.filter(([, delay]) => delay === 0);
    expect(measureTimers).toHaveLength(1);
  });

  it('still arms every cell from that one timer', async () => {
    const LONG = 'A product name too long for its column';
    render(
      <>
        {Array.from({length: 3}, (_, index) => (
          <Harness key={index} value={LONG} />
        ))}
      </>,
    );
    await flushTruncationCheck();

    for (const content of screen.getAllByText('cell')) {
      await userEvent.hover(content);
      expect(await screen.findByRole('tooltip')).toHaveTextContent(LONG);
      await userEvent.unhover(content);
      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    }
  });
});

/**
 * The tooltip is controlled, and only MUI's `onClose` used to reset the open flag. MUI calls
 * that from mouseleave, blur, touchend and Escape, never from unmount, and the `<Tooltip>`
 * itself is mounted conditionally. So a cell whose tooltip unmounted while open (the row went
 * into editing, a refetch shortened the value, the column widened) kept the flag, and the next
 * time the condition turned back on the tooltip mounted already open, over a cell nobody was
 * pointing at. The on-hover re-measure could not rescue it: MUI fires `onOpen` only while the
 * tooltip is closed.
 */
describe('TableCell — a tooltip that unmounted while open does not come back on its own', () => {
  const LONG = 'A product name too long for its column';

  it('needs a fresh hover after the value shrank and grew back', async () => {
    const {rerender} = render(<Harness value={LONG} />);
    await hoverCell();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(LONG);

    // A refetch shortens the value: the cell now fits, the Tooltip is unmounted, and
    // `onClose` never fires.
    stubOverflow(100, 100);
    rerender(<Harness value="Short" />);
    await flushTruncationCheck();
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    // It grows back and overflows again. Nothing has hovered since.
    stubOverflow(300, 100);
    rerender(<Harness value={LONG} />);
    await flushTruncationCheck();
    await flushTooltipEnterDelay();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
