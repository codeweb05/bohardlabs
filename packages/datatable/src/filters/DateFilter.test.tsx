import {ThemeProvider, createTheme} from '@mui/material';
import {LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import type {Column} from '@tanstack/react-table';
import {act, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {ReactNode} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {DateFilter} from './DateFilter';

// ---------------------------------------------------------------------------
// Test wrapper — DatePicker requires LocalizationProvider + Theme
// ---------------------------------------------------------------------------

const theme = createTheme();

function Wrapper({children}: Readonly<{children: ReactNode}>) {
  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <>{children}</>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Mock column factory
// ---------------------------------------------------------------------------

function createMockColumn(filterValue?: unknown) {
  let currentFilterValue = filterValue;
  return {
    getFilterValue: vi.fn(() => currentFilterValue),
    setFilterValue: vi.fn((val: unknown) => {
      currentFilterValue = val;
    }),
    id: 'testDate',
  } as unknown as Column<unknown>;
}

// ---------------------------------------------------------------------------
// Helper: find DatePicker input containers
// MUI v7 DatePicker uses role="group" for each picker input area
// ---------------------------------------------------------------------------

function getPickerInputs() {
  return screen.getAllByRole('group');
}

function getCalendarButtons() {
  return screen.getAllByRole('button', {name: /choose date/i});
}

// ---------------------------------------------------------------------------
// Tests — Range mode (default)
// ---------------------------------------------------------------------------

describe('DateFilter — Range mode', () => {
  beforeEach(() => {
    vi.useFakeTimers({shouldAdvanceTime: true});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders two date picker inputs in range mode', () => {
    const column = createMockColumn();
    render(<DateFilter column={column} />, {wrapper: Wrapper});

    // Two calendar buttons = two date pickers
    expect(getCalendarButtons()).toHaveLength(2);
  });

  it('renders the separator dash between pickers', () => {
    const column = createMockColumn();
    render(<DateFilter column={column} />, {wrapper: Wrapper});

    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('does not show clear button when no value is set', () => {
    const column = createMockColumn();
    render(<DateFilter column={column} />, {wrapper: Wrapper});

    // Only calendar buttons, no clear button
    const allButtons = screen.getAllByRole('button');
    const clearButtons = allButtons.filter((btn) => !btn.getAttribute('aria-label')?.includes('Choose date'));
    expect(clearButtons).toHaveLength(0);
  });

  it('shows clear button when a value is present', () => {
    const column = createMockColumn({from: '2026-03-01'});
    render(<DateFilter column={column} />, {wrapper: Wrapper});

    // Should have calendar buttons + 1 clear button
    const allButtons = screen.getAllByRole('button');
    expect(allButtons.length).toBeGreaterThan(2);
  });

  it('initializes "from" spinbuttons from an existing range value', () => {
    const column = createMockColumn({from: '2026-03-01', to: '2026-03-15'});
    render(<DateFilter column={column} />, {wrapper: Wrapper});

    const groups = getPickerInputs();
    // First group should contain "01", "03", "2026" sections
    const fromSpinbuttons = within(groups[0]).getAllByRole('spinbutton');
    const fromValues = fromSpinbuttons.map((s) => s.textContent);
    expect(fromValues).toContain('01');
    expect(fromValues).toContain('03');
    expect(fromValues).toContain('2026');
  });

  it('initializes "to" spinbuttons from an existing range value', () => {
    const column = createMockColumn({from: '2026-03-01', to: '2026-03-15'});
    render(<DateFilter column={column} />, {wrapper: Wrapper});

    const groups = getPickerInputs();
    const toSpinbuttons = within(groups[1]).getAllByRole('spinbutton');
    const toValues = toSpinbuttons.map((s) => s.textContent);
    expect(toValues).toContain('15');
    expect(toValues).toContain('03');
    expect(toValues).toContain('2026');
  });

  it('clears values and calls column.setFilterValue(undefined) on clear click', async () => {
    const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime});
    const column = createMockColumn({from: '2026-03-01', to: '2026-03-15'});
    render(<DateFilter column={column} />, {wrapper: Wrapper});

    // Find and click the clear button (not a calendar button)
    const allButtons = screen.getAllByRole('button');
    const clearButton = allButtons.find((btn) => !btn.getAttribute('aria-label')?.includes('Choose date'));
    expect(clearButton).toBeTruthy();

    await user.click(clearButton!);

    expect(column.setFilterValue).toHaveBeenCalledWith(undefined);
  });

  it('debounces filter updates after calendar selection', async () => {
    const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime});
    const column = createMockColumn();
    render(<DateFilter column={column} debounceMs={300} />, {wrapper: Wrapper});

    // Open the first calendar
    const calendarButtons = getCalendarButtons();
    await user.click(calendarButtons[0]);

    // Select a day in the calendar popup
    const dialog = screen.getByRole('dialog');
    const day15 = within(dialog).getByRole('gridcell', {name: '15'});
    await user.click(day15);

    // Not called yet (within debounce window)
    expect(column.setFilterValue).not.toHaveBeenCalled();

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(column.setFilterValue).toHaveBeenCalled();
      const callArg = vi.mocked(column.setFilterValue).mock.calls[0][0] as {from?: string; to?: string};
      expect(callArg.from).toMatch(/^\d{4}-\d{2}-15$/);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Single mode
// ---------------------------------------------------------------------------

describe('DateFilter — Single mode', () => {
  beforeEach(() => {
    vi.useFakeTimers({shouldAdvanceTime: true});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders one date picker input in single mode', () => {
    const column = createMockColumn();
    render(<DateFilter column={column} showRange={false} />, {wrapper: Wrapper});

    expect(getCalendarButtons()).toHaveLength(1);
  });

  it('does not render separator dash in single mode', () => {
    const column = createMockColumn();
    render(<DateFilter column={column} showRange={false} />, {wrapper: Wrapper});

    expect(screen.queryByText('-')).not.toBeInTheDocument();
  });

  it('initializes spinbuttons from an existing string filter value', () => {
    const column = createMockColumn('2026-06-15');
    render(<DateFilter column={column} showRange={false} />, {wrapper: Wrapper});

    const spinbuttons = screen.getAllByRole('spinbutton');
    const values = spinbuttons.map((s) => s.textContent);
    expect(values).toContain('15');
    expect(values).toContain('06');
    expect(values).toContain('2026');
  });

  it('shows clear button when value is present', () => {
    const column = createMockColumn('2026-06-15');
    render(<DateFilter column={column} showRange={false} />, {wrapper: Wrapper});

    const allButtons = screen.getAllByRole('button');
    const clearButtons = allButtons.filter((btn) => !btn.getAttribute('aria-label')?.includes('Choose date'));
    expect(clearButtons).toHaveLength(1);
  });

  it('clears value on clear button click', async () => {
    const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime});
    const column = createMockColumn('2026-06-15');
    render(<DateFilter column={column} showRange={false} />, {wrapper: Wrapper});

    const allButtons = screen.getAllByRole('button');
    const clearButton = allButtons.find((btn) => !btn.getAttribute('aria-label')?.includes('Choose date'));
    await user.click(clearButton!);

    expect(column.setFilterValue).toHaveBeenCalledWith(undefined);
  });

  it('does not show clear button when no value is set', () => {
    const column = createMockColumn();
    render(<DateFilter column={column} showRange={false} />, {wrapper: Wrapper});

    const allButtons = screen.getAllByRole('button');
    const clearButtons = allButtons.filter((btn) => !btn.getAttribute('aria-label')?.includes('Choose date'));
    expect(clearButtons).toHaveLength(0);
  });

  it('debounces filter updates after calendar selection', async () => {
    const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime});
    const column = createMockColumn();
    render(<DateFilter column={column} showRange={false} debounceMs={300} />, {wrapper: Wrapper});

    // Open calendar
    await user.click(getCalendarButtons()[0]);

    // Select a day
    const dialog = screen.getByRole('dialog');
    const day20 = within(dialog).getByRole('gridcell', {name: '20'});
    await user.click(day20);

    // Not called yet
    expect(column.setFilterValue).not.toHaveBeenCalled();

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(column.setFilterValue).toHaveBeenCalled();
      const callArg = vi.mocked(column.setFilterValue).mock.calls[0][0] as string;
      expect(callArg).toMatch(/^\d{4}-\d{2}-20$/);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Mode selection
// ---------------------------------------------------------------------------

describe('DateFilter — Mode selection', () => {
  it('defaults to range mode when showRange is not specified', () => {
    const column = createMockColumn();
    render(<DateFilter column={column} />, {wrapper: Wrapper});

    // Range mode = 2 calendar buttons + separator
    expect(getCalendarButtons()).toHaveLength(2);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('uses single mode when showRange=false', () => {
    const column = createMockColumn();
    render(<DateFilter column={column} showRange={false} />, {wrapper: Wrapper});

    expect(getCalendarButtons()).toHaveLength(1);
    expect(screen.queryByText('-')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — External sync
// ---------------------------------------------------------------------------

describe('DateFilter — External filter value sync', () => {
  it('syncs range inputs when mounted with a new filter value', () => {
    // First render with from=March
    const column1 = createMockColumn({from: '2026-03-01'});
    const {unmount} = render(<DateFilter column={column1} />, {wrapper: Wrapper});

    const groups1 = getPickerInputs();
    const fromValues = within(groups1[0])
      .getAllByRole('spinbutton')
      .map((s) => s.textContent);
    expect(fromValues).toContain('01');
    expect(fromValues).toContain('03');

    unmount();

    // Second render with different value — verifies initialization logic
    const column2 = createMockColumn({from: '2026-06-15', to: '2026-06-30'});
    render(<DateFilter column={column2} />, {wrapper: Wrapper});

    const groups2 = getPickerInputs();
    const newFrom = within(groups2[0])
      .getAllByRole('spinbutton')
      .map((s) => s.textContent);
    expect(newFrom).toContain('15');
    expect(newFrom).toContain('06');

    const newTo = within(groups2[1])
      .getAllByRole('spinbutton')
      .map((s) => s.textContent);
    expect(newTo).toContain('30');
    expect(newTo).toContain('06');
  });

  it('syncs single input when mounted with a new filter value', () => {
    // First render
    const column1 = createMockColumn('2026-03-01');
    const {unmount} = render(<DateFilter column={column1} showRange={false} />, {wrapper: Wrapper});

    const values = screen.getAllByRole('spinbutton').map((s) => s.textContent);
    expect(values).toContain('01');
    expect(values).toContain('03');

    unmount();

    // Second render with different value
    const column2 = createMockColumn('2026-12-25');
    render(<DateFilter column={column2} showRange={false} />, {wrapper: Wrapper});

    const updated = screen.getAllByRole('spinbutton').map((s) => s.textContent);
    expect(updated).toContain('25');
    expect(updated).toContain('12');
  });
});

// ===========================================================================
// KNOWN ISSUE — filters/DateFilter.tsx:70-77 (single) and 119-129 (range)
//
//   const [local, setLocal] = useState<Dayjs | null>(toDayjs(filterValue));
//   const [prev, setPrev] = useState(filterValue);
//   if (prev !== filterValue) {
//     setPrev(filterValue);
//     setLocal(toDayjs(filterValue));
//   }
//
// Same defect as the one written up at length in BooleanFilter.test.tsx: `column` is the
// only changing input and it is a stable object, so React Compiler caches the render
// against it, `getFilterValue()` is never re-read and the sync block never runs.
//
// The tests further up this file that swap column1 for column2 pass, because handing over
// a different column object is a real prop change. Nothing in the app does that. What the
// app does is leave the column in place and change its filter value, which is what these
// two tests do.
//
// EXPECTED TO FAIL until the filter value reaches the field as a real input, either as a
// prop from FilterPanel or with the component opted out via 'use no memo'.
// ===========================================================================
describe('KNOWN ISSUE — an external change to the filter must reach the pickers', () => {
  it('follows the column when a single date is set from elsewhere', () => {
    const column = createMockColumn();
    const {rerender} = render(<DateFilter column={column} showRange={false} />, {wrapper: Wrapper});

    // The toolbar reset and a restored persisted state both write through the column and
    // leave the component mounted with the same column object.
    column.setFilterValue('2026-06-15');
    rerender(<DateFilter column={column} showRange={false} />);

    expect(screen.getAllByRole('spinbutton').map((s) => s.textContent)).toContain('2026');
  });

  it('clears the range when the filter is removed from elsewhere', () => {
    const column = createMockColumn({from: '2026-03-01', to: '2026-03-15'});
    const {rerender} = render(<DateFilter column={column} />, {wrapper: Wrapper});

    column.setFilterValue(undefined);
    rerender(<DateFilter column={column} />);

    expect(screen.getAllByRole('spinbutton').map((s) => s.textContent)).not.toContain('2026');
  });
});

// ===========================================================================
// Emptying both pickers by hand, rather than through the clear button
// (DateFilter.tsx:140-141):
//
//   } else if (filterValue !== undefined) {
//     column.setFilterValue(undefined);
//   }
//
// The clear button takes its own path (`handleClear` writes `undefined` straight to the
// column), so every existing test here goes around this branch. A user deleting the
// digits out of the fields is the other way to end up with no range, and it is the one
// that happens by accident: half a typed date, then backspace.
//
// What it guards: if the debounce only ever wrote a value when there was one to write,
// the fields would sit empty while the table stayed filtered, and the row count would
// not match anything on screen.
// ===========================================================================
describe('DateFilter — emptying the fields removes the filter', () => {
  beforeEach(() => {
    vi.useFakeTimers({shouldAdvanceTime: true});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** MUI splits a date field into per-section spinbuttons; each needs its own delete. */
  async function emptyField(user: ReturnType<typeof userEvent.setup>, group: HTMLElement) {
    const sections = within(group).getAllByRole('spinbutton');
    for (const section of sections) {
      await user.click(section);
      await user.keyboard('{Backspace}');
    }
  }

  it('drops the filter once both dates are deleted', async () => {
    const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime});
    const column = createMockColumn({from: '2026-03-01', to: '2026-03-15'});
    render(<DateFilter column={column} debounceMs={0} />, {wrapper: Wrapper});

    const [fromGroup, toGroup] = getPickerInputs();
    await emptyField(user, fromGroup);
    await emptyField(user, toGroup);

    await waitFor(() => {
      expect(column.setFilterValue).toHaveBeenCalledWith(undefined);
    });
  });

  it('writes nothing more once the filter is already gone', async () => {
    // The guard on this branch is `filterValue !== undefined`. Without it the debounce
    // would rewrite `undefined` on every tick, and each write is a re-render of the whole
    // table.
    const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime});
    const column = createMockColumn();
    render(<DateFilter column={column} debounceMs={0} />, {wrapper: Wrapper});

    await emptyField(user, getPickerInputs()[0]);
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(column.setFilterValue).not.toHaveBeenCalled();
  });
});
