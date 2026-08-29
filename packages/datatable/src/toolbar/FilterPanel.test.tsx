/**
 * Coverage for `FilterPanel`, previously 89% of lines and 50% of functions.
 *
 * The panel had no test file of its own — everything it did was reached incidentally
 * through `DataTable` tests, which never opened the drawer. That left `renderFilter`,
 * the switch that decides which of the five filter components a column gets, entirely
 * unexercised. It is the one place a consumer's `filterConfig.type` is interpreted, so
 * a wrong branch there means a column silently gets a text box instead of the picker
 * it asked for.

 */
import {LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import type {ColumnDef, ColumnFiltersState} from '@tanstack/react-table';
import {getCoreRowModel, getFilteredRowModel, useReactTable} from '@tanstack/react-table';
import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';

import {DEFAULT_LABELS} from '../i18n';
import {render} from '../test/test-utils';
import type {DataTableColumnDef} from '../types';
import {FilterPanel} from './FilterPanel';

interface Item {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly status: string;
  readonly active: boolean;
  readonly createdAt: string;
  readonly [key: string]: unknown;
}

const data: Item[] = [
  {id: 'item-1', name: 'Detergent', quantity: 2, status: 'ACTIVE', active: true, createdAt: '2026-01-05'},
];

/** A single text column, so a test that opens the drawer sees exactly one filter. */
const nameColumn: DataTableColumnDef<Item> = {id: 'name', accessorKey: 'name', header: 'Name'};

interface HarnessProps {
  readonly columns: readonly DataTableColumnDef<Item>[];
  readonly onReset?: () => void;
  readonly initialFilters?: ColumnFiltersState;
}

function Harness({columns, onReset, initialFilters = []}: Readonly<HarnessProps>) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initialFilters);
  const table = useReactTable({
    data,
    columns: columns as ColumnDef<Item>[],
    state: {columnFilters},
    onColumnFiltersChange: setColumnFilters,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // Spread rather than pass `onReset={undefined}`: the panel's "clear all" visibility
  // turns on the prop being absent, which an explicit undefined would not distinguish.
  const resetProps = onReset ? {onReset} : {};

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <FilterPanel table={table} columns={columns} columnFilters={columnFilters} {...resetProps} />
      <p>{`filters: ${JSON.stringify(columnFilters)}`}</p>
    </LocalizationProvider>
  );
}

const FILTERS_LABEL = 'Filters';

function renderPanel(props: HarnessProps) {
  return render(<Harness {...props} />);
}

/** Opens the drawer and returns the panel body, so queries cannot match the trigger. */
async function openPanel(props: HarnessProps): Promise<HTMLElement> {
  renderPanel(props);
  await userEvent.click(screen.getByRole('button', {name: FILTERS_LABEL}));
  return screen.findByRole('presentation');
}

describe('FilterPanel — the trigger', () => {
  it('names the trigger from the translation bundle', () => {
    renderPanel({columns: [nameColumn]});

    expect(screen.getByRole('button', {name: DEFAULT_LABELS.filters})).toBeInTheDocument();
  });

  it('counts the active column filters on the badge', () => {
    // The badge is the only signal that a filtered list is filtered once the drawer is
    // shut, so an off-by-one here hides the reason a table looks empty.
    renderPanel({
      columns: [nameColumn, {id: 'status', accessorKey: 'status', header: 'Status'}],
      initialFilters: [
        {id: 'name', value: 'Det'},
        {id: 'status', value: 'ACTIVE'},
      ],
    });

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows no count when nothing is filtered', () => {
    renderPanel({columns: [nameColumn]});

    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('keeps the drawer shut until the trigger is pressed', () => {
    renderPanel({columns: [nameColumn]});

    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
  });

  it('opens the drawer on the trigger', async () => {
    const panel = await openPanel({columns: [nameColumn]});

    expect(within(panel).getByText(DEFAULT_LABELS.filters)).toBeInTheDocument();
  });

  it('closes the drawer on Escape', async () => {
    // The Drawer's own `onClose` (FilterPanel.tsx:191) is what Escape and a backdrop
    // click go through, and it is a separate handler from the close button above. On a
    // phone the drawer covers most of the screen, so a dismissal that does not reset
    // `open` leaves the page unusable.
    await openPanel({columns: [nameColumn]});

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
    });
  });

  it('reopens after being dismissed', async () => {
    // Proves the dismissal actually wrote `false` back into state rather than the node
    // simply unmounting: a stuck `open` flag would make the trigger a no-op afterwards.
    await openPanel({columns: [nameColumn]});
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', {name: FILTERS_LABEL}));

    expect(await screen.findByRole('presentation')).toBeInTheDocument();
  });

  it('closes the drawer from the close button', async () => {
    const panel = await openPanel({columns: [nameColumn]});

    await userEvent.click(within(panel).getByRole('button', {name: DEFAULT_LABELS.close}));

    // The drawer fades out, so the node outlives the click by a frame.
    await waitFor(() => {
      expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
    });
  });
});

