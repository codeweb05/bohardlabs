/**
 * Exporting every row the filters match, not the page the table holds.
 *
 * Under server paging the table holds one page, so a file built from it is one page. With
 * `exportRows` the menu offers each format for the current page and for all matching rows,
 * fetched by the consumer with the table's state at the click. Without it, the menu says
 * "Current page only", so the file is never silently partial.
 */
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import type {TableState} from '@tanstack/react-table';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {DEFAULT_LABELS} from '../i18n';
import {render} from '../test/test-utils';
import type {DataTableColumnDef, ExportFormat, RowData, ServerTableState} from '../types';
import {ExportMenu} from './ExportMenu';

vi.mock('../export/excel', () => ({
  createHeaderRow: vi.fn((headers: string[]) => headers),
  createDataRow: vi.fn((values: string[]) => values),
  writeExcelFile: vi.fn(),
}));

interface Payout extends RowData {
  readonly id: string;
  readonly reference: string;
  readonly status: string;
}

const page: Payout[] = [{id: 'p-1', reference: '#10482', status: 'pending'}];

const matching: Payout[] = [
  {id: 'p-1', reference: '#10482', status: 'pending'},
  {id: 'p-2', reference: '#10477', status: 'paid'},
  {id: 'p-3', reference: '#10469', status: 'paid'},
];

const columns: DataTableColumnDef<Payout>[] = [
  {id: 'reference', accessorKey: 'reference', header: 'Order'},
  // Draws its own text, so a fetched row has to be mounted to be read, like a row on screen.
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    cell: ({row}) => <span>{row.original.status.toUpperCase()}</span>,
  },
];

const originalCreateElement = document.createElement.bind(document);

/** Captures what the component hands to `new Blob(...)`; jsdom's Blob cannot be read. */
function setupDownloadMocks() {
  const contents: string[] = [];
  const OriginalBlob = globalThis.Blob;
  vi.stubGlobal(
    'Blob',
    class MockBlob extends OriginalBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        contents.push(String(parts[0]));
      }
    },
  );
  vi.stubGlobal('URL', {createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn()});
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = originalCreateElement(tag);
    if (tag === 'a') el.click = vi.fn();
    return el;
  });
  return {contents, lines: () => contents.at(-1)?.replace('﻿', '').split('\n')};
}

interface HarnessProps {
  readonly exportRows?: (state: ServerTableState) => Promise<readonly Payout[]>;
  readonly exportRowLimit?: number;
  readonly totalRows?: number;
  readonly manualPagination?: boolean;
  readonly formats?: ExportFormat[];
  readonly initialState?: Partial<TableState>;
  readonly onExport?: (format: ExportFormat, data: Payout[]) => void;
  readonly onExportComplete?: (format: ExportFormat, success: boolean) => void;
  /** False for a table with no `getRowId`, which TanStack then ids by index. */
  readonly rowIds?: boolean;
}

function Harness({formats = ['csv'], initialState, rowIds = true, ...props}: Readonly<HarnessProps>) {
  'use no memo';
  const table = useReactTable({
    data: page,
    columns,
    initialState,
    getRowId: rowIds ? (row) => row.id : undefined,
    getCoreRowModel: getCoreRowModel(),
  });
  return <ExportMenu table={table} formats={formats} manualPagination {...props} />;
}

/** An `exportRows` that waits until the test hands it the rows. */
function deferredRows() {
  let settle: (rows: readonly Payout[]) => void = () => {};
  const exportRows = () =>
    new Promise<readonly Payout[]>((done) => {
      settle = done;
    });
  return {exportRows, resolve: (rows: readonly Payout[]) => settle(rows)};
}

async function openMenu() {
  await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.exportLabel}));
}

