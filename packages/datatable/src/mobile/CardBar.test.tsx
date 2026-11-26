/**
 * The bar above the cards: select-all for the page, clear, and a sort menu that writes the
 * same `sorting` state the desktop headers write.
 */
import type {ColumnDef} from '@tanstack/react-table';
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {DataTable} from '../DataTable';
import {DataTableProvider} from '../DataTableContext';
import {DEFAULT_LABELS as L} from '../i18n';
import {render, screen} from '../test/test-utils';
import type {DataTableColumnDef} from '../types';
import {CardView} from './CardView';

interface Fruit {
  readonly id: string;
  readonly name: string;
  readonly colour: string;
  readonly [key: string]: unknown;
}

const FRUITS: Fruit[] = [
  {id: 'f1', name: 'Cherry', colour: 'red'},
  {id: 'f2', name: 'Apple', colour: 'green'},
  {id: 'f3', name: 'Banana', colour: 'yellow'},
  {id: 'f4', name: 'Damson', colour: 'purple'},
];

const columns: DataTableColumnDef<Fruit>[] = [
  {id: 'name', accessorKey: 'name', header: 'Name'},
  {id: 'colour', accessorKey: 'colour', header: 'Colour'},
];

beforeEach(() => {
  localStorage.clear();
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

/** The title of every card, in the order the cards are on screen. */
function cards(): string[] {
  return screen.getAllByRole('listitem').map((card) => within(card).getByRole('heading').textContent);
}

function selectAll(): HTMLInputElement {
  const box = screen.getByRole('checkbox', {name: L.selectAll});
  if (!(box instanceof HTMLInputElement)) throw new Error('Expected a native checkbox');
  return box;
}

describe('the card bar, selection', () => {
  it('selects the cards on this page only', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={FRUITS} pageSize={2} pageSizeOptions={[2, 10]} enableRowSelection />);

    await user.click(selectAll());

    expect(screen.getByRole('checkbox', {name: L.selectRow('f1')})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: L.selectRow('f2')})).toBeChecked();
    expect(selectAll()).toBeChecked();
    expect(screen.getByText(`2 ${L.selected}`)).toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: L.nextPage}));

    expect(screen.getByRole('checkbox', {name: L.selectRow('f3')})).not.toBeChecked();
    expect(selectAll()).not.toBeChecked();
    // The count is the whole selection, the other page included.
    expect(screen.getByText(`2 ${L.selected}`)).toBeInTheDocument();
  });

  it('is indeterminate on a partial selection, and a click then selects the rest', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={FRUITS} enableRowSelection />);
    expect(screen.getByText(L.selectAll)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', {name: L.selectRow('f2')}));

    expect(selectAll().indeterminate).toBe(true);
    expect(selectAll()).not.toBeChecked();
    expect(screen.getByText(`1 ${L.selected}`)).toBeInTheDocument();

    await user.click(selectAll());

    expect(selectAll().indeterminate).toBe(false);
    expect(screen.getAllByRole('checkbox', {name: /^Select row/, checked: true})).toHaveLength(4);

    await user.click(selectAll());

    expect(screen.queryAllByRole('checkbox', {name: /^Select row/, checked: true})).toHaveLength(0);
  });

  it('selects through the label text as well as the box', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={FRUITS} enableRowSelection />);

    await user.click(screen.getByText(L.selectAll));

    expect(selectAll()).toBeChecked();
  });

  it('clears the selection, and offers Clear only when something is selected', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={FRUITS} enableRowSelection />);
    expect(screen.queryByRole('button', {name: L.clearSelection})).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', {name: L.selectRow('f1')}));
    await user.click(screen.getByRole('button', {name: L.clearSelection}));

    expect(screen.getByRole('checkbox', {name: L.selectRow('f1')})).not.toBeChecked();
    expect(screen.queryByRole('button', {name: L.clearSelection})).not.toBeInTheDocument();
  });

  it('keeps the default name when a translation leaves select-all empty', () => {
    render(<DataTable columns={columns} data={FRUITS} enableRowSelection labels={{selectAll: ''}} />);

    expect(screen.getByRole('checkbox', {name: L.selectAll})).toBeInTheDocument();
  });

  it('disables select-all when no card on the page can be selected', () => {
    render(<DataTable columns={columns} data={FRUITS} enableRowSelection={() => false} />);

    expect(selectAll()).toBeDisabled();
  });

  it('leaves selection out of a table that does not select', () => {
    render(<DataTable columns={columns} data={FRUITS} />);

    expect(screen.queryByRole('checkbox', {name: L.selectAll})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: L.sortMenu})).toBeInTheDocument();
  });
});