describe('FilterPanel — which columns get a filter', () => {
  it('leaves the selection and action columns out', async () => {
    // Neither holds a value to filter on; offering them a text box filters every row
    // out against a column that has no data behind it.
    const panel = await openPanel({
      columns: [{id: 'select', header: 'Select'}, nameColumn, {id: 'actions', header: 'Actions'}],
    });

    expect(within(panel).queryByText('Select')).not.toBeInTheDocument();
    expect(within(panel).queryByText('Actions')).not.toBeInTheDocument();
    expect(within(panel).getByText('Name')).toBeInTheDocument();
  });

  it('leaves out a column that opts out of filtering', async () => {
    const panel = await openPanel({
      columns: [nameColumn, {id: 'status', accessorKey: 'status', header: 'Status', enableFiltering: false}],
    });

    expect(within(panel).queryByText('Status')).not.toBeInTheDocument();
  });

  it('keeps a column that opts in explicitly', async () => {
    // The check is `!== false`, so `true` and an absent flag have to behave alike.
    const panel = await openPanel({
      columns: [{id: 'status', accessorKey: 'status', header: 'Status', enableFiltering: true}],
    });

    expect(within(panel).getByText('Status')).toBeInTheDocument();
  });

  it('says so when no column can be filtered', async () => {
    const panel = await openPanel({
      columns: [
        {id: 'select', header: 'Select'},
        {id: 'actions', header: 'Actions'},
      ],
    });

    expect(within(panel).getByText(DEFAULT_LABELS.noActiveFilters)).toBeInTheDocument();
  });

  it('labels a column with its header, falling back to the id', async () => {
    // A header rendered as an element cannot be printed above the field, and an
    // unlabelled filter is unusable once a table has more than one.
    const panel = await openPanel({
      columns: [nameColumn, {id: 'status', accessorKey: 'status', header: () => <span>Status</span>}],
    });

    expect(within(panel).getByText('Name')).toBeInTheDocument();
    expect(within(panel).getByText('status')).toBeInTheDocument();
  });
});

