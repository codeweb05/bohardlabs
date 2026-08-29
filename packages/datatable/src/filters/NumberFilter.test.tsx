/**
 * Coverage for `NumberFilter`, previously 0%.
 *
 * This is the most stateful of the filters: two local strings, an
 * adjust-state-during-render sync, a debounce per mode, a blur flush, and a flush on
 * unmount. Each of those is a place where a partially typed number can be lost, so
 * they are pinned down individually.
 *
 * The columns declare an explicit `filterFn` because TanStack's `auto` fn resolves
 * to `inNumberRange` for a numeric column, and that fn auto-removes any filter value
 * that is not a tuple — which would silently swallow single-mode values in the test
 * harness for reasons unrelated to this component.
 *
 * The two blocks at the bottom guard bugs that have since been fixed in
 * NumberFilter; they are kept as regression tests.
 */
import type {ColumnDef, ColumnFiltersState} from '@tanstack/react-table';
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it} from 'vitest';

import {render} from '../test/test-utils';
import {NumberFilter} from './NumberFilter';

interface Row {
  readonly amount: number;
}

const data: Row[] = [{amount: 5}, {amount: 50}];
const rangeColumns: ColumnDef<Row>[] = [{id: 'amount', accessorKey: 'amount', filterFn: 'inNumberRange'}];
const singleColumns: ColumnDef<Row>[] = [{id: 'amount', accessorKey: 'amount', filterFn: 'equals'}];

/** Long enough that only an explicit flush (blur / unmount) can commit within a test. */
const NO_AUTO_COMMIT = 60_000;

/**
 * Short, but not zero. At 0 ms the debounce fires between simulated keystrokes and
 * the sync-during-render races the typing — a harness artifact, not a real defect
 * (a production-sized debounce does not drop characters).
 */
const FAST_DEBOUNCE = 20;

interface HarnessProps {
  readonly initial?: ColumnFiltersState;
  readonly placeholder?: string;
  readonly min?: number;
  readonly max?: number;
  readonly showRange?: boolean;
  readonly debounceMs?: number;
  readonly mounted?: boolean;
}

function Harness({
  initial = [],
  placeholder,
  min,
  max,
  showRange = true,
  debounceMs = FAST_DEBOUNCE,
  mounted = true,
}: Readonly<HarnessProps>) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initial);
  const table = useReactTable({
    data,
    columns: showRange ? rangeColumns : singleColumns,
    state: {columnFilters},
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
  });
  const column = table.getColumn('amount');

  return (
    <>
      <span data-testid="state">{JSON.stringify(columnFilters)}</span>
      {column && mounted ? (
        <NumberFilter
          column={column}
          placeholder={placeholder}
          min={min}
          max={max}
          showRange={showRange}
          debounceMs={debounceMs}
        />
      ) : null}
    </>
  );
}

function filterState(): ColumnFiltersState {
  return JSON.parse(screen.getByTestId('state').textContent ?? '[]') as ColumnFiltersState;
}

/**
 * Waits past the debounce so an assertion sees the committed result rather than the
 * still-pending local state. Needed by the NaN block below, where the defect only
 * appears once the debounce has run and synced back.
 */
function settleDebounce(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, FAST_DEBOUNCE * 6);
  });
}

const minInput = () => screen.getByPlaceholderText('Min');
const maxInput = () => screen.getByPlaceholderText('Max');

