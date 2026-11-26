/**
 * Which columns a CSV or Excel file holds, in what order, and under which headings.
 *
 * The file follows the screen: the visible columns, in the order the user dragged them
 * into, under the heading they read. A column can also opt out with `enableExport: false`
 * while it stays on screen (a thumbnail, a cell of buttons). When nothing is left to write,
 * no file is written: a file of blank lines reads as corruption, not as "you hid
 * everything".
 */
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import type {ColumnOrderState, VisibilityState} from '@tanstack/react-table';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {DEFAULT_LABELS} from '../i18n';
import {render} from '../test/test-utils';
import type {DataTableColumnDef, ExportFormat, RowData} from '../types';
import {ExportMenu} from './ExportMenu';

vi.mock('../export/excel', () => ({
  createHeaderRow: vi.fn((headers: string[]) => headers),
  createDataRow: vi.fn((values: string[]) => values),
  writeExcelFile: vi.fn(),
}));

interface Payout extends RowData {
  readonly id: string;
  readonly reference: string;
  readonly customer: string;
  readonly total: number;
  readonly payout_status: string;
  readonly photo: string;
}

const payouts: Payout[] = [
  {id: 'p-1', reference: '#10482', customer: 'Acme Logistics', total: 42, payout_status: 'Pending', photo: 'a.png'},
];

const columns: DataTableColumnDef<Payout>[] = [
  {id: 'reference', accessorKey: 'reference', header: 'Order'},
  {id: 'customer', accessorKey: 'customer', header: 'Customer'},
  {id: 'total', accessorKey: 'total', header: 'Total'},
  // A header drawn as a component has no text to read, so the id stands in for it.
  {id: 'payout_status', accessorKey: 'payout_status', header: () => <strong>Payout</strong>},
  {id: 'photo', accessorKey: 'photo', header: 'Photo', enableExport: false},
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
  return {contents, headings: () => contents.at(-1)?.replace('﻿', '').split('\n')[0]};
}

interface HarnessProps {
  readonly tableColumns?: DataTableColumnDef<Payout>[];
  readonly columnOrder?: ColumnOrderState;
  readonly columnVisibility?: VisibilityState;
  readonly formats?: ExportFormat[];
  readonly onExportComplete?: (format: ExportFormat, success: boolean) => void;
}

function Harness({
  tableColumns = columns,
  columnOrder = [],
  columnVisibility = {},
  formats = ['csv', 'xlsx', 'json'],
  onExportComplete,
}: Readonly<HarnessProps>) {
  'use no memo';
  const table = useReactTable({
    data: payouts,
    columns: tableColumns,
    initialState: {columnOrder, columnVisibility},
    getCoreRowModel: getCoreRowModel(),
  });
  return <ExportMenu table={table} formats={formats} onExportComplete={onExportComplete} />;
}

async function openMenu() {
  await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.exportLabel}));
}

async function exportCsv() {
  await openMenu();
  await userEvent.click(await screen.findByRole('menuitem', {name: DEFAULT_LABELS.exportCsv}));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ExportMenu, the columns in the file', () => {
  it('writes the columns in the order the user put them on screen', async () => {
    const download = setupDownloadMocks();
    render(<Harness columnOrder={['reference', 'total', 'customer', 'payout_status', 'photo']} />);

    await exportCsv();

    await waitFor(() => expect(download.headings()).toBe('Order,Total,Customer,Payout status'));
  });

  it('leaves out a column the user hid', async () => {
    const download = setupDownloadMocks();
    render(<Harness columnVisibility={{customer: false}} />);

    await exportCsv();

    await waitFor(() => expect(download.headings()).toBe('Order,Total,Payout status'));
  });

  it('leaves out a visible column marked enableExport: false', async () => {
    const download = setupDownloadMocks();
    render(<Harness />);

    await exportCsv();

    await waitFor(() => expect(download.headings()).not.toBeUndefined());
    expect(download.headings()).not.toContain('Photo');
    expect(download.contents.at(-1)).not.toContain('a.png');
  });

  it('heads a component header with a readable form of its id', async () => {
    const download = setupDownloadMocks();
    render(<Harness />);

    await exportCsv();

    await waitFor(() => expect(download.headings()).toBe('Order,Customer,Total,Payout status'));
  });

  it('prefers meta.label over the header and the id', async () => {
    const download = setupDownloadMocks();
    const labelled: DataTableColumnDef<Payout>[] = [
      {id: 'reference', accessorKey: 'reference', header: 'Ref', meta: {label: 'Order number'}},
      {id: 'payout_status', accessorKey: 'payout_status', header: () => 'x', meta: {label: 'Payout'}},
      {id: 'createdAt', accessorFn: () => '2026-11-01', header: () => null},
    ];
    render(<Harness tableColumns={labelled} />);

    await exportCsv();

    await waitFor(() => expect(download.headings()).toBe('Order number,Payout,Created at'));
  });

  it('writes no file and disables CSV and Excel when every visible column opts out', async () => {
    const download = setupDownloadMocks();
    const onExportComplete = vi.fn();
    render(
      <Harness
        columnVisibility={{reference: false, customer: false, total: false, payout_status: false}}
        onExportComplete={onExportComplete}
      />,
    );

    await openMenu();

    const csv = await screen.findByRole('menuitem', {name: DEFAULT_LABELS.exportCsv});
    expect(csv).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', {name: DEFAULT_LABELS.exportExcel})).toHaveAttribute('aria-disabled', 'true');
    // JSON writes the rows, not the columns, so it has something to say either way.
    expect(screen.getByRole('menuitem', {name: DEFAULT_LABELS.exportJson})).not.toHaveAttribute('aria-disabled');

    // A disabled item takes no pointer events, so the tooltip listens on a wrapper around it.
    await userEvent.hover(csv, {pointerEventsCheck: 0});
    expect(await screen.findAllByRole('tooltip')).not.toHaveLength(0);
    expect(screen.getAllByText(DEFAULT_LABELS.exportNoColumns)).not.toHaveLength(0);

    await userEvent.click(csv, {pointerEventsCheck: 0});
    expect(download.contents).toHaveLength(0);
    expect(onExportComplete).not.toHaveBeenCalled();
  });

  it('enables CSV again once the user shows a column', async () => {
    // What is exportable is read when the menu opens, not cached from the first render.
    function Toggle() {
      'use no memo';
      const table = useReactTable({
        data: payouts,
        columns,
        initialState: {columnVisibility: {reference: false, customer: false, total: false, payout_status: false}},
        getCoreRowModel: getCoreRowModel(),
      });
      return (
        <>
          <button type="button" onClick={() => table.getColumn('total')?.toggleVisibility(true)}>
            Show total
          </button>
          <ExportMenu table={table} formats={['csv']} />
        </>
      );
    }
    render(<Toggle />);

    await userEvent.click(screen.getByRole('button', {name: 'Show total'}));
    await openMenu();

    expect(await screen.findByRole('menuitem', {name: DEFAULT_LABELS.exportCsv})).not.toHaveAttribute('aria-disabled');
  });
});
