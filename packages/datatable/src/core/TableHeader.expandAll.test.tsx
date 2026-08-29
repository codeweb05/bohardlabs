import userEvent from '@testing-library/user-event';
/**
 * Coverage for the expand-all header cell (TableHeader.tsx:396-455), which nothing
 * reached: it only renders when `enableExpanding` is on, and every expansion test in
 * this folder drives the per-row chevrons instead.
 *
 * `toolbar/ExpandToggle.tsx` has its own tests, but it is a different control that is
 * not wired into `<DataTable>` (it is not even exported from the barrel). The button in
 * the header is the one users actually get, and it was untested end to end.
 */
import {describe, expect, it} from 'vitest';

import {DataTable} from '../DataTable';
import {DEFAULT_LABELS} from '../i18n';
import type {TestRole} from '../test/test-utils';
import {generateTestRoles, render, screen, waitFor} from '../test/test-utils';
import type {DataTableColumnDef} from '../types';

const testData = generateTestRoles(3);

const testColumns: DataTableColumnDef<TestRole>[] = [
  {id: 'name', accessorKey: 'name', header: 'Name'},
  {id: 'roleType', accessorKey: 'roleType', header: 'Type'},
];

const EXPAND_ALL = DEFAULT_LABELS.expandAll;
const COLLAPSE_ALL = DEFAULT_LABELS.collapseAll;

function renderTable() {
  return render(
    <DataTable
      columns={testColumns}
      data={testData}
      enableExpanding
      renderExpandedRow={(row) => <div>{`details for ${row.original.name}`}</div>}
    />,
  );
}

describe('TableHeader — the expand-all cell', () => {
  it('opens every row from the header button', async () => {
    renderTable();

    await userEvent.click(screen.getByRole('button', {name: EXPAND_ALL}));

    expect(await screen.findByText('details for Role 1')).toBeInTheDocument();
    expect(screen.getByText('details for Role 2')).toBeInTheDocument();
    expect(screen.getByText('details for Role 3')).toBeInTheDocument();
  });

  it('reads as expand-all while only some rows are open', async () => {
    // `allExpanded` is an every() over the rows, so opening one row must not flip the
    // header: pressing it then has to open the rest, not collapse the one that is open.
    renderTable();

    await userEvent.click(screen.getAllByRole('button', {name: 'Expand row'})[0]);

    expect(screen.getByRole('button', {name: EXPAND_ALL})).toBeInTheDocument();
  });
});

// ===========================================================================
// KNOWN ISSUE — core/TableHeader.tsx:414-419 and :441-455
//
//   const rows = table.getRowModel().rows;
//   const allExpanded = rows.length > 0 && rows.every((row) => row.getIsExpanded());
//   const handleToggleAllExpand = () => {
//     table.toggleAllRowsExpanded(!allExpanded);
//   };
//
// `ExpandAllHeaderCell` derives everything from `table`, which is a stable reference for
// the life of the mount, and its props never change either. React Compiler therefore
// serves the cached element on every later render: `allExpanded` is computed once, at
// mount, when it is false, and stays false.
//
// The consequences are visible, not theoretical:
//   - the label and tooltip keep saying "Expand All" with every row already open, so a
//     screen reader user is told the opposite of what the button does;
//   - the chevron never rotates, so there is no sighted feedback either;
//   - `!allExpanded` is therefore always `true`, which makes the control one-way. There
//     is no way to collapse everything from the header once it has been pressed.
//
// This is the same defect class as the one in datatable_compiler_context_invalidation:
// a component reading through the stable `table` reference instead of a changing slice.
// The fix matches the one already applied elsewhere in this folder: read the expanded
// state from `useTableUI()` (or take it as a prop) so the cell has a real input that
// changes when a row opens.
//
// Not tested here: the `rows.length > 0` guard on an empty table. `<DataTable>` swaps the
// whole table out for `EmptyState` when there are no rows (DataTable.tsx:366), so the
// header never renders in that case. The guard is correct defensively, and unreachable
// through the public component.
//
// EXPECTED TO FAIL until the header cell follows the expanded state.
// ===========================================================================
describe('KNOWN ISSUE — the expand-all header button must collapse as well as expand', () => {
  it('flips its label once every row is open', async () => {
    renderTable();

    await userEvent.click(screen.getByRole('button', {name: EXPAND_ALL}));

    expect(await screen.findByRole('button', {name: COLLAPSE_ALL})).toBeInTheDocument();
  });

  it('closes every row on a second press', async () => {
    renderTable();

    const toggle = screen.getByRole('button', {name: EXPAND_ALL});
    await userEvent.click(toggle);
    await userEvent.click(toggle);

    // `animateExpansion` defaults on, so the panel leaves through a 200 ms MUI Collapse
    // and `unmountOnExit` only fires at the end of it. The collapse test in
    // DataTable.expansion.test.tsx waits the same way.
    await waitFor(() => {
      expect(screen.queryByText('details for Role 1')).not.toBeInTheDocument();
    });
  });
});