describe('FilterPanel — the filter each column gets', () => {
  it('gives a column with no filterConfig a text box', async () => {
    const panel = await openPanel({columns: [nameColumn]});

    expect(within(panel).getByPlaceholderText(DEFAULT_LABELS.search)).toBeInTheDocument();
  });

  it('passes the configured placeholder to a text filter', async () => {
    const panel = await openPanel({
      columns: [{...nameColumn, filterConfig: {type: 'text', placeholder: 'Find a product'}}],
    });

    expect(within(panel).getByPlaceholderText('Find a product')).toBeInTheDocument();
  });

  it('gives a select column a dropdown of its options', async () => {
    const panel = await openPanel({
      columns: [
        {
          id: 'status',
          accessorKey: 'status',
          header: 'Status',
          filterConfig: {
            type: 'select',
            placeholder: 'Any status',
            options: [{label: 'Active', value: 'ACTIVE'}],
          },
        },
      ],
    });

    await userEvent.click(within(panel).getByRole('combobox'));

    expect(await screen.findByRole('option', {name: 'Active'})).toBeInTheDocument();
  });

  it('falls back to an empty option list when a select column configures none', async () => {
    // `options ?? []` — a select column whose options are still loading must render an
    // empty dropdown rather than throwing on `.map` of undefined.
    const panel = await openPanel({
      columns: [{id: 'status', accessorKey: 'status', header: 'Status', filterConfig: {type: 'select'}}],
    });

    expect(within(panel).getByRole('combobox')).toBeInTheDocument();
  });

  it('gives a number column a min and a max box', async () => {
    const panel = await openPanel({
      columns: [
        {id: 'quantity', accessorKey: 'quantity', header: 'Quantity', filterConfig: {type: 'number', min: 0, max: 99}},
      ],
    });

    expect(within(panel).getAllByRole('textbox')).toHaveLength(2);
  });

  it('gives a date column a date picker', async () => {
    const panel = await openPanel({
      columns: [{id: 'createdAt', accessorKey: 'createdAt', header: 'Created', filterConfig: {type: 'date'}}],
    });

    expect(within(panel).getAllByRole('group').length).toBeGreaterThan(0);
  });

  it('gives a boolean column a yes/no dropdown', async () => {
    const panel = await openPanel({
      columns: [{id: 'active', accessorKey: 'active', header: 'Active', filterConfig: {type: 'boolean'}}],
    });

    await userEvent.click(within(panel).getByRole('combobox'));

    expect(await screen.findByRole('option', {name: DEFAULT_LABELS.yes})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: DEFAULT_LABELS.no})).toBeInTheDocument();
  });

  it('renders a custom filter and wires its onChange to the column', async () => {
    // The custom branch is the panel's escape hatch. If `onChange` is not connected to
    // `setFilterValue`, a consumer's filter renders and does nothing at all.
    const panel = await openPanel({
      columns: [
        {
          ...nameColumn,
          filterConfig: {
            type: 'custom',
            renderFilter: ({value, onChange}) => (
              <button type="button" onClick={() => onChange('Detergent')}>
                {`custom filter: ${String(value ?? 'none')}`}
              </button>
            ),
          },
        },
      ],
    });

    await userEvent.click(within(panel).getByRole('button', {name: 'custom filter: none'}));

    expect(screen.getByText('filters: [{"id":"name","value":"Detergent"}]')).toBeInTheDocument();
  });

  it('falls back to a text box when a custom column supplies no renderer', async () => {
    // Declaring `type: 'custom'` and forgetting the renderer must not leave the column
    // with no filter at all.
    const panel = await openPanel({
      columns: [{...nameColumn, filterConfig: {type: 'custom', placeholder: 'Find a product'}}],
    });

    expect(within(panel).getByPlaceholderText('Find a product')).toBeInTheDocument();
  });
});

describe('FilterPanel — clearing', () => {
  it('calls onReset from the clear-all button', async () => {
    const onReset = vi.fn();
    const panel = await openPanel({columns: [nameColumn], onReset, initialFilters: [{id: 'name', value: 'Det'}]});

    await userEvent.click(within(panel).getByRole('button', {name: DEFAULT_LABELS.clearAll}));

    expect(onReset).toHaveBeenCalledOnce();
  });

  it('hides the clear-all button while nothing is filtered', async () => {
    // It stays mounted for layout, so the assertion is on the computed style rather
    // than on the node being gone. Queried by text: a role query filters out whatever
    // the accessibility tree already hides, which is the thing under test.
    const panel = await openPanel({columns: [nameColumn], onReset: vi.fn()});

    expect(within(panel).getByText(DEFAULT_LABELS.clearAll)).toHaveStyle({visibility: 'hidden'});
  });

  it('hides the clear-all button when the consumer supplied no reset handler', async () => {
    // An active filter is not enough on its own: with no handler the button has nothing
    // to call, so it must not invite the click.
    const panel = await openPanel({columns: [nameColumn], initialFilters: [{id: 'name', value: 'Det'}]});

    expect(within(panel).getByText(DEFAULT_LABELS.clearAll)).toHaveStyle({visibility: 'hidden'});
  });
});

