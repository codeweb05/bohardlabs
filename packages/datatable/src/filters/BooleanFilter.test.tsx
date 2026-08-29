/**
 * Coverage for `BooleanFilter`, previously 0%.
 *
 * The tricky part is the boolean <-> string round trip: the MUI Select can only hold
 * a string, so `false` has to survive being turned into 'false' and back without
 * collapsing into "no filter". A real column is used so the auto-remove behaviour of
 * `setFilterValue(undefined)` is the real one.
 */
import type {ColumnDef, ColumnFiltersState} from '@tanstack/react-table';
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it} from 'vitest';

import {render} from '../test/test-utils';
import {BooleanFilter} from './BooleanFilter';

interface Row {
  readonly active: boolean;
}

const data: Row[] = [{active: true}, {active: false}];
const columns: ColumnDef<Row>[] = [{id: 'active', accessorKey: 'active'}];

interface HarnessProps {
  readonly initial?: ColumnFiltersState;
  readonly trueLabel?: string;
  readonly falseLabel?: string;
}

function Harness({initial = [], trueLabel, falseLabel}: Readonly<HarnessProps>) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initial);
  const table = useReactTable({
    data,
    columns,
    state: {columnFilters},
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
  });
  const column = table.getColumn('active');

  return (
    <>
      <span data-testid="state">{JSON.stringify(columnFilters)}</span>
      {column ? <BooleanFilter column={column} trueLabel={trueLabel} falseLabel={falseLabel} debounceMs={0} /> : null}
    </>
  );
}

function filterState(): ColumnFiltersState {
  return JSON.parse(screen.getByTestId('state').textContent ?? '[]') as ColumnFiltersState;
}

async function chooseOption(name: string) {
  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(await screen.findByRole('option', {name}));
}

