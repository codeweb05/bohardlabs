import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {DataTable} from './DataTable';
import {DEFAULT_LABELS as L} from './i18n';
import {render} from './test/test-utils';
import type {DataTableColumnDef} from './types';

interface Fruit {
  readonly id: string;
  readonly name: string;
  readonly colour: string;
  readonly [key: string]: unknown;
}

const NAMES = ['Cherry', 'Apple', 'Banana', 'Elderberry', 'Damson'];

function fruits(count: number): Fruit[] {
  return Array.from({length: count}, (_unused, index) => ({
    id: `fruit-${index + 1}`,
    name: index < NAMES.length ? (NAMES[index] ?? '') : `Fruit ${index + 1}`,
    colour: index % 2 === 0 ? 'red' : 'green',
  }));
}

const columns: DataTableColumnDef<Fruit>[] = [
  {id: 'name', accessorKey: 'name', header: 'Name'},
  {id: 'colour', accessorKey: 'colour', header: 'Colour'},
];

/** The first cell of every body row, in the order the rows are on screen. */
function names(): string[] {
  const [, ...rows] = screen.getAllByRole('row');
  return rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent ?? '');
}

describe('DataTable holding the whole dataset', () => {
  describe('sorting', () => {
    it('puts the rows in order when a header is clicked, and back when the sort is cleared', async () => {
      const user = userEvent.setup();
      render(<DataTable columns={columns} data={fruits(5)} />);
      expect(names()).toEqual(['Cherry', 'Apple', 'Banana', 'Elderberry', 'Damson']);

      await user.click(screen.getByText('Name'));
      expect(names()).toEqual(['Apple', 'Banana', 'Cherry', 'Damson', 'Elderberry']);

      await user.click(screen.getByText('Name'));
      expect(names()).toEqual(['Elderberry', 'Damson', 'Cherry', 'Banana', 'Apple']);

      await user.click(screen.getByText('Name'));
      expect(names()).toEqual(['Cherry', 'Apple', 'Banana', 'Elderberry', 'Damson']);
    });

    it('sorts across pages, not within the page on screen', async () => {
      const user = userEvent.setup();
      render(<DataTable columns={columns} data={fruits(12)} pageSize={5} pageSizeOptions={[5, 10]} />);

      await user.click(screen.getByText('Name'));
      await user.click(screen.getByText('Name'));
      // Descending over all twelve: the generated "Fruit N" names sort above the real ones.
      expect(names()).toEqual(['Fruit 12', 'Fruit 11', 'Fruit 10', 'Fruit 9', 'Fruit 8']);
    });
  });

  describe('search', () => {
    it('narrows the rows and the pager together', async () => {
      const user = userEvent.setup();
      render(<DataTable columns={columns} data={fruits(25)} pageSize={10} />);
      expect(screen.getByText(L.totalRows(25))).toBeInTheDocument();
      expect(screen.getByText(L.pageOf(1, 3))).toBeInTheDocument();

      await user.type(screen.getByRole('textbox', {name: L.globalSearch}), 'Fruit 1');

      // "Fruit 1x" is ten rows of twenty-five: 10 to 19.
      expect(await screen.findByText(L.totalRows(10))).toBeInTheDocument();
      expect(names()).toHaveLength(10);
      expect(screen.getByText(L.pageOf(1, 1))).toBeInTheDocument();
      expect(screen.getByText(L.rowsDisplayed(1, 10, 10))).toBeInTheDocument();
      expect(screen.getByRole('button', {name: L.nextPage})).toBeDisabled();
    });

    it('still filters when column filters are switched off', async () => {
      const user = userEvent.setup();
      render(<DataTable columns={columns} data={fruits(5)} enableFiltering={false} />);

      await user.type(screen.getByRole('textbox', {name: L.globalSearch}), 'an');

      await waitFor(() => expect(names()).toEqual(['Banana']));
    });

    it('reports the search to the server when column filters are switched off', async () => {
      const user = userEvent.setup();
      const onServerStateChange = vi.fn();
      render(
        <DataTable
          columns={columns}
          data={fruits(5)}
          enableFiltering={false}
          manualFiltering
          onServerStateChange={onServerStateChange}
        />,
      );

      await user.type(screen.getByRole('textbox', {name: L.globalSearch}), 'an');

      await waitFor(() =>
        expect(onServerStateChange).toHaveBeenLastCalledWith(expect.objectContaining({globalFilter: 'an'})),
      );
    });
  });

  describe('reporting state', () => {
    it('reports a search once', async () => {
      const user = userEvent.setup();
      const onServerStateChange = vi.fn();
      render(<DataTable columns={columns} data={fruits(25)} pageSize={10} onServerStateChange={onServerStateChange} />);
      onServerStateChange.mockClear();

      await user.type(screen.getByRole('textbox', {name: L.globalSearch}), 'F');
      expect(await screen.findByText(L.totalRows(20))).toBeInTheDocument();

      expect(onServerStateChange).toHaveBeenCalledTimes(1);
    });

    it('stays on its page when the order changes', async () => {
      const user = userEvent.setup();
      render(<DataTable columns={columns} data={fruits(25)} pageSize={10} />);
      await user.click(screen.getByRole('button', {name: L.nextPage}));
      expect(screen.getByText(L.pageOf(2, 3))).toBeInTheDocument();

      await user.click(screen.getByText('Name'));

      // Five named fruits, then Fruit 6 to Fruit 10, fill the first page of the sorted list.
      await waitFor(() => expect(names()[0]).toBe('Fruit 11'));
      expect(screen.getByText(L.pageOf(2, 3))).toBeInTheDocument();
    });
  });

  describe('the pager', () => {
    function Growing() {
      const [count, setCount] = useState(5);
      return (
        <>
          <button onClick={() => setCount(25)}>grow</button>
          <DataTable columns={columns} data={fruits(count)} pageSize={10} />
        </>
      );
    }

    it('follows the data when rows arrive', async () => {
      const user = userEvent.setup();
      render(<Growing />);
      expect(screen.getByText(L.pageOf(1, 1))).toBeInTheDocument();

      await user.click(screen.getByRole('button', {name: 'grow'}));

      expect(screen.getByText(L.totalRows(25))).toBeInTheDocument();
      expect(screen.getByText(L.pageOf(1, 3))).toBeInTheDocument();
      expect(screen.getByRole('button', {name: L.nextPage})).toBeEnabled();
    });

    function Shrinking() {
      const [count, setCount] = useState(25);
      return (
        <>
          <button onClick={() => setCount(15)}>shrink</button>
          <DataTable columns={columns} data={fruits(count)} pageSize={10} />
        </>
      );
    }

    it('moves to the last page when the rows under its page go away', async () => {
      const user = userEvent.setup();
      render(<Shrinking />);
      await user.click(screen.getByRole('button', {name: L.nextPage}));
      await user.click(screen.getByRole('button', {name: L.nextPage}));
      expect(screen.getByText(L.pageOf(3, 3))).toBeInTheDocument();

      await user.click(screen.getByRole('button', {name: 'shrink'}));

      expect(await screen.findByText(L.pageOf(2, 2))).toBeInTheDocument();
      expect(names()).toHaveLength(5);
    });

    it('stays on its page when the same rows arrive again', async () => {
      const user = userEvent.setup();
      const view = render(<DataTable columns={columns} data={fruits(25)} pageSize={10} />);
      await user.click(screen.getByRole('button', {name: L.nextPage}));

      // A refetch hands back a new array holding the same rows.
      view.rerender(<DataTable columns={columns} data={fruits(25)} pageSize={10} />);

      expect(screen.getByText(L.pageOf(2, 3))).toBeInTheDocument();
    });

    it('shows the page size it was given even when the options leave it out', () => {
      render(<DataTable columns={columns} data={fruits(25)} pageSize={15} pageSizeOptions={[10, 20]} />);

      expect(screen.getByRole('combobox', {name: L.rowsPerPage})).toHaveTextContent('15');
    });
  });
});

