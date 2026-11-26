/**
 * The sticky bulk bar: a floating bar at the bottom of the viewport that, once a whole server
 * page is selected, offers every row the filters match. An action then hears
 * `allMatching: true` with the table's state, and acts on the filter instead of the ids.
 */
import type {ColumnDef, RowSelectionState} from '@tanstack/react-table';
import {getCoreRowModel, getFilteredRowModel, useReactTable} from '@tanstack/react-table';
import {screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';

import {DEFAULT_LABELS} from '../i18n';
import {parentOf, render} from '../test/test-utils';
import type {BulkAction, BulkActionContext, BulkActionResult} from '../types';
import {BulkActions} from './BulkActions';

interface Order {
  readonly id: string;
  readonly [key: string]: unknown;
}

const page: Order[] = [{id: 'o-1'}, {id: 'o-2'}, {id: 'o-3'}];

const columns: ColumnDef<Order>[] = [{id: 'id', accessorKey: 'id'}];

const WHOLE_PAGE: RowSelectionState = {'o-1': true, 'o-2': true, 'o-3': true};

type OnClick = (rows: Order[], context: BulkActionContext) => Promise<void | BulkActionResult>;

interface HarnessOptions {
  readonly selected?: RowSelectionState;
  readonly matchingCount?: number;
  readonly position?: 'inline' | 'sticky';
  readonly confirmMessage?: (count: number) => string;
}

/** The bar over a real table, with buttons to change the selection and the search. */
function renderBar(onClick: OnClick, options: HarnessOptions = {}) {
  const {selected = WHOLE_PAGE, position = 'sticky', confirmMessage} = options;
  // Not a default in the destructuring: a test passes `undefined` on purpose.
  const matchingCount = 'matchingCount' in options ? options.matchingCount : 40;
  const action: BulkAction<Order> = {id: 'archive', label: 'Archive', onClick, confirmMessage};

  function Harness() {
    'use no memo';
    const [rowSelection, setRowSelection] = useState<RowSelectionState>(selected);
    const [globalFilter, setGlobalFilter] = useState('');
    const table = useReactTable({
      data: page,
      columns,
      state: {rowSelection, globalFilter},
      onRowSelectionChange: setRowSelection,
      enableRowSelection: true,
      manualFiltering: true,
      getRowId: (row) => row.id,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
    });
    return (
      <>
        <button type="button" onClick={() => setRowSelection({'o-1': true})}>
          select one
        </button>
        <button type="button" onClick={() => setRowSelection(WHOLE_PAGE)}>
          select page
        </button>
        <button type="button" onClick={() => setGlobalFilter('late')}>
          search late
        </button>
        <BulkActions
          table={table}
          actions={[action]}
          rowSelection={rowSelection}
          position={position}
          matchingCount={matchingCount}
        />
      </>
    );
  }

  return render(<Harness />);
}

/** The floating paper, or the inline bar's parent: action button, action row, bar, then this. */
const barOf = (button: HTMLElement) => parentOf(parentOf(parentOf(button)));

const offer = () => screen.queryByRole('button', {name: DEFAULT_LABELS.selectAllMatching(40)});

describe('BulkActions, sticky', () => {
  it('mounts on the first selection, fixed to the viewport', async () => {
    renderBar(vi.fn<OnClick>(), {selected: {}});
    expect(screen.queryByRole('button', {name: 'Archive'})).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'select one'}));

    expect(barOf(screen.getByRole('button', {name: 'Archive'}))).toHaveStyle({position: 'fixed'});
  });

  it('offers every matching row only once the whole page is selected', async () => {
    renderBar(vi.fn<OnClick>(), {selected: {'o-1': true}});
    expect(offer()).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'select page'}));

    expect(offer()).toBeInTheDocument();
  });

  it('hands the action allMatching and the table state once the offer is taken', async () => {
    const onClick = vi.fn<OnClick>().mockResolvedValue(undefined);
    renderBar(onClick);

    await userEvent.click(offer() as HTMLElement);
    expect(screen.getByText(DEFAULT_LABELS.allMatchingSelected(40))).toBeInTheDocument();
    expect(offer()).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Archive'}));

    expect(onClick).toHaveBeenCalledExactlyOnceWith(page, {
      allMatching: true,
      state: {pagination: {pageIndex: 0, pageSize: 10}, sorting: [], columnFilters: [], globalFilter: ''},
    });
  });

  it('confirms with the matching count, not the page', async () => {
    const confirmMessage = vi.fn((count: number) => `Archive ${count}?`);
    renderBar(vi.fn<OnClick>(), {confirmMessage});

    await userEvent.click(offer() as HTMLElement);
    await userEvent.click(screen.getByRole('button', {name: 'Archive'}));

    expect(await screen.findByText('Archive 40?')).toBeInTheDocument();
  });

  it('drops the choice when the selection changes', async () => {
    const onClick = vi.fn<OnClick>().mockResolvedValue(undefined);
    renderBar(onClick);
    await userEvent.click(offer() as HTMLElement);

    await userEvent.click(screen.getByRole('button', {name: 'select one'}));
    await userEvent.click(screen.getByRole('button', {name: 'select page'}));

    expect(screen.getByText(`3 ${DEFAULT_LABELS.selected}`)).toBeInTheDocument();
    expect(offer()).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Archive'}));
    expect(onClick).toHaveBeenCalledWith(page, expect.objectContaining({allMatching: false}));
  });

  it('drops the choice when the selection is cleared and picked again', async () => {
    renderBar(vi.fn<OnClick>());
    await userEvent.click(offer() as HTMLElement);

    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.clearSelection}));
    await userEvent.click(screen.getByRole('button', {name: 'select page'}));

    expect(screen.getByText(`3 ${DEFAULT_LABELS.selected}`)).toBeInTheDocument();
  });

  it('drops the choice when the search changes', async () => {
    renderBar(vi.fn<OnClick>());
    await userEvent.click(offer() as HTMLElement);

    await userEvent.click(screen.getByRole('button', {name: 'search late'}));

    expect(screen.getByText(`3 ${DEFAULT_LABELS.selected}`)).toBeInTheDocument();
    expect(offer()).toBeInTheDocument();
  });

  it('offers nothing when the page already holds every match', () => {
    renderBar(vi.fn<OnClick>(), {matchingCount: 3});

    expect(screen.queryByRole('button', {name: /matching/})).not.toBeInTheDocument();
  });

  it('offers nothing without a matching count', () => {
    renderBar(vi.fn<OnClick>(), {matchingCount: undefined});

    expect(screen.queryByRole('button', {name: /matching/})).not.toBeInTheDocument();
  });

  it('offers nothing inline, where the bar sits above the table as before', () => {
    renderBar(vi.fn<OnClick>(), {position: 'inline'});

    expect(barOf(screen.getByRole('button', {name: 'Archive'}))).not.toHaveStyle({position: 'fixed'});
    expect(offer()).not.toBeInTheDocument();
  });

  it('shows a partial result inside the floating bar', async () => {
    const onClick = vi.fn<OnClick>().mockResolvedValue({succeeded: ['o-1', 'o-2'], failed: ['o-3']});
    renderBar(onClick);

    await userEvent.click(screen.getByRole('button', {name: 'Archive'}));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(DEFAULT_LABELS.bulkResult(2, 1));
    const paper = parentOf(alert);
    expect(paper).toHaveStyle({position: 'fixed'});
    expect(within(paper).getByText(`1 ${DEFAULT_LABELS.selected}`)).toBeVisible();
  });
});
