import {ThemeProvider, alpha, createTheme} from '@mui/material';
import {within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {DataTable} from '../DataTable';
import {DataTableLabelsProvider} from '../i18n';
import type {TestRole} from '../test/test-utils';
import {generateTestRoles, parentOf, render, screen, waitFor} from '../test/test-utils';
import type {DataTableColumnDef} from '../types';
import {FilterChips} from './FilterChips';

type Row = {id: string; status: string; total: number};

const columns: DataTableColumnDef<Row>[] = [
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    filterConfig: {type: 'select', operator: 'notEquals', options: [{label: 'Cancelled', value: 'cancelled'}]},
  },
  {id: 'total', accessorKey: 'total', header: () => 'Total', filterConfig: {type: 'number'}},
];

const onRemove = vi.fn();
const onClearAll = vi.fn();

beforeEach(() => {
  onRemove.mockReset();
  onClearAll.mockReset();
});

describe('FilterChips', () => {
  it('renders nothing while no filter and no search is set', () => {
    const {container} = render(
      <FilterChips columns={columns} columnFilters={[]} globalFilter="" onRemove={onRemove} onClearAll={onClearAll} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a filter that narrows nothing', () => {
    const {container} = render(
      <FilterChips
        columns={columns}
        columnFilters={[{id: 'total', value: [null, null]}]}
        globalFilter=""
        onRemove={onRemove}
        onClearAll={onClearAll}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('says what each filter sends, and names a column without a string header by its id', () => {
    render(
      <FilterChips
        columns={columns}
        columnFilters={[
          {id: 'status', value: 'cancelled'},
          {id: 'total', value: [10, 50]},
          {id: 'gone', value: 'x'},
        ]}
        globalFilter=""
        onRemove={onRemove}
        onClearAll={onClearAll}
      />,
    );

    const group = screen.getByRole('group', {name: '3 active filter(s)'});
    expect(within(group).getByText('Status is not Cancelled')).toBeInTheDocument();
    expect(within(group).getByText('total between 10 and 50')).toBeInTheDocument();
    // A filter for a column the table does not declare reads off its value.
    expect(within(group).getByText('gone contains x')).toBeInTheDocument();
  });

  it('removes one filter by its column id', async () => {
    render(
      <FilterChips
        columns={columns}
        columnFilters={[{id: 'status', value: 'cancelled'}]}
        globalFilter=""
        onRemove={onRemove}
        onClearAll={onClearAll}
      />,
    );

    await userEvent.click(screen.getByRole('button', {name: 'Remove filter: Status is not Cancelled'}));

    expect(onRemove).toHaveBeenCalledWith('status');
  });

  it('shows the search as a chip with no remove button, and clears everything', async () => {
    render(
      <FilterChips
        columns={columns}
        columnFilters={[]}
        globalFilter="acme"
        onRemove={onRemove}
        onClearAll={onClearAll}
      />,
    );

    const group = screen.getByRole('group', {name: '1 active filter(s)'});
    expect(within(group).getByText('Search: “acme”')).toBeInTheDocument();
    expect(within(group).queryByRole('button', {name: /remove filter/i})).not.toBeInTheDocument();

    await userEvent.click(within(group).getByRole('button', {name: 'Clear all'}));

    expect(onClearAll).toHaveBeenCalledOnce();
  });

  it('keeps its chips when the table re-renders with the same filters', () => {
    const filters = () => [{id: 'status', value: 'cancelled'}];
    const {rerender} = render(
      <FilterChips
        columns={columns}
        columnFilters={filters()}
        globalFilter=""
        onRemove={onRemove}
        onClearAll={onClearAll}
      />,
    );

    // A new array with the same filters, as a parent re-render hands over.
    rerender(
      <FilterChips
        columns={columns}
        columnFilters={filters()}
        globalFilter=""
        onRemove={onRemove}
        onClearAll={onClearAll}
      />,
    );

    expect(screen.getByRole('group', {name: '1 active filter(s)'})).toBeInTheDocument();
    expect(screen.getByText('Status is not Cancelled')).toBeInTheDocument();
  });

  it('keeps its chips when the table re-renders with nothing changed', () => {
    const filters = [{id: 'status', value: 'cancelled'}];
    const chips = (
      <FilterChips
        columns={columns}
        columnFilters={filters}
        globalFilter=""
        onRemove={onRemove}
        onClearAll={onClearAll}
      />
    );
    const {rerender} = render(chips);

    // The same props again, so the compiled component reuses everything it drew last time.
    rerender(
      <FilterChips
        columns={columns}
        columnFilters={filters}
        globalFilter=""
        onRemove={onRemove}
        onClearAll={onClearAll}
      />,
    );

    expect(screen.getByRole('group', {name: '1 active filter(s)'})).toBeInTheDocument();
    expect(screen.getByText('Status is not Cancelled')).toBeInTheDocument();
  });

  it.each([
    ['light', 0.12],
    ['dark', 0.24],
  ] as const)('tints a chip from the primary colour under a %s theme', (mode, opacity) => {
    // 12% of the primary colour is lost against a dark paper, so dark mode doubles it.
    const theme = createTheme({palette: {mode}});
    render(
      <ThemeProvider theme={theme}>
        <FilterChips
          columns={columns}
          columnFilters={[{id: 'status', value: 'cancelled'}]}
          globalFilter=""
          onRemove={onRemove}
          onClearAll={onClearAll}
        />
      </ThemeProvider>,
    );

    // The text sits in a span inside the chip's label span, so the chip is two levels up.
    const chip = parentOf(parentOf(screen.getByText('Status is not Cancelled')));
    expect(chip).toHaveStyle({backgroundColor: alpha(theme.palette.primary.main, opacity)});
  });

  it('takes its words from the labels', () => {
    render(
      <DataTableLabelsProvider
        labels={{filterSearch: (term) => `Recherche : ${term}`, clearAllFilters: 'Tout effacer'}}
      >
        <FilterChips
          columns={columns}
          columnFilters={[]}
          globalFilter="acme"
          onRemove={onRemove}
          onClearAll={onClearAll}
        />
      </DataTableLabelsProvider>,
    );

    expect(screen.getByText('Recherche : acme')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Tout effacer'})).toBeInTheDocument();
  });
});

describe('DataTable with enableFilterChips', () => {
  const roles = generateTestRoles(30);
  const roleColumns: DataTableColumnDef<TestRole>[] = [
    {id: 'name', accessorKey: 'name', header: 'Name', filterConfig: {type: 'text'}},
    {id: 'roleType', accessorKey: 'roleType', header: 'Type', filterConfig: {type: 'text'}},
  ];

  function lastState(onServerStateChange: ReturnType<typeof vi.fn>) {
    return onServerStateChange.mock.calls.at(-1)?.[0] as {
      pagination: {pageIndex: number};
      columnFilters: {id: string}[];
      globalFilter: string;
    };
  }

  it('shows no chip row unless asked to', () => {
    render(<DataTable columns={roleColumns} data={roles} initialFilters={[{id: 'name', value: 'Role'}]} />);

    expect(screen.queryByRole('group', {name: /active filter/i})).not.toBeInTheDocument();
  });

  it('removes a filter from its chip and goes back to page 1', async () => {
    const onServerStateChange = vi.fn();
    render(
      <DataTable
        columns={roleColumns}
        data={roles}
        pageSize={5}
        enableFilterChips
        initialFilters={[
          {id: 'name', value: 'Role'},
          {id: 'roleType', value: 'ADMIN'},
        ]}
        onServerStateChange={onServerStateChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', {name: 'Next page'}));
    await waitFor(() => expect(lastState(onServerStateChange).pagination.pageIndex).toBe(1));

    await userEvent.click(screen.getByRole('button', {name: 'Remove filter: Type contains ADMIN'}));

    await waitFor(() => expect(lastState(onServerStateChange).columnFilters).toEqual([{id: 'name', value: 'Role'}]));
    expect(lastState(onServerStateChange).pagination.pageIndex).toBe(0);
  });

  it('clears every filter and the search with Clear all', async () => {
    const onServerStateChange = vi.fn();
    render(
      <DataTable
        columns={roleColumns}
        data={roles}
        enableFilterChips
        initialFilters={[{id: 'name', value: 'Role'}]}
        initialGlobalFilter="Role"
        onServerStateChange={onServerStateChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', {name: 'Clear all'}));

    await waitFor(() => expect(lastState(onServerStateChange)).toMatchObject({columnFilters: [], globalFilter: ''}));
    expect(screen.queryByRole('group', {name: /active filter/i})).not.toBeInTheDocument();
  });
});