describe('NumberFilter — range mode', () => {
  it('commits both bounds as a tuple', async () => {
    render(<Harness />);

    await userEvent.type(minInput(), '10');
    await userEvent.type(maxInput(), '20');

    await waitFor(() => {
      expect(filterState()).toEqual([{id: 'amount', value: [10, 20]}]);
    });
  });

  it('leaves the absent bound null rather than dropping the filter', async () => {
    // `inNumberRange` reads the tuple positionally, so an open-ended range has to be
    // [10, null] — collapsing it to a bare 10 would silently become an equality match.
    render(<Harness />);

    await userEvent.type(minInput(), '10');

    await waitFor(() => {
      expect(filterState()).toEqual([{id: 'amount', value: [10, null]}]);
    });
  });

  it('removes the filter when both bounds are emptied', async () => {
    render(<Harness initial={[{id: 'amount', value: [10, 20]}]} />);

    await userEvent.clear(minInput());
    await userEvent.clear(maxInput());

    await waitFor(() => {
      expect(filterState()).toEqual([]);
    });
  });

  it('restores both inputs from an externally set filter value', () => {
    render(<Harness initial={[{id: 'amount', value: [10, 20]}]} />);

    expect(minInput()).toHaveValue('10');
    expect(maxInput()).toHaveValue('20');
  });

  it('shows the clear button only once a bound is entered, and resets both', async () => {
    render(<Harness />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    await userEvent.type(minInput(), '10');
    await userEvent.type(maxInput(), '20');
    await userEvent.click(screen.getByRole('button'));

    expect(minInput()).toHaveValue('');
    expect(maxInput()).toHaveValue('');
    await waitFor(() => {
      expect(filterState()).toEqual([]);
    });
  });

  it('rejects characters that are not part of a number', async () => {
    render(<Harness />);

    await userEvent.type(minInput(), '1a2');

    expect(minInput()).toHaveValue('12');
  });

  it('keeps a half-typed decimal in the box', async () => {
    // With type="number" the browser reports '' for "5.", which used to wipe the
    // input mid-typing. The text input plus partial-number regex is what prevents it.
    render(<Harness />);

    await userEvent.type(minInput(), '5.');

    expect(minInput()).toHaveValue('5.');
    await waitFor(() => {
      expect(filterState()).toEqual([{id: 'amount', value: [5, null]}]);
    });
  });

  it('rejects a leading minus when the configured minimum is zero', async () => {
    render(<Harness min={0} />);

    await userEvent.type(minInput(), '-5');

    expect(minInput()).toHaveValue('5');
  });

  it('commits on blur without waiting out the debounce', async () => {
    // Closing behaviour users rely on: tab out of the field and the list updates.
    render(<Harness debounceMs={NO_AUTO_COMMIT} />);

    await userEvent.type(minInput(), '10');
    expect(filterState()).toEqual([]);

    await userEvent.tab();

    await waitFor(() => {
      expect(filterState()).toEqual([{id: 'amount', value: [10, null]}]);
    });
  });

  it('flushes a pending value when the filter drawer unmounts it', async () => {
    // Closing the drawer must not throw away a number the user just typed.
    const {rerender} = render(<Harness debounceMs={NO_AUTO_COMMIT} />);

    await userEvent.type(minInput(), '10');
    rerender(<Harness debounceMs={NO_AUTO_COMMIT} mounted={false} />);

    await waitFor(() => {
      expect(filterState()).toEqual([{id: 'amount', value: [10, null]}]);
    });
  });
});

describe('NumberFilter — single mode', () => {
  it('renders one input with the translated placeholder', () => {
    render(<Harness showRange={false} />);

    expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Min')).not.toBeInTheDocument();
  });

  it('prefers an explicit placeholder', () => {
    render(<Harness showRange={false} placeholder="Exact amount" />);

    expect(screen.getByPlaceholderText('Exact amount')).toBeInTheDocument();
  });

  it('commits a plain number, not a tuple', async () => {
    render(<Harness showRange={false} />);

    await userEvent.type(screen.getByRole('textbox'), '42');

    await waitFor(() => {
      expect(filterState()).toEqual([{id: 'amount', value: 42}]);
    });
  });

  it('restores the input from an externally set number', () => {
    render(<Harness showRange={false} initial={[{id: 'amount', value: 42}]} />);

    expect(screen.getByRole('textbox')).toHaveValue('42');
  });

  it('clears the value and the filter from the clear button', async () => {
    render(<Harness showRange={false} initial={[{id: 'amount', value: 42}]} />);

    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('textbox')).toHaveValue('');
    await waitFor(() => {
      expect(filterState()).toEqual([]);
    });
  });

  it('stays in single mode even though the filter value is a number', () => {
    // `isRangeMode` is derived from the current filter value, so a number-shaped
    // value must not flip a showRange={false} filter back into two inputs.
    render(<Harness showRange={false} initial={[{id: 'amount', value: 42}]} />);

    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });
});