describe('DataTable fed one page at a time', () => {
  it('keeps the pager when a page comes back empty, so there is a way back', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        totalRows={40}
        manualPagination
        tableId="clientSide-empty-page"
        pageSize={10}
      />,
    );

    expect(screen.getByText(L.noData)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: L.nextPage})).toBeInTheDocument();
  });

  it('has no pager for a table with nothing in it', () => {
    render(<DataTable columns={columns} data={[]} totalRows={0} manualPagination />);

    expect(screen.queryByRole('button', {name: L.nextPage})).not.toBeInTheDocument();
  });
});

describe('onSelectionChange', () => {
  it('reports a selection that changes rows without changing size', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={fruits(3)}
        enableRowSelection
        enableMultiRowSelection={false}
        onSelectionChange={onSelectionChange}
      />,
    );
    const [, first, second] = screen.getAllByRole('checkbox');
    if (!first || !second) throw new Error('Expected a checkbox per row');

    await user.click(first);
    expect(onSelectionChange).toHaveBeenLastCalledWith([expect.objectContaining({name: 'Cherry'})]);

    await user.click(second);
    expect(onSelectionChange).toHaveBeenLastCalledWith([expect.objectContaining({name: 'Apple'})]);
  });
});

describe('DataTable as cards on a phone', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function onAPhone() {
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

  /** The title of every card, in the order the cards are on screen. */
  function cards(): string[] {
    return screen.getAllByRole('listitem').map((card) => within(card).getByRole('heading').textContent);
  }

  it('shows the next page of cards', async () => {
    onAPhone();
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={fruits(12)} pageSize={5} pageSizeOptions={[5, 10]} />);
    expect(cards()).toEqual(['Cherry', 'Apple', 'Banana', 'Elderberry', 'Damson']);

    await user.click(screen.getByRole('button', {name: L.nextPage}));

    expect(cards()).toEqual(['Fruit 6', 'Fruit 7', 'Fruit 8', 'Fruit 9', 'Fruit 10']);
  });

  it('narrows the cards to a search', async () => {
    onAPhone();
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={fruits(5)} />);

    await user.type(screen.getByRole('textbox', {name: L.globalSearch}), 'an');

    await waitFor(() => expect(cards()).toEqual(['Banana']));
  });

  it('shows new rows when the data is replaced', () => {
    onAPhone();
    const view = render(<DataTable columns={columns} data={fruits(2)} />);
    expect(cards()).toEqual(['Cherry', 'Apple']);

    view.rerender(<DataTable columns={columns} data={fruits(3)} />);

    expect(cards()).toEqual(['Cherry', 'Apple', 'Banana']);
  });

  it('applies the initial sort', () => {
    onAPhone();
    render(<DataTable columns={columns} data={fruits(5)} initialSorting={[{id: 'name', desc: false}]} />);

    expect(cards()).toEqual(['Apple', 'Banana', 'Cherry', 'Damson', 'Elderberry']);
  });
});
