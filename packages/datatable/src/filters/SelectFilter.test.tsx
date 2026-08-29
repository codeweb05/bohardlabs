/**
 * Coverage for `SelectFilter`, previously 0%.
 *
 * Covers both single and multiple mode. Note that `FilterPanel` only ever renders
 * this in single mode (it never passes `multiple`), so the multi-select path is
 * currently unreachable from the DataTable itself — it is tested here because the
 * prop is part of the component's public surface.
 *
 * The last block guards a bug that has since been fixed; it is kept as a regression test.
 */
import type {ColumnDef, ColumnFiltersState} from '@tanstack/react-table';
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it} from 'vitest';

import {render} from '../test/test-utils';
import type {FilterOption} from '../types';
import {SelectFilter} from './SelectFilter';

interface Row {
  readonly status: string;
}

const data: Row[] = [{status: 'ACTIVE'}, {status: 'PENDING'}];
const columns: ColumnDef<Row>[] = [{id: 'status', accessorKey: 'status'}];

const statusOptions: FilterOption[] = [
  {value: 'ACTIVE', label: 'Active'},
  {value: 'PENDING', label: 'Pending'},
  {value: 'CLOSED', label: 'Closed'},
];

interface HarnessProps {
  readonly initial?: ColumnFiltersState;
  readonly options?: readonly FilterOption[];
  readonly placeholder?: string;
  readonly multiple?: boolean;
}

