/**
 * `cardTapAction` and the card's keyboard contract.
 *
 * `'select'` is how cards have always behaved, so its tests pin that nothing moved.
 * `'open'` is the new mode: a tap opens and does nothing else. In both modes a card that
 * has something to do is a named tab stop where Enter opens and Space selects.
 */
import {within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {DataTable} from '../DataTable';
import type {TestRole} from '../test/test-utils';
import {generateTestRoles, render, screen} from '../test/test-utils';
import type {DataTableColumnDef, RowAction} from '../types';

const testData = generateTestRoles(3);

const testColumns: DataTableColumnDef<TestRole>[] = [
  {id: 'name', accessorKey: 'name', header: 'Name'},
  {id: 'roleType', accessorKey: 'roleType', header: 'Type'},
];

beforeEach(() => {
  localStorage.clear();
  // Every max-width query matches, so the DataTable renders its card branch.
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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cardTapAction: 'select' (the default)", () => {
  it('selects the row and calls onRowClick on a tap, as before', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(<DataTable columns={testColumns} data={testData} enableRowSelection onRowClick={onRowClick} />);

    await user.click(screen.getByText('Role 1'));

    expect(onRowClick).toHaveBeenCalledWith(testData[0]);
    expect(screen.getByRole('checkbox', {name: 'Select row role-1'})).toBeChecked();
  });

  it('shows no open chevron', () => {
    render(<DataTable columns={testColumns} data={testData} onRowClick={vi.fn()} />);

    expect(screen.queryByTestId('ChevronRightIcon')).not.toBeInTheDocument();
  });

  it('makes the card a tab stop named by its title', async () => {
    const user = userEvent.setup();
    // No toolbar and no card bar, so the first card is the first tab stop on the page.
    render(
      <DataTable
        columns={testColumns}
        data={testData}
        onRowClick={vi.fn()}
        showToolbar={false}
        enableSorting={false}
      />,
    );

    await user.tab();

    expect(screen.getByRole('group', {name: 'Role 1'})).toHaveFocus();
  });

  it('opens on Enter without selecting', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(<DataTable columns={testColumns} data={testData} enableRowSelection onRowClick={onRowClick} />);

    screen.getByRole('group', {name: 'Role 1'}).focus();
    await user.keyboard('{Enter}');

    expect(onRowClick).toHaveBeenCalledWith(testData[0]);
    expect(screen.getByRole('checkbox', {name: 'Select row role-1'})).not.toBeChecked();
  });

  it('selects on Space without opening', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(<DataTable columns={testColumns} data={testData} enableRowSelection onRowClick={onRowClick} />);

    screen.getByRole('group', {name: 'Role 1'}).focus();
    await user.keyboard(' ');

    expect(onRowClick).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', {name: 'Select row role-1'})).toBeChecked();
  });

  it('leaves a card with nothing to do out of the tab order', () => {
    render(<DataTable columns={testColumns} data={testData} />);

    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });
});

describe("cardTapAction: 'open'", () => {
  it('calls onRowClick on a tap and leaves the selection alone', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={testColumns}
        data={testData}
        enableRowSelection
        onRowClick={onRowClick}
        cardTapAction="open"
      />,
    );

    await user.click(screen.getByText('Role 1'));

    expect(onRowClick).toHaveBeenCalledWith(testData[0]);
    expect(screen.getByRole('checkbox', {name: 'Select row role-1'})).not.toBeChecked();
  });

  it('does not expand the row on a tap; the chevron button still does', async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={testColumns}
        data={testData}
        enableExpanding
        renderExpandedRow={(row) => `Details for ${row.original.name}`}
        animateExpansion={false}
        onRowClick={vi.fn()}
        cardTapAction="open"
      />,
    );

    await user.click(screen.getByText('Role 1'));
    expect(screen.queryByText('Details for Role 1')).not.toBeInTheDocument();

    const card = screen.getByRole('group', {name: 'Role 1'});
    await user.click(within(card).getByRole('button', {name: 'Expand row'}));
    expect(screen.getByText('Details for Role 1')).toBeInTheDocument();
  });

  it('selects through the checkbox without opening', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={testColumns}
        data={testData}
        enableRowSelection
        onRowClick={onRowClick}
        cardTapAction="open"
      />,
    );

    await user.click(screen.getByRole('checkbox', {name: 'Select row role-1'}));

    expect(onRowClick).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', {name: 'Select row role-1'})).toBeChecked();
  });

  it('opens the actions menu without opening the row', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const actions: RowAction<TestRole>[] = [{id: 'edit', label: 'Edit', onClick: vi.fn()}];
    render(
      <DataTable
        columns={testColumns}
        data={testData}
        rowActions={actions}
        onRowClick={onRowClick}
        cardTapAction="open"
      />,
    );

    const card = screen.getByRole('group', {name: 'Role 1'});
    await user.click(within(card).getByRole('button', {name: 'Actions'}));

    expect(onRowClick).not.toHaveBeenCalled();
    expect(await screen.findByRole('menuitem', {name: 'Edit'})).toBeInTheDocument();
  });

  it('shows a chevron on every card that opens', () => {
    render(<DataTable columns={testColumns} data={testData} onRowClick={vi.fn()} cardTapAction="open" />);

    expect(screen.getAllByTestId('ChevronRightIcon')).toHaveLength(3);
  });

  it('shows no chevron and does nothing on a tap without onRowClick', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={testColumns} data={testData} enableRowSelection cardTapAction="open" />);

    await user.click(screen.getByText('Role 1'));

    expect(screen.queryByTestId('ChevronRightIcon')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Select row role-1'})).not.toBeChecked();
  });

  it('keeps Space for selection and Enter for opening', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={testColumns}
        data={testData}
        enableRowSelection
        onRowClick={onRowClick}
        cardTapAction="open"
      />,
    );

    screen.getByRole('group', {name: 'Role 2'}).focus();
    await user.keyboard(' ');
    expect(screen.getByRole('checkbox', {name: 'Select row role-2'})).toBeChecked();
    expect(onRowClick).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledWith(testData[1]);
  });
});

describe('card keyboard handling', () => {
  it('leaves a card with no title unnamed rather than pointing at nothing', () => {
    render(
      <DataTable
        columns={testColumns.map((column) => ({...column, showInMobileCard: false}))}
        data={testData}
        onRowClick={vi.fn()}
      />,
    );

    const [card] = screen.getAllByRole('group');
    expect(card).not.toHaveAttribute('aria-labelledby');
  });

  it('ignores a key pressed on a control inside the card', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(<DataTable columns={testColumns} data={testData} enableRowSelection onRowClick={onRowClick} />);

    screen.getByRole('checkbox', {name: 'Select row role-1'}).focus();
    await user.keyboard('{Enter}');

    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('ignores Enter without onRowClick and Space on a row that cannot be selected', async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={testColumns}
        data={testData}
        enableRowSelection={(row) => row.original.id !== 'role-1'}
        cardTapAction="open"
      />,
    );

    // role-1 cannot be selected and nothing opens it, so only the other two are tab stops.
    expect(screen.getAllByRole('group')).toHaveLength(2);

    screen.getByRole('group', {name: 'Role 2'}).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('checkbox', {name: 'Select row role-2'})).not.toBeChecked();

    await user.keyboard('a');
    expect(screen.getByRole('checkbox', {name: 'Select row role-2'})).not.toBeChecked();
  });
});