describe('FilterPanel — reading the current column definitions', () => {
  it('picks up options that arrive after the first render', async () => {
    // Why the panel keeps its own `columnDefById` map: TanStack caches the columnDef on
    // the column instance at creation, so a select whose options load asynchronously
    // would stay permanently empty if the panel read `column.columnDef`.
    const withOptions = (options: readonly {label: string; value: string}[]): DataTableColumnDef<Item>[] => [
      {id: 'status', accessorKey: 'status', header: 'Status', filterConfig: {type: 'select', options}},
    ];
    const {rerender} = renderPanel({columns: withOptions([])});
    await userEvent.click(screen.getByRole('button', {name: FILTERS_LABEL}));

    rerender(<Harness columns={withOptions([{label: 'Active', value: 'ACTIVE'}])} />);
    await userEvent.click(within(screen.getByRole('presentation')).getByRole('combobox'));

    expect(await screen.findByRole('option', {name: 'Active'})).toBeInTheDocument();
  });
});

// ===========================================================================
// The clear-all button is hidden with `visibility: hidden` rather than unmounted, so
// it holds its slot and the header does not reflow the moment a filter is applied.
// That is only safe because `visibility: hidden` also takes the button out of the
// accessibility tree and the tab order — otherwise a keyboard user would land on a
// button reading "Clear All" that either does nothing or resets a table with nothing
// to reset. This test pins that property: swapping the style for `opacity: 0` or
// `color: transparent` would keep the same look and quietly break it.
// ===========================================================================
describe('FilterPanel — the hidden clear-all button stays out of reach', () => {
  it('is not exposed while nothing is filtered', async () => {
    const panel = await openPanel({columns: [nameColumn], onReset: vi.fn()});

    expect(within(panel).queryByRole('button', {name: DEFAULT_LABELS.clearAll})).not.toBeInTheDocument();
  });

  it('is exposed once a filter is active', async () => {
    const panel = await openPanel({
      columns: [nameColumn],
      onReset: vi.fn(),
      initialFilters: [{id: 'name', value: 'D'}],
    });

    expect(within(panel).getByRole('button', {name: DEFAULT_LABELS.clearAll})).toBeInTheDocument();
  });
});

// ===========================================================================
// KNOWN ISSUE — the end-to-end symptom of the filter defect
//
// The per-component write-up is in filters/BooleanFilter.test.tsx: the filter fields read
// their value off `column`, which is a stable object, so React Compiler caches their
// render against it and an external change to the filter never reaches them. This test
// pins the consequence at the level a user meets it, through the panel's own clear-all.
//
// After the click the table is genuinely unfiltered, the badge is gone and every row is
// back, but the field still holds the old text. The panel says one thing and the list
// shows another, and the only way to resync the field is to close and reopen the drawer
// so it remounts.
//
// Kept separate from the unit tests on purpose. A fix that resyncs the components in
// isolation but leaves this failing has not fixed the bug the user actually hits.
//
// EXPECTED TO FAIL until an external filter change reaches the fields.
// ===========================================================================
const resetColumns: readonly DataTableColumnDef<Item>[] = [nameColumn];
const resetTableColumns = resetColumns as ColumnDef<Item>[];

describe('KNOWN ISSUE — clearing every filter must empty the fields', () => {
  /**
   * Both column arrays are hoisted out of the component on purpose. A consumer that
   * builds its columns with `useMemo`, which is what every page in this app does, hands
   * `useReactTable` the same array on every render, and TanStack then reuses the same
   * column instances. Rebuilding the array inline instead makes TanStack mint fresh
   * column objects, which invalidates the compiler cache and hides this bug.
   */
  function ResettableHarness() {
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([{id: 'name', value: 'Det'}]);
    const table = useReactTable({
      data,
      columns: resetTableColumns,
      state: {columnFilters},
      onColumnFiltersChange: setColumnFilters,
      getRowId: (row) => row.id,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
    });

    return (
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <FilterPanel
          table={table}
          columns={resetColumns}
          columnFilters={columnFilters}
          onReset={() => {
            setColumnFilters([]);
          }}
        />
      </LocalizationProvider>
    );
  }

  it('empties the text box when clear all is pressed', async () => {
    render(<ResettableHarness />);
    await userEvent.click(screen.getByRole('button', {name: FILTERS_LABEL}));
    const panel = await screen.findByRole('presentation');
    expect(within(panel).getByRole('textbox')).toHaveValue('Det');

    await userEvent.click(within(panel).getByRole('button', {name: DEFAULT_LABELS.clearAll}));

    expect(within(panel).getByRole('textbox')).toHaveValue('');
  });
});