function Harness({initial = [], options = statusOptions, placeholder, multiple = false}: Readonly<HarnessProps>) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initial);
  const table = useReactTable({
    data,
    columns,
    state: {columnFilters},
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
  });
  const column = table.getColumn('status');

  return (
    <>
      <span data-testid="state">{JSON.stringify(columnFilters)}</span>
      {column ? (
        <SelectFilter column={column} options={options} placeholder={placeholder} multiple={multiple} debounceMs={0} />
      ) : null}
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

describe('SelectFilter — single', () => {
  it('shows the translated placeholder when nothing is selected', () => {
    render(<Harness />);

    expect(screen.getByRole('combobox')).toHaveTextContent('Select...');
  });

  it('prefers an explicit placeholder', () => {
    render(<Harness placeholder="Any status" />);

    expect(screen.getByRole('combobox')).toHaveTextContent('Any status');
  });

  it('commits the selected option value', async () => {
    render(<Harness />);

    await chooseOption('Pending');

    await waitFor(() => {
      expect(filterState()).toEqual([{id: 'status', value: 'PENDING'}]);
    });
  });

  it('renders the option label, not the raw value', async () => {
    render(<Harness initial={[{id: 'status', value: 'PENDING'}]} />);

    expect(screen.getByRole('combobox')).toHaveTextContent('Pending');
  });

  it('falls back to the raw value when no option matches', () => {
    // Persisted filter state can outlive an options list; showing the raw value beats
    // showing the placeholder while a filter is actually applied.
    render(<Harness initial={[{id: 'status', value: 'ARCHIVED'}]} />);

    expect(screen.getByRole('combobox')).toHaveTextContent('ARCHIVED');
  });

  it('offers an All entry that removes the filter', async () => {
    render(<Harness initial={[{id: 'status', value: 'ACTIVE'}]} />);

    await chooseOption('All');

    await waitFor(() => {
      expect(filterState()).toEqual([]);
    });
  });

  it('clears from the adornment button without opening the menu', async () => {
    render(<Harness initial={[{id: 'status', value: 'ACTIVE'}]} />);

    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(filterState()).toEqual([]);
    });
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('shows no clear adornment while empty', () => {
    render(<Harness />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('SelectFilter — multiple', () => {
  it('commits an array of values', async () => {
    render(<Harness multiple />);

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', {name: 'Active'}));
    await userEvent.click(screen.getByRole('option', {name: 'Closed'}));

    await waitFor(() => {
      expect(filterState()).toEqual([{id: 'status', value: ['ACTIVE', 'CLOSED']}]);
    });
  });

  it('renders each selection as a chip', () => {
    render(<Harness multiple initial={[{id: 'status', value: ['ACTIVE', 'PENDING']}]} />);

    const combobox = screen.getByRole('combobox');
    expect(within(combobox).getByText('Active')).toBeInTheDocument();
    expect(within(combobox).getByText('Pending')).toBeInTheDocument();
  });

  it('does not offer an All entry, which would be indistinguishable from an empty selection', async () => {
    render(<Harness multiple />);

    await userEvent.click(screen.getByRole('combobox'));

    expect(screen.queryByRole('option', {name: 'All'})).not.toBeInTheDocument();
  });

  it('removes the filter once the last selection is cleared', async () => {
    render(<Harness multiple initial={[{id: 'status', value: ['ACTIVE']}]} />);

    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(filterState()).toEqual([]);
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
describe('SelectFilter — re-rendering', () => {
  it('keeps the same dropdown when re-rendered with unchanged props', () => {
    render(<Harness placeholder="Any status" />).rerender(<Harness placeholder="Any status" />);

    expect(screen.getByText('Any status')).toBeInTheDocument();
  });
});

// ===========================================================================
// REGRESSION — filters/SelectFilter.tsx:61
//
//   column.setFilterValue(localValue || undefined)
//
// `||` treats every falsy option value as "no selection". A numeric option with the
// value 0 — a rating of 0, a priority of 0, a count of 0 — can be picked in the UI
// but never reaches the column filter, so the list does not change and the chosen
// option is then wiped by the sync-back on the next render.
//
// Failed when written; passes now that the check is
// `localValue === '' ? undefined : localValue` (the empty string is the only genuine
// "cleared" sentinel here).
// ===========================================================================
describe('Regression — a zero-valued select option must not be dropped', () => {
  const numericOptions: FilterOption[] = [
    {value: 0, label: 'Zero'},
    {value: 1, label: 'One'},
  ];

  it('commits a zero option value', async () => {
    render(<Harness options={numericOptions} />);

    await chooseOption('Zero');

    await waitFor(() => {
      expect(filterState()).toEqual([{id: 'status', value: 0}]);
    });
  });
});

// ===========================================================================
// KNOWN ISSUE — filters/SelectFilter.tsx:29-44
//
//   const filterValue = column.getFilterValue();
//   const computedValue: SelectFilterValue = multiple ? ... : ...;
//   const [localValue, setLocalValue] = useState<SelectFilterValue>(computedValue);
//   const [prevFilterValue, setPrevFilterValue] = useState(filterValue);
//   const [prevMultiple, setPrevMultiple] = useState(multiple);
//   if (prevFilterValue !== filterValue || prevMultiple !== multiple) { ... }
//
// Same defect as the one written up at length in BooleanFilter.test.tsx: `column` is a
// stable reference, so React Compiler caches the render against it, `getFilterValue()` is
// never re-read and the sync-during-render block is dead code. Coverage confirms it from
// the other side, those three lines are the only uncovered ones in the file.
//
// The `multiple` half of the same condition does work, because `multiple` is a real prop.
// That is what makes the block look reachable when the filter half never is.
//
// EXPECTED TO FAIL until the filter value reaches the field as a real input, either as a
// prop from FilterPanel or with the component opted out via 'use no memo'.
// ===========================================================================
describe('KNOWN ISSUE — an external change to the filter must reach the select', () => {
  /** Fully controlled: the value comes from outside, as it does after a reset. */
  function ControlledHarness({filters}: Readonly<{filters: ColumnFiltersState}>) {
    const table = useReactTable({
      data,
      columns,
      state: {columnFilters: filters},
      getCoreRowModel: getCoreRowModel(),
    });
    const column = table.getColumn('status');
    return column ? <SelectFilter column={column} options={statusOptions} debounceMs={0} /> : null;
  }

  it('follows the column when the filter is set from elsewhere', () => {
    const {rerender} = render(<ControlledHarness filters={[]} />);

    rerender(<ControlledHarness filters={[{id: 'status', value: 'ACTIVE'}]} />);

    expect(screen.getByRole('combobox')).toHaveTextContent('Active');
  });

  it('empties itself when the filter is cleared from elsewhere', () => {
    const {rerender} = render(<ControlledHarness filters={[{id: 'status', value: 'ACTIVE'}]} />);

    rerender(<ControlledHarness filters={[]} />);

    expect(screen.getByRole('combobox')).not.toHaveTextContent('Active');
  });
});