/** The CSV item under one heading. Both read "Export CSV"; the heading is their description. */
function csvItem(heading: string | RegExp) {
  return screen.findByRole('menuitem', {name: DEFAULT_LABELS.exportCsv, description: heading});
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ExportMenu, all matching rows', () => {
  it('offers the current page and every matching row, counted from totalRows', async () => {
    render(<Harness exportRows={vi.fn()} totalRows={1284} />);

    await openMenu();

    expect(await csvItem(DEFAULT_LABELS.exportCurrentPage(1))).toBeInTheDocument();
    expect(await csvItem(DEFAULT_LABELS.exportAllMatching(1284))).toBeInTheDocument();
    expect(screen.getByText('All matching · 1,284 rows')).toBeInTheDocument();
  });

  it('hands exportRows the table state at the click, and writes the rows it returns', async () => {
    const download = setupDownloadMocks();
    const exportRows = vi.fn(() => Promise.resolve(matching));
    const onExportComplete = vi.fn();
    const state: ServerTableState = {
      pagination: {pageIndex: 2, pageSize: 25},
      sorting: [{id: 'reference', desc: true}],
      columnFilters: [{id: 'status', value: 'paid'}],
      globalFilter: 'acme',
    };
    render(<Harness exportRows={exportRows} totalRows={3} initialState={state} onExportComplete={onExportComplete} />);

    await openMenu();
    await userEvent.click(await csvItem(DEFAULT_LABELS.exportAllMatching(3)));

    expect(exportRows).toHaveBeenCalledWith(state);
    await waitFor(() => expect(onExportComplete).toHaveBeenCalledWith('csv', true));
    // Same columns and the same drawn text as the page would get.
    expect(download.lines()).toEqual(['Order,Status', '#10482,PENDING', '#10477,PAID', '#10469,PAID']);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('writes the fetched rows from a table that has no getRowId', async () => {
    const download = setupDownloadMocks();
    render(<Harness exportRows={() => Promise.resolve(matching)} totalRows={3} rowIds={false} />);

    await openMenu();
    await userEvent.click(await csvItem(DEFAULT_LABELS.exportAllMatching(3)));

    await waitFor(() =>
      expect(download.lines()).toEqual(['Order,Status', '#10482,PENDING', '#10477,PAID', '#10469,PAID']),
    );
  });

  it('still exports the page alone from the current page items', async () => {
    const download = setupDownloadMocks();
    const exportRows = vi.fn(() => Promise.resolve(matching));
    render(<Harness exportRows={exportRows} totalRows={3} />);

    await openMenu();
    await userEvent.click(await csvItem(DEFAULT_LABELS.exportCurrentPage(1)));

    await waitFor(() => expect(download.lines()).toEqual(['Order,Status', '#10482,PENDING']));
    expect(exportRows).not.toHaveBeenCalled();
  });

  it('hands the fetched records to onExport', async () => {
    const onExport = vi.fn();
    render(<Harness exportRows={() => Promise.resolve(matching)} totalRows={3} onExport={onExport} />);

    await openMenu();
    await userEvent.click(await csvItem(DEFAULT_LABELS.exportAllMatching(3)));

    await waitFor(() => expect(onExport).toHaveBeenCalledWith('csv', matching));
  });

  it('shows progress while the rows are on their way', async () => {
    setupDownloadMocks();
    const {exportRows, resolve} = deferredRows();
    render(<Harness exportRows={exportRows} totalRows={3} />);

    await openMenu();
    await userEvent.click(await csvItem(DEFAULT_LABELS.exportAllMatching(3)));

    expect(await screen.findByText(DEFAULT_LABELS.exportPreparing)).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', {name: DEFAULT_LABELS.exportCsv})).not.toBeInTheDocument();

    resolve(matching);
    await waitFor(() => expect(screen.queryByText(DEFAULT_LABELS.exportPreparing)).not.toBeInTheDocument());
  });

  it('cancels: no file, and onExportComplete hears false at once', async () => {
    const download = setupDownloadMocks();
    const {exportRows, resolve} = deferredRows();
    const onExportComplete = vi.fn();
    render(<Harness exportRows={exportRows} totalRows={3} onExportComplete={onExportComplete} />);

    await openMenu();
    await userEvent.click(await csvItem(DEFAULT_LABELS.exportAllMatching(3)));
    await userEvent.click(await screen.findByRole('menuitem', {name: DEFAULT_LABELS.cancel}));

    expect(onExportComplete).toHaveBeenCalledWith('csv', false);
    expect(screen.queryByText(DEFAULT_LABELS.exportPreparing)).not.toBeInTheDocument();

    // The rows arriving late write nothing and report nothing more.
    resolve(matching);
    await new Promise((done) => setTimeout(done, 0));
    expect(download.contents).toHaveLength(0);
    expect(onExportComplete).toHaveBeenCalledTimes(1);
  });

  it('stays quiet about a rejection that lands after a cancel', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail: (error: Error) => void = () => {};
    const exportRows = () =>
      new Promise<readonly Payout[]>((_, reject) => {
        fail = reject;
      });
    const onExportComplete = vi.fn();
    render(<Harness exportRows={exportRows} totalRows={3} onExportComplete={onExportComplete} />);

    await openMenu();
    await userEvent.click(await csvItem(DEFAULT_LABELS.exportAllMatching(3)));
    await userEvent.click(await screen.findByRole('menuitem', {name: DEFAULT_LABELS.cancel}));

    fail(new Error('timeout'));
    await new Promise((done) => setTimeout(done, 0));

    expect(onExportComplete).toHaveBeenCalledTimes(1);
    expect(onExportComplete).toHaveBeenCalledWith('csv', false);
    expect(consoleError).not.toHaveBeenCalled();
    expect(screen.queryByText(DEFAULT_LABELS.exportFailed)).not.toBeInTheDocument();
  });

  it('counts all matching from the rows held when there is no totalRows', async () => {
    render(<Harness exportRows={vi.fn()} />);

    await openMenu();

    expect(await csvItem(DEFAULT_LABELS.exportAllMatching(1))).toBeInTheDocument();
  });

  it('reports a rejection through onExportComplete and says so in the menu', async () => {
    const download = setupDownloadMocks();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onExportComplete = vi.fn();
    render(
      <Harness
        exportRows={() => Promise.reject(new Error('timeout'))}
        totalRows={3}
        onExportComplete={onExportComplete}
      />,
    );

    await openMenu();
    await userEvent.click(await csvItem(DEFAULT_LABELS.exportAllMatching(3)));

    expect(await screen.findByText(DEFAULT_LABELS.exportFailed)).toBeInTheDocument();
    expect(onExportComplete).toHaveBeenCalledWith('csv', false);
    expect(consoleError).toHaveBeenCalled();
    expect(download.contents).toHaveLength(0);
    // The items are back, so the user can try again.
    expect(await csvItem(DEFAULT_LABELS.exportAllMatching(3))).not.toHaveAttribute('aria-disabled');
  });

  it('disables all matching above the limit, and says why', async () => {
    const exportRows = vi.fn();
    render(<Harness exportRows={exportRows} totalRows={12_480} />);

    await openMenu();

    const reason = DEFAULT_LABELS.exportRowLimitReached(12_480, 10_000);
    expect(screen.getByText(reason)).toBeInTheDocument();
    const item = await csvItem(new RegExp(DEFAULT_LABELS.exportAllMatching(12_480)));
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(await csvItem(DEFAULT_LABELS.exportCurrentPage(1))).not.toHaveAttribute('aria-disabled');

    await userEvent.click(item, {pointerEventsCheck: 0});
    expect(exportRows).not.toHaveBeenCalled();
  });

  it('takes a different limit from exportRowLimit', async () => {
    render(<Harness exportRows={vi.fn()} totalRows={12_480} exportRowLimit={20_000} />);

    await openMenu();

    expect(await csvItem(DEFAULT_LABELS.exportAllMatching(12_480))).not.toHaveAttribute('aria-disabled');
  });
});

describe('ExportMenu, server paging without exportRows', () => {
  it('says the file is the current page only', async () => {
    render(<Harness />);

    await openMenu();

    expect(await csvItem(DEFAULT_LABELS.exportCurrentPageOnly(1))).toBeInTheDocument();
    expect(screen.getByText('Current page only · 1 row')).toBeInTheDocument();
  });

  it('adds no heading to a table that does not page on the server', async () => {
    render(<Harness manualPagination={false} />);

    await openMenu();

    expect(await screen.findByRole('menuitem', {name: DEFAULT_LABELS.exportCsv})).not.toHaveAttribute(
      'aria-describedby',
    );
    expect(screen.queryByText(DEFAULT_LABELS.exportCurrentPageOnly(1))).not.toBeInTheDocument();
  });
});