describe('NumberFilter — documented gaps', () => {
  it('accepts a value above the configured max, because max is never read', async () => {
    // NOT a passing-by-design assertion: `max` is declared in NumberFilterProps and
    // forwarded by FilterPanel from `filterConfig.max`, but the component never
    // destructures it, so the bound is inert. `min` is barely better — it only
    // decides whether a leading minus is allowed, it does not clamp.
    // Decide the intended contract (clamp, validate, or drop the props) before this
    // ships as a package; this test only records today's behaviour.
    render(<Harness max={10} debounceMs={NO_AUTO_COMMIT} />);

    await userEvent.type(minInput(), '999');

    expect(minInput()).toHaveValue('999');
  });

  it('labels the range inputs with hardcoded English', () => {
    // "Min" / "Max" are literals in the component. Every other user-facing string in
    // this repo comes from `src/lib/i18n/locales/en.json`; these two do not, so they
    // will not translate. Recorded here so the fix is not forgotten.
    render(<Harness />);

    expect(screen.getByPlaceholderText('Min')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Max')).toBeInTheDocument();
  });
});

// ===========================================================================
// React Compiler memoizes these components, so a re-render with unchanged props takes
// the cache-hit path instead of rebuilding the element tree. Nothing else in this file
// reaches that path — every other test mounts once — and it is where a compiler bug or
// a prop mutated in place would surface, as a field that keeps painting a value the
// table has already moved on from.
// ===========================================================================
describe('NumberFilter — re-rendering', () => {
  it('keeps the same range boxes when re-rendered with unchanged props', () => {
    const initial = [{id: 'amount', value: [10, 20]}];
    render(<Harness initial={initial} />).rerender(<Harness initial={initial} />);

    expect(screen.getAllByRole('textbox')).toHaveLength(2);
  });
});

// ===========================================================================
// REGRESSION — filters/NumberFilter.tsx (now `toBound` / `toRangeValue`)
//
// The partial-number regex deliberately accepts an incomplete entry ("-", ".",
// "-."), but the debounce does not:
//
//   const minVal = localMin ? Number(localMin) : null;   // Number('-') === NaN
//   if (minVal !== null || maxVal !== null) setFilterValue([minVal, maxVal]);
//
// NaN is not null, so `[NaN, null]` is committed. The sync-back then runs
// `syncedField('-', NaN)`, `Number('-') === NaN` is false (NaN never equals itself),
// and the field is overwritten with `String(NaN)` — the user watches the box they
// are typing in turn into the literal text "NaN". The bad tuple is also handed to
// the row model and persisted, where `JSON.stringify` turns it into `[null, null]`.
//
// Failed when written; passes now that incomplete entries are treated as absent bounds
// (`Number.isFinite` guard before committing, and in `syncedField`).
// ===========================================================================
describe('Regression — an incomplete number must not be committed as NaN', () => {
  it('keeps a lone minus sign in the box instead of replacing it with "NaN"', async () => {
    render(<Harness />);

    await userEvent.type(minInput(), '-');
    await settleDebounce();

    expect(minInput()).toHaveValue('-');
  });

  it('lets the user finish typing a negative bound', async () => {
    render(<Harness />);

    await userEvent.type(minInput(), '-');
    await settleDebounce();
    await userEvent.type(minInput(), '5');
    await settleDebounce();

    expect(minInput()).toHaveValue('-5');
    expect(filterState()).toEqual([{id: 'amount', value: [-5, null]}]);
  });

  it('keeps a lone decimal point in the box', async () => {
    render(<Harness />);

    await userEvent.type(maxInput(), '.');
    await settleDebounce();

    expect(maxInput()).toHaveValue('.');
  });

  it('does not commit a filter for an incomplete entry', async () => {
    render(<Harness />);

    await userEvent.type(minInput(), '-');
    await settleDebounce();

    expect(filterState()).toEqual([]);
  });
});

// ===========================================================================
// REGRESSION — filters/NumberFilter.tsx (now `commitFilterValue`)
//
//   useEffect(() => flushFilter, [])
//
// The unmount flush runs unconditionally. When the user opens the filter drawer,
// touches nothing, and closes it, `flushFilter` still calls
// `setFilterValue(undefined)`. TanStack's auto-remove path returns a NEW
// columnFilters array even when there was nothing to remove, so
// `onColumnFiltersChange` fires, the DataTable emits new server state, and the list
// query refetches for a filter change that never happened.
//
// Failed when written; passes now that `commitFilterValue` skips the write when the
// pending value already matches the committed one.
// ===========================================================================
describe('Regression — unmount must not flush when nothing was typed', () => {
  it('does not touch the column filters when it unmounts untouched', () => {
    let changeCount = 0;

    function CountingHarness({mounted}: Readonly<{mounted: boolean}>) {
      const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
      const table = useReactTable({
        data,
        columns: rangeColumns,
        state: {columnFilters},
        onColumnFiltersChange: (updater) => {
          changeCount += 1;
          setColumnFilters(updater);
        },
        getCoreRowModel: getCoreRowModel(),
      });
      const column = table.getColumn('amount');
      return column && mounted ? <NumberFilter column={column} debounceMs={NO_AUTO_COMMIT} /> : null;
    }

    const {rerender} = render(<CountingHarness mounted />);
    rerender(<CountingHarness mounted={false} />);

    expect(changeCount).toBe(0);
  });
});

// ===========================================================================
// filters/NumberFilter.tsx:97-163 — the resync every other filter in this folder lacks
//
//   const filterValue = column.getFilterValue() as NumberFilterValue;
//   const filterValueKey = JSON.stringify(filterValue ?? null);
//   const [prevFilterValueKey, setPrevFilterValueKey] = useState(filterValueKey);
//   if (filterValueKey !== prevFilterValueKey) { ...resync every local input... }
//
// Its four siblings carry the same block and none of them run it: `column` is a stable
// object, React Compiler caches the render against it, and `getFilterValue()` is never
// re-read (written up at length in BooleanFilter.test.tsx, with a KNOWN ISSUE test in
// each of the four). NumberFilter is the exception, these two tests pass.
//
// So this pair is a working reference for the fix, and a guard that whatever makes this
// component behave is not refactored away. Do not delete them when the sibling filters
// are fixed.
// ===========================================================================
describe('NumberFilter — an external change to the filter reaches the inputs', () => {
  /** Fully controlled: the value comes from outside, as it does after a reset. */
  function ControlledHarness({filters}: Readonly<{filters: ColumnFiltersState}>) {
    const table = useReactTable({
      data,
      columns: rangeColumns,
      state: {columnFilters: filters},
      getCoreRowModel: getCoreRowModel(),
    });
    const column = table.getColumn('amount');
    return column ? <NumberFilter column={column} showRange debounceMs={NO_AUTO_COMMIT} /> : null;
  }

  it('follows the column when the range is set from elsewhere', () => {
    const {rerender} = render(<ControlledHarness filters={[]} />);

    rerender(<ControlledHarness filters={[{id: 'amount', value: [10, 20]}]} />);

    expect(minInput()).toHaveValue('10');
    expect(maxInput()).toHaveValue('20');
  });

  it('empties both bounds when the filter is cleared from elsewhere', () => {
    const {rerender} = render(<ControlledHarness filters={[{id: 'amount', value: [10, 20]}]} />);

    rerender(<ControlledHarness filters={[]} />);

    expect(minInput()).toHaveValue('');
    expect(maxInput()).toHaveValue('');
  });
});
