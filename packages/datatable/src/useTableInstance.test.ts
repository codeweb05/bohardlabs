/**
 * Direct coverage for `useTableInstance`, the wiring between the DataTable's state and
 * TanStack's table instance.
 *
 * Everything here is exercised through `<DataTable>` elsewhere, with two exceptions the
 * rendered component cannot reach: the row-id resolver (useTableInstance.ts:129) and
 * `getRowCanExpand` (:182). Both are options TanStack calls, not UI, so the only way to
 * assert them is to hold the table instance and ask it.
 *
 * Why they matter for a package: the row id is the key for row selection and for the
 * persisted expansion state, so a consumer whose rows have no `id` field gets
 * "undefined" keys for every row and a selection that behaves as if all rows were the
 * same one. `getRowCanExpand` is what a consumer's own renderer would ask before drawing
 * a chevron.
 */
import {act, renderHook} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import type {DataTableColumnDef, RowData} from './types';
import {useDataTableState} from './useDataTableState';
import {useTableInstance} from './useTableInstance';

interface Item extends RowData {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

const data: Item[] = [
  {id: 'row-1', code: 'AAA', name: 'Detergent'},
  {id: 'row-2', code: 'BBB', name: 'Softener'},
];

const tableColumns: DataTableColumnDef<Item>[] = [
  {id: 'code', accessorKey: 'code', header: 'Code'},
  {id: 'name', accessorKey: 'name', header: 'Name'},
];

interface HarnessOptions {
  readonly getRowId?: (row: Item) => string;
  readonly enableExpanding?: boolean;
  readonly totalRows?: number;
  readonly manualPagination?: boolean;
}

function renderTable(options: HarnessOptions = {}) {
  return renderHook(() => {
    const state = useDataTableState({
      initialPageSize: 10,
      initialSorting: [],
      initialFilters: [],
      initialGlobalFilter: '',
      initialColumnOrder: [],
      initialColumnPinning: {},
      initialColumnVisibility: {},
      initialRowSelection: {},
      manualPagination: options.manualPagination ?? false,
      initialDensity: 'comfortable',
      initialGrouping: [],
      data,
    });

    return useTableInstance<Item>({
      data,
      tableColumns,
      state,
      totalRows: options.totalRows,
      getRowId: options.getRowId,
      enablePagination: true,
      manualPagination: options.manualPagination ?? false,
      enableSorting: true,
      manualSorting: false,
      enableMultiSort: false,
      enableFiltering: true,
      manualFiltering: false,
      enableColumnPinning: true,
      enableColumnResizing: true,
      enableRowSelection: true,
      enableMultiRowSelection: true,
      enableExpanding: options.enableExpanding ?? false,
      enableGrouping: false,
    });
  });
}

describe('useTableInstance — row ids', () => {
  it('falls back to the row.id field', () => {
    const {result} = renderTable();

    expect(result.current.getRowModel().rows.map((row) => row.id)).toEqual(['row-1', 'row-2']);
  });

  it('uses a custom resolver when one is supplied', () => {
    // Rows keyed by something other than `id` are the norm for API data that uses
    // `uuid`, `code` or a composite key.
    const {result} = renderTable({getRowId: (row) => row.code});

    expect(result.current.getRowModel().rows.map((row) => row.id)).toEqual(['AAA', 'BBB']);
  });

  it('keeps row selection keyed by the resolved id', () => {
    const {result} = renderTable({getRowId: (row) => row.code});

    act(() => {
      result.current.getRowModel().rows[0].toggleSelected(true);
    });

    expect(result.current.getState().rowSelection).toEqual({AAA: true});
  });
});

describe('useTableInstance — expansion', () => {
  it('reports every row as expandable when expanding is on', () => {
    // The DataTable renders a chevron on every row rather than asking the data, so the
    // table instance has to agree, or a consumer reading `row.getCanExpand()` would
    // draw a different set of chevrons than the one the user sees.
    const {result} = renderTable({enableExpanding: true});

    expect(result.current.getRowModel().rows.every((row) => row.getCanExpand())).toBe(true);
  });

  it('reports no row as expandable when expanding is off', () => {
    const {result} = renderTable();

    expect(result.current.getRowModel().rows.some((row) => row.getCanExpand())).toBe(false);
  });
});

describe('useTableInstance — server-side pagination', () => {
  it('derives the page count from the server row count', () => {
    // 42 rows at 10 per page is 5 pages. Getting this wrong disables the next-page
    // button one page early, and the last rows become unreachable.
    const {result} = renderTable({totalRows: 42, manualPagination: true});

    expect(result.current.getPageCount()).toBe(5);
  });

  it('leaves the page count to TanStack when no total is given', () => {
    const {result} = renderTable();

    expect(result.current.getPageCount()).toBe(1);
  });
});