describe('the card bar, sorting', () => {
  it('sorts the cards by a column from the menu, then flips the direction', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={FRUITS} />);
    expect(cards()).toEqual(['Cherry', 'Apple', 'Banana', 'Damson']);

    await user.click(screen.getByRole('button', {name: L.sortMenu}));
    const menu = screen.getByRole('menu', {name: L.sortMenu});
    expect(
      within(menu)
        .getAllByRole('menuitemradio')
        .map((item) => item.textContent),
    ).toEqual(['Name', 'Colour']);
    await user.click(within(menu).getByRole('menuitemradio', {name: 'Name'}));

    expect(cards()).toEqual(['Apple', 'Banana', 'Cherry', 'Damson']);
    const sortButton = screen.getByRole('button', {name: L.sortedBy('Name', false)});
    expect(sortButton).toHaveTextContent('Name');

    await user.click(sortButton);
    expect(screen.getByRole('menuitemradio', {name: 'Name'})).toBeChecked();
    expect(screen.getByRole('menuitemradio', {name: L.sortAsc})).toBeChecked();
    expect(screen.getByRole('menuitemradio', {name: L.sortDesc})).not.toBeChecked();
    await user.click(screen.getByRole('menuitemradio', {name: L.sortDesc}));

    expect(cards()).toEqual(['Damson', 'Cherry', 'Banana', 'Apple']);
    expect(screen.getByRole('button', {name: L.sortedBy('Name', true)})).toBeInTheDocument();
  });

  it('keeps the direction when the sorted column is picked again, and starts another ascending', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={FRUITS} initialSorting={[{id: 'name', desc: true}]} />);

    await user.click(screen.getByRole('button', {name: L.sortedBy('Name', true)}));
    await user.click(screen.getByRole('menuitemradio', {name: 'Name'}));
    expect(cards()).toEqual(['Damson', 'Cherry', 'Banana', 'Apple']);

    await user.click(screen.getByRole('button', {name: L.sortedBy('Name', true)}));
    await user.click(screen.getByRole('menuitemradio', {name: 'Colour'}));

    expect(cards()).toEqual(['Apple', 'Damson', 'Cherry', 'Banana']);
    expect(screen.getByRole('button', {name: L.sortedBy('Colour', false)})).toBeInTheDocument();
  });

  it('offers no direction until a column is sorted', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={FRUITS} />);

    await user.click(screen.getByRole('button', {name: L.sortMenu}));

    expect(screen.queryByRole('menuitemradio', {name: L.sortAsc})).not.toBeInTheDocument();
  });

  it('closes the menu on Escape without sorting', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={FRUITS} />);

    await user.click(screen.getByRole('button', {name: L.sortMenu}));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(cards()).toEqual(['Cherry', 'Apple', 'Banana', 'Damson']);
  });

  it('lists visible sortable columns by their card label', async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={[
          {...columns[0], mobileLabel: 'Fruit'},
          {...columns[1], enableSorting: false},
          {id: 'id', accessorKey: 'id', header: () => 'Code'},
          {id: 'hidden', accessorKey: 'colour', header: 'Hidden'},
        ]}
        data={FRUITS}
        initialColumnVisibility={{hidden: false}}
      />,
    );

    await user.click(screen.getByRole('button', {name: L.sortMenu}));

    expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual(['Fruit', 'id']);
  });

  it('leaves sorting out of a table that does not sort', () => {
    render(<DataTable columns={columns} data={FRUITS} enableSorting={false} enableRowSelection />);

    expect(screen.queryByRole('button', {name: L.sortMenu})).not.toBeInTheDocument();
    expect(selectAll()).toBeInTheDocument();
  });

  it('renders no bar when there is nothing to select or sort', () => {
    render(<DataTable columns={columns} data={FRUITS} enableSorting={false} />);

    expect(screen.queryByRole('button', {name: L.sortMenu})).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

// `DataTable` always hands the context its selection and sorting; a consumer mounting the
// provider directly may not.
describe('the card bar, with no selection or sorting in context', () => {
  it('treats both as empty', () => {
    function Harness() {
      'use no memo';
      const table = useReactTable({
        data: FRUITS,
        columns: columns as ColumnDef<Fruit>[],
        getRowId: (row) => row.id,
        enableRowSelection: true,
        getCoreRowModel: getCoreRowModel(),
      });
      return (
        <DataTableProvider table={table} density="comfortable" setDensity={() => {}} isMobile>
          <CardView table={table} enableSorting />
        </DataTableProvider>
      );
    }
    render(<Harness />);

    expect(screen.getByText(L.selectAll)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: L.sortMenu})).toBeInTheDocument();
  });
});