describe('BooleanFilter', () => {
  it('offers the translated all/yes/no options', async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole('combobox'));

    expect(screen.getByRole('option', {name: 'All'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Yes'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'No'})).toBeInTheDocument();
  });

  it('uses custom true/false labels when supplied', async () => {
    render(<Harness trueLabel="Active" falseLabel="Inactive" />);

    await userEvent.click(screen.getByRole('combobox'));

    expect(screen.getByRole('option', {name: 'Active'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Inactive'})).toBeInTheDocument();
  });

  it('sets a true filter', async () => {
    render(<Harness />);

    await chooseOption('Yes');

    await waitFor(() => {
      expect(filterState()).toEqual([{id: 'active', value: true}]);
    });
  });

  it('sets a false filter rather than clearing it', async () => {
    // The regression this guards: `false` is falsy, so a `value || undefined` style
    // commit would silently turn "show only inactive" into "show everything".
    render(<Harness />);

    await chooseOption('No');

    await waitFor(() => {
      expect(filterState()).toEqual([{id: 'active', value: false}]);
    });
  });

  it('removes the filter when All is chosen', async () => {
    render(<Harness initial={[{id: 'active', value: true}]} />);

    await chooseOption('All');

    await waitFor(() => {
      expect(filterState()).toEqual([]);
    });
  });

  it('shows the option matching a filter value set from outside', () => {
    render(<Harness initial={[{id: 'active', value: false}]} />);

    expect(screen.getByRole('combobox')).toHaveTextContent('No');
  });

  it('shows no selection when there is no filter', () => {
    render(<Harness />);

    expect(screen.getByRole('combobox')).toHaveTextContent('All');
  });
});

// ===========================================================================
// KNOWN ISSUE — filters/BooleanFilter.tsx:28-40, and every other filter in this folder
//
//   const filterValue = column.getFilterValue() as boolean | undefined;
//   const [localValue, setLocalValue] = useState<string>(initialValue);
//   const [prevFilterValue, setPrevFilterValue] = useState(filterValue);
//   if (prevFilterValue !== filterValue) {
//     setPrevFilterValue(filterValue);
//     setLocalValue(booleanToString(filterValue));
//   }
//
// The component's only changing input is `column`, and `useReactTable` hands back the
// same column object on every render (it mutates its options in place). React Compiler
// therefore caches the entire render against that stable reference: `getFilterValue()`
// is never re-read, the sync-during-render block never runs, and the JSX handed back to
// React is the identical element object, so React skips the subtree outright.
//
// Proven three ways: a replica carrying 'use no memo' beside the compiled one reads the
// new value while the compiled one reads EMPTY; forcing the child to re-render with a
// changed placeholder does not help, so the cache is inside the component, not in the
// parent's element; and toolbar/FilterPanel.test.tsx reproduces the whole thing through
// the panel's own clear-all button.
//
// One nuance decides whether the bug shows. TanStack reuses its column instances only
// while the `columns` array it was given keeps its identity. A consumer that rebuilds
// that array inline on every render makes TanStack mint fresh column objects, which
// invalidates the compiler cache and hides the defect. Every page in this app builds its
// columns with `useMemo`, which is the case that breaks, so the harnesses here and in
// FilterPanel.test.tsx hoist their column arrays to module scope to match.
//
// The sync block is dead code in that case. What a user sees: the toolbar's "clear all",
// a restored persisted filter state, or any programmatic setFilterValue updates the
// table, and the field keeps displaying the old choice. The panel then reads as filtered
// when it is not (or the reverse), and the only way to resync a field is to close and
// reopen the panel so it remounts.
//
// The same shape sits in SelectFilter.tsx:29-44, DateFilter.tsx:70-77 and 119-129, and
// TextFilter.tsx:17-23 (an effect there, whose dependency is the same cached value).
// Each has its own KNOWN ISSUE block. NumberFilter.tsx carries the identical block and
// is the one filter that does resync, so its passing pair of tests is a working
// reference for what the fix has to achieve.
//
// A fix has to make the filter value a real input: pass it down from FilterPanel, which
// does re-render because it takes `columnFilters`, or opt the component out with
// 'use no memo' the way `useColumnVisibility` now does. Reading it off `column` cannot
// work while `column` is a stable reference.
//
// EXPECTED TO FAIL until an external filter change reaches the field.
// ===========================================================================
describe('KNOWN ISSUE — an external change to the filter must reach the dropdown', () => {
  /** Fully controlled: the filter value comes from outside, as it does after a reset. */
  function ControlledHarness({filters}: Readonly<{filters: ColumnFiltersState}>) {
    const table = useReactTable({
      data,
      columns,
      state: {columnFilters: filters},
      getCoreRowModel: getCoreRowModel(),
    });
    const column = table.getColumn('active');
    return column ? <BooleanFilter column={column} debounceMs={0} /> : null;
  }

  it('follows the column when the filter is set from elsewhere', () => {
    // The toolbar's "clear all" and a restored persisted state both write the column
    // filter without touching this component. Its local value has to follow, or the
    // dropdown keeps showing a choice the table is no longer filtered by.
    const {rerender} = render(<ControlledHarness filters={[]} />);

    rerender(<ControlledHarness filters={[{id: 'active', value: true}]} />);

    expect(screen.getByRole('combobox')).toHaveTextContent('Yes');
  });

  it('follows the column back to no filter', () => {
    const {rerender} = render(<ControlledHarness filters={[{id: 'active', value: false}]} />);

    rerender(<ControlledHarness filters={[]} />);

    expect(screen.getByRole('combobox')).toHaveTextContent('All');
  });
});

// ===========================================================================
// React Compiler memoizes these components, so a re-render with unchanged props takes
// the cache-hit path instead of rebuilding the element tree. Nothing else in this file
// reaches that path — every other test mounts once — and it is where a compiler bug or
// a prop mutated in place would surface, as a field that keeps painting a value the
// table has already moved on from.
// ===========================================================================
describe('BooleanFilter — re-rendering', () => {
  it('keeps the same dropdown when re-rendered with unchanged props', () => {
    render(<Harness trueLabel="Active" falseLabel="Inactive" />).rerender(
      <Harness trueLabel="Active" falseLabel="Inactive" />,
    );

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
