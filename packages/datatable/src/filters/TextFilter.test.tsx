/**
 * Coverage for `TextFilter`, previously 0%.
 *
 * The column is a real TanStack column from a real table rather than a hand-rolled
 * mock, so `setFilterValue`'s auto-remove semantics (empty value -> the filter is
 * dropped, not stored as '') are exercised for real.
 */
import type {ColumnDef, ColumnFiltersState} from '@tanstack/react-table';
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it} from 'vitest';

import {render} from '../test/test-utils';
import {TextFilter} from './TextFilter';

interface Row {
  readonly name: string;
}

const data: Row[] = [{name: 'alpha'}, {name: 'beta'}];
const columns: ColumnDef<Row>[] = [{id: 'name', accessorKey: 'name'}];

interface HarnessProps {
  readonly initial?: ColumnFiltersState;
  readonly placeholder?: string;
  readonly debounceMs?: number;
}

function Harness({initial = [], placeholder, debounceMs = 0}: Readonly<HarnessProps>) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initial);
  const table = useReactTable({
    data,
    columns,
    state: {columnFilters},
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
  });
  const column = table.getColumn('name');

  return (
    <>
      <span data-testid="state">{JSON.stringify(columnFilters)}</span>
      {column ? <TextFilter column={column} placeholder={placeholder} debounceMs={debounceMs} /> : null}
    </>
  );
}

function filterState(): ColumnFiltersState {
  return JSON.parse(screen.getByTestId('state').textContent ?? '[]') as ColumnFiltersState;
}

describe('TextFilter', () => {
  it('falls back to the translated search placeholder', () => {
    render(<Harness />);

    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('prefers an explicit placeholder', () => {
    render(<Harness placeholder="Find a role" />);

    expect(screen.getByPlaceholderText('Find a role')).toBeInTheDocument();
  });

  it('commits the typed value to the column filter', async () => {
    render(<Harness />);

    await userEvent.type(screen.getByRole('textbox'), 'alp');

    await waitFor(() => {
      expect(filterState()).toEqual([{id: 'name', value: 'alp'}]);
    });
  });

  it('removes the filter rather than storing an empty string', async () => {
    // `setFilterValue('')` would leave a filter entry that every consumer then has
    // to special-case, and it would keep the active-filter badge lit.
    render(<Harness initial={[{id: 'name', value: 'alpha'}]} />);

    await userEvent.clear(screen.getByRole('textbox'));

    await waitFor(() => {
      expect(filterState()).toEqual([]);
    });
  });

  it('shows the clear button only once there is a value', async () => {
    render(<Harness />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox'), 'a');

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('clears the input and the filter from the clear button', async () => {
    render(<Harness initial={[{id: 'name', value: 'alpha'}]} />);

    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('textbox')).toHaveValue('');
    await waitFor(() => {
      expect(filterState()).toEqual([]);
    });
  });

  it('adopts a filter value set from outside the component', () => {
    // Restoring persisted table state sets the column filter directly; the input has
    // to follow or the user sees an empty box next to filtered rows.
    render(<Harness initial={[{id: 'name', value: 'beta'}]} />);

    expect(screen.getByRole('textbox')).toHaveValue('beta');
  });

  it('debounces so that typing does not fire a filter change per keystroke', async () => {
    render(<Harness debounceMs={200} />);

    await userEvent.type(screen.getByRole('textbox'), 'alpha');

    expect(filterState()).toEqual([]);
    await waitFor(() => {
      expect(filterState()).toEqual([{id: 'name', value: 'alpha'}]);
    });
  });
});

// ===========================================================================
// React Compiler memoizes these components, so a re-render with unchanged props takes
// the cache-hit path instead of rebuilding the element tree. Nothing else in this file
// reaches that path — every other test mounts once — and it is where a compiler bug or
// a prop mutated in place would surface, as a field that keeps painting a value the
// table has already moved on from.
// ===========================================================================
describe('TextFilter — re-rendering', () => {
  it('keeps the same box when re-rendered with unchanged props', () => {
    render(<Harness placeholder="Find a role" />).rerender(<Harness placeholder="Find a role" />);

    expect(screen.getByPlaceholderText('Find a role')).toBeInTheDocument();
  });
});

// ===========================================================================
// KNOWN ISSUE — filters/TextFilter.tsx:17-23
//
//   const filterValue = (column.getFilterValue() ?? '') as string;
//   const [localValue, setLocalValue] = useState(filterValue);
//   useEffect(() => {
//     setLocalValue(filterValue);
//   }, [filterValue]);
//
// Same defect as the one written up at length in BooleanFilter.test.tsx. `column` is the
// only changing input and `useReactTable` returns the same object on every render, so
// React Compiler caches this render against it: `getFilterValue()` is never re-read, the
// effect's dependency never changes, and the element tree is the identical object, so
// React skips the subtree.
//
// This one is worse than the dropdown filters because the box holds free text. After the
// toolbar clears every filter, the search box still shows the old term, and the user has
// to delete it by hand before the field will agree with the table it belongs to.
//
// EXPECTED TO FAIL until the filter value reaches the field as a real input, either as a
// prop from FilterPanel or with the component opted out via 'use no memo'.
// ===========================================================================
describe('KNOWN ISSUE — an external change to the filter must reach the text box', () => {
  /** Fully controlled: the value comes from outside, as it does after a reset. */
  function ControlledHarness({filters}: Readonly<{filters: ColumnFiltersState}>) {
    const table = useReactTable({
      data,
      columns,
      state: {columnFilters: filters},
      getCoreRowModel: getCoreRowModel(),
    });
    const column = table.getColumn('name');
    return column ? <TextFilter column={column} /> : null;
  }

  it('follows the column when the filter is set from elsewhere', () => {
    const {rerender} = render(<ControlledHarness filters={[]} />);

    rerender(<ControlledHarness filters={[{id: 'name', value: 'alpha'}]} />);

    expect(screen.getByRole('textbox')).toHaveValue('alpha');
  });

  it('empties itself when the filter is cleared from elsewhere', () => {
    const {rerender} = render(<ControlledHarness filters={[{id: 'name', value: 'alpha'}]} />);

    rerender(<ControlledHarness filters={[]} />);

    expect(screen.getByRole('textbox')).toHaveValue('');
  });
});
