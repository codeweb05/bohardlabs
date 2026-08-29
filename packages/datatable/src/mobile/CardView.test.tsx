/**
 * Coverage for the mobile card view (`CardView` + `CardItem`), which had no tests
 * at all despite being what every list page actually renders below the `sm`
 * breakpoint.
 *
 * These go through `<DataTable>` with a mobile viewport rather than mounting
 * `CardItem` directly, because the interesting behaviour (which columns get picked,
 * what a tap does, how selection and expansion interact) only exists once a real
 * table instance is wired up.
 *
 * The block at the bottom guards a bug that has since been fixed in `CardItem`; it
 * is kept as a regression test.
 */
import {ThemeProvider, createTheme} from '@mui/material';
import type {ColumnDef} from '@tanstack/react-table';
import {getCoreRowModel, getExpandedRowModel, useReactTable} from '@tanstack/react-table';
import {waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {DataTable} from '../DataTable';
import {DataTableProvider} from '../DataTableContext';
import {DEFAULT_LABELS} from '../i18n';
import type {TestRole} from '../test/test-utils';
import {generateTestRoles, render, screen} from '../test/test-utils';
import type {DataTableColumnDef, RowAction} from '../types';
import {CardView} from './CardView';

const testData = generateTestRoles(3);

const testColumns: DataTableColumnDef<TestRole>[] = [
  {id: 'name', accessorKey: 'name', header: 'Name'},
  {id: 'roleType', accessorKey: 'roleType', header: 'Type'},
  {
    id: 'description',
    accessorKey: 'description',
    header: 'Description',
    cell: ({row}) => row.original.description ?? '-',
  },
];

/** Force every media query to match so the DataTable renders its mobile branch. */
function mockMobileViewport() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  localStorage.clear();
  mockMobileViewport();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Card titles. MUI renders the card as a plain div with no role, so there is no way
 * to scope a query to one card without walking the DOM (which the testing-library
 * lint rules forbid). Every card in a given render shares the same column config, so
 * the assertions below count labels across all of them instead: three cards means
 * three copies of each label.
 */
function cardTitles(): HTMLElement[] {
  return screen.getAllByText(/^Role \d+$/);
}

/** How many cards the current render produced. */
const CARD_COUNT = 3;

describe('CardView', () => {
  it('replaces the table with cards on a mobile viewport', () => {
    render(<DataTable columns={testColumns} data={testData} />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(cardTitles()).toHaveLength(CARD_COUNT);
  });

  it('keeps the table when card view is disabled', () => {
    render(<DataTable columns={testColumns} data={testData} enableMobileCardView={false} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('renders the empty state instead of an empty card list', () => {
    render(<DataTable columns={testColumns} data={[]} emptyMessage="Nothing here" />);

    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.queryByText(/^Role \d+$/)).not.toBeInTheDocument();
  });

  it('uses a custom card renderer when one is supplied', () => {
    render(
      <DataTable
        columns={testColumns}
        data={testData}
        renderMobileCard={(row) => <div data-testid="custom-card">{`custom:${row.name}`}</div>}
      />,
    );

    expect(screen.getAllByTestId('custom-card')).toHaveLength(3);
    expect(screen.getByText('custom:Role 1')).toBeInTheDocument();
  });

  it('honours a mobileBreakpoint that the viewport does not meet', () => {
    // matchMedia matches every max-width query here, so the only way the table can
    // win is if the breakpoint prop is actually threaded through. Set it to xs and
    // point matchMedia at a desktop width to prove the prop is read.
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    render(<DataTable columns={testColumns} data={testData} mobileBreakpoint="xs" />);

    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});

describe('CardItem — column selection', () => {
  it('renders the first mobile column as the card title', () => {
    render(<DataTable columns={testColumns} data={testData} />);

    // A title renders bare; every other column renders behind a "Label:" prefix.
    expect(screen.getByText('Role 1')).toBeInTheDocument();
    expect(screen.queryByText('Name:')).not.toBeInTheDocument();
  });

  it('renders the remaining columns as label/value pairs', () => {
    render(<DataTable columns={testColumns} data={testData} />);

    expect(screen.getAllByText('Type:')).toHaveLength(CARD_COUNT);
    expect(screen.getAllByText('Description:')).toHaveLength(CARD_COUNT);
    expect(screen.getByText('Description for role 1')).toBeInTheDocument();
  });

  it('prefers mobileLabel over the column header', () => {
    render(<DataTable columns={[testColumns[0], {...testColumns[1], mobileLabel: 'Kind'}]} data={testData} />);

    expect(screen.getAllByText('Kind:')).toHaveLength(CARD_COUNT);
    expect(screen.queryByText('Type:')).not.toBeInTheDocument();
  });

  it('orders card fields by mobileOrder, not column order', () => {
    render(
      <DataTable
        columns={[
          {...testColumns[0], mobileOrder: 3},
          {...testColumns[1], mobileOrder: 1},
          {...testColumns[2], mobileOrder: 2},
        ]}
        data={testData}
      />,
    );

    // roleType now sorts first, so it becomes the card title instead of name: its
    // label disappears and name gains one.
    expect(screen.queryByText('Type:')).not.toBeInTheDocument();
    expect(screen.getAllByText('Name:')).toHaveLength(CARD_COUNT);
    expect(screen.getAllByText('Description:')).toHaveLength(CARD_COUNT);
  });

  it('omits columns marked showInMobileCard: false', () => {
    render(
      <DataTable
        columns={[testColumns[0], {...testColumns[1], showInMobileCard: false}, testColumns[2]]}
        data={testData}
      />,
    );

    expect(screen.queryByText('Type:')).not.toBeInTheDocument();
    expect(screen.getAllByText('Description:')).toHaveLength(CARD_COUNT);
  });

  it('renders a stacked field without the trailing colon of the inline layout', () => {
    render(
      <DataTable columns={[testColumns[0], {...testColumns[1], mobileContentLayout: 'stacked'}]} data={testData} />,
    );

    expect(screen.getAllByText('Type')).toHaveLength(CARD_COUNT);
    expect(screen.queryByText('Type:')).not.toBeInTheDocument();
  });

  it('caps the card at five fields', () => {
    // Documented current behaviour, not necessarily desirable: columns past the
    // fifth are dropped from the card with no affordance to reach them. Worth
    // revisiting before this ships as a standalone package.
    const manyColumns: DataTableColumnDef<TestRole>[] = Array.from({length: 8}, (_unused, i) => ({
      id: `col${i}`,
      accessorFn: () => `value-${i}`,
      header: `Col ${i}`,
    }));
    render(<DataTable columns={manyColumns} data={testData} />);

    expect(screen.queryAllByText('Col 4:')).toHaveLength(3);
    expect(screen.queryAllByText('Col 5:')).toHaveLength(0);
  });
});

describe('CardItem — row actions', () => {
  const onEdit = vi.fn();
  const onDelete = vi.fn();

  const actions: RowAction<TestRole>[] = [
    {id: 'edit', label: 'Edit', onClick: onEdit},
    {id: 'delete', label: 'Delete', onClick: onDelete, color: 'error', divider: true},
  ];

  beforeEach(() => {
    onEdit.mockClear();
    onDelete.mockClear();
  });

  it('does not render an actions button when there are no actions', () => {
    render(<DataTable columns={testColumns} data={testData} />);

    expect(screen.queryByRole('button', {name: 'Actions'})).not.toBeInTheDocument();
  });

  it('opens the action menu and fires the handler with the row', async () => {
    render(<DataTable columns={testColumns} data={testData} rowActions={actions} />);

    await userEvent.click(screen.getAllByRole('button', {name: 'Actions'})[0]);
    await userEvent.click(await screen.findByRole('menuitem', {name: 'Edit'}));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({id: 'role-1'}));
  });

  it('closes the menu on Escape without running an action', async () => {
    // The menu's `onClose` (CardItem.tsx:309) had no coverage: the other tests close it
    // by picking an item. On a phone the menu covers the card it belongs to, so one that
    // ignores a dismiss leaves the user with no way back to the list.
    render(<DataTable columns={testColumns} data={testData} rowActions={actions} />);
    await userEvent.click(screen.getAllByRole('button', {name: 'Actions'})[0]);
    await screen.findByRole('menuitem', {name: 'Edit'});

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('menuitem', {name: 'Edit'})).not.toBeInTheDocument();
    });
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('hides actions whose hidden predicate returns true', async () => {
    render(
      <DataTable
        columns={testColumns}
        data={testData}
        rowActions={[{...actions[0], hidden: (row) => row.id === 'role-1'}, actions[1]]}
      />,
    );

    await userEvent.click(screen.getAllByRole('button', {name: 'Actions'})[0]);

    expect(screen.queryByRole('menuitem', {name: 'Edit'})).not.toBeInTheDocument();
    expect(await screen.findByRole('menuitem', {name: 'Delete'})).toBeInTheDocument();
  });

  it('disables actions whose disabled predicate returns true', async () => {
    render(
      <DataTable
        columns={testColumns}
        data={testData}
        rowActions={[{...actions[0], disabled: (row) => row.id === 'role-1'}]}
      />,
    );

    await userEvent.click(screen.getAllByRole('button', {name: 'Actions'})[0]);

    expect(await screen.findByRole('menuitem', {name: 'Edit'})).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not trigger the row click when the actions button is tapped', async () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={testColumns} data={testData} rowActions={actions} onRowClick={onRowClick} />);

    await userEvent.click(screen.getAllByRole('button', {name: 'Actions'})[0]);

    expect(onRowClick).not.toHaveBeenCalled();
  });
});

describe('CardItem — selection', () => {
  it('renders no checkbox when row selection is off', () => {
    render(<DataTable columns={testColumns} data={testData} />);

    expect(screen.queryByRole('checkbox', {name: /Select row/})).not.toBeInTheDocument();
  });

  it('selects a row from its checkbox', async () => {
    const onRowSelectionChange = vi.fn();
    render(
      <DataTable
        columns={testColumns}
        data={testData}
        enableRowSelection
        onRowSelectionChange={onRowSelectionChange}
      />,
    );

    await userEvent.click(screen.getAllByRole('checkbox', {name: /Select row/})[0]);

    expect(screen.getAllByRole('checkbox', {name: /Select row/})[0]).toBeChecked();
    expect(onRowSelectionChange).toHaveBeenCalled();
  });

  it('selects a row by tapping the card body', async () => {
    render(<DataTable columns={testColumns} data={testData} enableRowSelection />);

    // The click handler sits on the card root, so clicking the title bubbles to it.
    await userEvent.click(screen.getByText('Role 1'));

    expect(screen.getAllByRole('checkbox', {name: /Select row/})[0]).toBeChecked();
  });

  it('disables the checkbox for rows the predicate rejects', () => {
    render(
      <DataTable columns={testColumns} data={testData} enableRowSelection={(row) => row.original.id !== 'role-1'} />,
    );

    const checkboxes = screen.getAllByRole('checkbox', {name: /Select row/});
    expect(checkboxes[0]).toBeDisabled();
    expect(checkboxes[1]).toBeEnabled();
  });
});

describe('CardItem — expansion', () => {
  it('renders no chevron when expanding is off', () => {
    render(<DataTable columns={testColumns} data={testData} />);

    expect(screen.queryByRole('button', {name: 'Expand row'})).not.toBeInTheDocument();
  });

  it('expands a card and renders the expanded content', async () => {
    render(
      <DataTable
        columns={testColumns}
        data={testData}
        enableExpanding
        renderExpandedRow={(row) => <div>{`details for ${row.original.name}`}</div>}
      />,
    );

    await userEvent.click(screen.getAllByRole('button', {name: 'Expand row'})[0]);

    expect(await screen.findByText('details for Role 1')).toBeInTheDocument();
    expect(screen.getAllByRole('button', {name: 'Collapse row'})[0]).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders expanded content without a transition when animation is off', async () => {
    render(
      <DataTable
        columns={testColumns}
        data={testData}
        enableExpanding
        animateExpansion={false}
        renderExpandedRow={(row) => <div>{`details for ${row.original.name}`}</div>}
      />,
    );

    expect(screen.queryByText('details for Role 1')).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', {name: 'Expand row'})[0]);

    expect(await screen.findByText('details for Role 1')).toBeInTheDocument();
  });

  it('expands from a tap on the card body, not just the chevron', async () => {
    // `handleCardClick` toggles expansion as well (CardItem.tsx:96-98), and that half
    // was uncovered: every test above went through the chevron. Tapping the card is the
    // natural gesture on a phone, and it is the same handler that toggles selection, so
    // the two have to coexist rather than one shadowing the other.
    render(
      <DataTable
        columns={testColumns}
        data={testData}
        enableExpanding
        animateExpansion={false}
        renderExpandedRow={(row) => <div>{`details for ${row.original.name}`}</div>}
      />,
    );

    await userEvent.click(cardTitles()[0]);

    expect(await screen.findByText('details for Role 1')).toBeInTheDocument();
  });

  it('collapses again on a second tap', async () => {
    render(
      <DataTable
        columns={testColumns}
        data={testData}
        enableExpanding
        animateExpansion={false}
        renderExpandedRow={(row) => <div>{`details for ${row.original.name}`}</div>}
      />,
    );

    await userEvent.click(screen.getAllByRole('button', {name: 'Expand row'})[0]);
    await userEvent.click(screen.getAllByRole('button', {name: 'Collapse row'})[0]);

    expect(screen.queryByText('details for Role 1')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// REGRESSION — mobile/CardItem.tsx:56
//
// `mobileColumns` is built from `getAllLeafColumns()`, which includes columns the
// user has hidden. Before the `col.getIsVisible()` filter was added, each hidden
// column still consumed one of the five card slots (the title slot included) and
// then rendered nothing, so the card silently lost fields that ARE visible and the
// user had no way to get them back.
//
// This test failed when it was written and passes now; keep it.
// ===========================================================================
describe('Regression — hidden columns must not occupy mobile card slots', () => {
  it('does not let a hidden column consume the card title slot', () => {
    render(<DataTable columns={testColumns} data={testData} initialColumnVisibility={{name: false}} />);

    // With `name` hidden, `roleType` should be promoted to the card title (so its
    // label disappears) and `description` should stay a labelled field.
    expect(screen.getAllByText('Description:')).toHaveLength(CARD_COUNT);
    expect(screen.queryByText('Type:')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// Both the card and its expanded panel pick their background and border from the theme
// (CardItem.tsx:119-126, CardView.tsx:81 and :97). The project `render` supplies a light
// theme only, so the dark half of each of those callbacks had never executed.
//
// Mobile is where dark mode is used most (a phone at night), and these are the exact
// values that decide whether a card is visible against the page at all. The assertions
// below are about the card still rendering everything it should; the branch coverage is
// what proves the dark palette path runs.
// ===========================================================================
describe('CardView — dark theme', () => {
  it('renders the cards with the dark palette', () => {
    render(
      <ThemeProvider theme={createTheme({palette: {mode: 'dark'}})}>
        <DataTable columns={testColumns} data={testData} />
      </ThemeProvider>,
    );

    expect(cardTitles()).toHaveLength(CARD_COUNT);
  });

  it('renders a selected card in dark mode', async () => {
    // A selected card swaps its border for the primary colour, which is the one branch
    // of that callback that does not depend on the palette mode. Both have to work
    // together: selection styling on a dark background is where contrast breaks.
    render(
      <ThemeProvider theme={createTheme({palette: {mode: 'dark'}})}>
        <DataTable columns={testColumns} data={testData} enableRowSelection />
      </ThemeProvider>,
    );

    await userEvent.click(screen.getAllByRole('checkbox')[0]);

    expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
  });

  it('renders the animated expanded panel in dark mode', async () => {
    render(
      <ThemeProvider theme={createTheme({palette: {mode: 'dark'}})}>
        <DataTable
          columns={testColumns}
          data={testData}
          enableExpanding
          renderExpandedRow={(row) => <div>{`details for ${row.original.name}`}</div>}
        />
      </ThemeProvider>,
    );

    await userEvent.click(screen.getAllByRole('button', {name: 'Expand row'})[0]);

    expect(await screen.findByText('details for Role 1')).toBeInTheDocument();
  });

  it('renders the unanimated expanded panel in dark mode', async () => {
    // The two panels are separate JSX branches with their own copy of the border
    // callback, so covering one says nothing about the other.
    render(
      <ThemeProvider theme={createTheme({palette: {mode: 'dark'}})}>
        <DataTable
          columns={testColumns}
          data={testData}
          enableExpanding
          animateExpansion={false}
          renderExpandedRow={(row) => <div>{`details for ${row.original.name}`}</div>}
        />
      </ThemeProvider>,
    );

    await userEvent.click(screen.getAllByRole('button', {name: 'Expand row'})[0]);

    expect(await screen.findByText('details for Role 1')).toBeInTheDocument();
  });
});

// ===========================================================================
// KNOWN ISSUE — mobile/CardView.tsx:39
//
//   return Boolean(expanded[String(row.original.id)]);
//
// The expanded state is keyed by the table's row id, which is whatever `getRowId`
// returns (useTableInstance.ts:129 — a caller-supplied function, only defaulting to
// `String(row.original.id)`). CardView looks the row up by `row.original.id` instead,
// so the moment a page passes its own `getRowId` the two keys stop matching and the
// lookup always misses.
//
// What a user sees on a phone: tapping the chevron flips the row's expanded flag, the
// card's bottom corners square off ready for the panel, and no panel ever appears.
// The desktop table is unaffected because TableBody asks `row.getIsExpanded()`.
//
// A compound key is the realistic trigger: order lines keyed `${orderId}-${lineId}`,
// or any list whose rows carry a `uuid` rather than `id`.
//
// The fix is `expanded[row.id]`, which is correct for the default case too, since the
// default `getRowId` produces exactly that string.
//
// EXPECTED TO FAIL until the lookup uses the table's row id.
// ===========================================================================
describe('KNOWN ISSUE — an expanded card must open under a custom row id', () => {
  it('shows the expanded panel when the table has its own getRowId', async () => {
    render(
      <DataTable
        columns={testColumns}
        data={testData}
        getRowId={(row) => `role::${row.id}`}
        enableExpanding
        renderExpandedRow={(row) => <div>{`details for ${row.original.name}`}</div>}
      />,
    );

    await userEvent.click(screen.getAllByRole('button', {name: 'Expand row'})[0]);

    expect(await screen.findByText('details for Role 1')).toBeInTheDocument();
  });
});

// ===========================================================================
// `isRowExpanded` (CardView.tsx:36-40) has four arms and `<DataTable>` can only reach
// two of them: it always supplies a record through the context, so the "no expanded
// state in context" fallback and the expand-all boolean were both dead in the
// coverage report.
//
// Both are reachable by a consumer, which is what matters for a standalone package:
// the context prop is optional (DataTableContext.tsx:27), and TanStack writes the
// boolean `true` into `expanded` whenever `toggleAllRowsExpanded()` runs, so an
// "expand all" control anywhere in a page turns every card into the boolean arm.
//
// These mount `CardView` under its own provider rather than going through
// `<DataTable>`, because that is the only way to hand the context those two shapes.
// ===========================================================================
describe('CardView — expanded state shapes', () => {
  const expandedTestColumns = testColumns as ColumnDef<TestRole>[];

  function renderCardView(props: Readonly<{contextExpanded?: Record<string, boolean> | boolean}>) {
    function Harness() {
      // React Compiler would otherwise cache this against the stable table reference.
      'use no memo';
      const table = useReactTable({
        data: testData,
        columns: expandedTestColumns,
        state: {expanded: {'role-1': true}},
        getRowId: (row) => String(row.id),
        onExpandedChange: () => {},
        getRowCanExpand: () => true,
        getCoreRowModel: getCoreRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
      });

      return (
        <DataTableProvider
          table={table}
          density="comfortable"
          setDensity={() => {}}
          isMobile
          {...(props.contextExpanded !== undefined && {expanded: props.contextExpanded})}
        >
          <CardView
            table={table}
            enableExpanding
            renderExpandedRow={(row) => <div>{`details for ${row.original.name}`}</div>}
          />
        </DataTableProvider>
      );
    }

    return render(<Harness />);
  }

  it('asks the row itself when the context carries no expanded state', () => {
    // The fallback has to agree with the table, or a card renders collapsed while the
    // row it is showing is expanded.
    renderCardView({});

    expect(screen.getByText('details for Role 1')).toBeInTheDocument();
    expect(screen.queryByText('details for Role 2')).not.toBeInTheDocument();
  });

  it('opens every card when the expanded state is the expand-all boolean', () => {
    renderCardView({contextExpanded: true});

    expect(screen.getByText('details for Role 1')).toBeInTheDocument();
    expect(screen.getByText('details for Role 3')).toBeInTheDocument();
  });

  // Not tested: `expanded === false`, which TanStack writes on collapse-all. It is
  // falsy, so it takes the same fallback arm as a missing context value and the answer
  // comes from the row, which is collapsed for the same reason. Correct, but only
  // because the two agree; asserting it would just be re-asserting the fallback above.
});

// ===========================================================================
// CardView returns null before rendering anything when the table has no rows
// (CardView.tsx:31-33). `<DataTable>` renders its own empty state alongside, so this
// guards that the two do not both appear: an empty Stack with mobile padding under
// the "no data" panel is a visible gap on a phone.
// ===========================================================================
describe('CardView — no rows', () => {
  it('renders no cards for an empty table', () => {
    render(<DataTable columns={testColumns} data={[]} />);

    expect(screen.queryAllByText(/^Role \d+$/)).toHaveLength(0);
    expect(screen.getByText(DEFAULT_LABELS.noData)).toBeInTheDocument();
  });
});
