/**
 * Coverage for the export value coercion (`toExportString` / `getColumnValue`,
 * ExportMenu.tsx:125-142) and for the JSON format (ExportMenu.tsx:197-199), none of
 * which anything reached.
 *
 * The existing ExportMenu tests drive a hand-built mock table with string columns, so
 * every value took the `typeof value === 'string'` path. Real rows are not like that:
 * a laundry order carries arrays (item lists), nested objects (customer, address),
 * booleans, numbers and nulls, and list pages add display-only columns with no accessor
 * at all. Each of those has its own branch here, and getting one wrong ships a CSV with
 * "[object Object]" or "undefined" in it to whoever the user sends the file to.
 *
 * A real table instance is used rather than a mock so the column defs are the ones
 * TanStack actually hands the exporter.
 */
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {DEFAULT_LABELS} from '../i18n';
import {render} from '../test/test-utils';
import type {DataTableColumnDef, ExportFormat, RowData} from '../types';
import {ExportMenu} from './ExportMenu';

interface Order extends RowData {
  readonly id: string;
  readonly items: string[];
  readonly customer: {name: string};
  readonly total: number;
  readonly paid: boolean;
  readonly note: string | null;
}

const orders: Order[] = [
  {
    id: 'order-1',
    items: ['Shirt', 'Trousers'],
    customer: {name: 'Ada'},
    total: 42.5,
    paid: true,
    note: null,
  },
];

const columns: DataTableColumnDef<Order>[] = [
  {id: 'items', accessorKey: 'items', header: 'Items'},
  {id: 'customer', accessorKey: 'customer', header: 'Customer'},
  {id: 'total', accessorKey: 'total', header: 'Total'},
  {id: 'paid', accessorKey: 'paid', header: 'Paid'},
  {id: 'note', accessorKey: 'note', header: 'Note'},
  {id: 'reference', accessorFn: (row) => `REF-${row.id}`, header: 'Reference'},
  {id: 'spacer', header: 'Spacer'},
];

const originalCreateElement = document.createElement.bind(document);

/** Captures what the component hands to `new Blob(...)`; jsdom's Blob cannot be read. */
function setupDownloadMocks() {
  let lastBlobContent = '';
  let lastLink: HTMLAnchorElement | null = null;
  const OriginalBlob = globalThis.Blob;
  vi.stubGlobal(
    'Blob',
    class MockBlob extends OriginalBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        lastBlobContent = String(parts[0]);
      }
    },
  );

  vi.stubGlobal('URL', {createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn()});

  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = originalCreateElement(tag);
    if (tag === 'a') {
      el.click = vi.fn();
      lastLink = el as HTMLAnchorElement;
    }
    return el;
  });

  return {getContent: () => lastBlobContent, getLink: () => lastLink};
}

interface HarnessProps {
  readonly tableColumns?: DataTableColumnDef<Order>[];
  readonly formats?: ExportFormat[];
  readonly fileName?: string;
  readonly onExport?: (format: ExportFormat, rows: Order[]) => void;
}

function Harness({
  tableColumns = columns,
  formats = ['csv', 'json'],
  fileName = 'orders',
  onExport,
}: Readonly<HarnessProps>) {
  'use no memo';
  const table = useReactTable({data: orders, columns: tableColumns, getCoreRowModel: getCoreRowModel()});
  return <ExportMenu table={table} formats={formats} fileName={fileName} onExport={onExport} />;
}

async function exportAs(label: string) {
  await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.exportLabel}));
  await userEvent.click(await screen.findByRole('menuitem', {name: label}));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ExportMenu — turning row values into text', () => {
  it('writes every value shape the way a spreadsheet expects', async () => {
    const download = setupDownloadMocks();
    render(<Harness />);

    await exportAs(DEFAULT_LABELS.exportCsv);

    await waitFor(() => {
      expect(download.getContent()).not.toBe('');
    });
    const [, row] = download.getContent().split('\n');
    // An array becomes a readable list, and because that list contains a comma the
    // whole field has to be quoted or it would silently become two columns.
    expect(row).toContain('"Shirt, Trousers"');
    expect(row).toContain('42.5');
    expect(row).toContain('true');
    expect(row).toContain('REF-order-1');
    // A nested object, a null and a column with no accessor all export as empty rather
    // than "[object Object]", "null" or "undefined".
    expect(row).not.toContain('object');
    expect(row).not.toContain('null');
    expect(row).not.toContain('undefined');
    expect(row.split(',')).toHaveLength(8);
  });

  it('names the downloaded file after the fileName prop', async () => {
    // The extension is appended per format, so a consumer passing "orders" gets
    // orders.csv here and orders.json below. Nothing asserted that before.
    const download = setupDownloadMocks();
    render(<Harness />);

    await exportAs(DEFAULT_LABELS.exportCsv);

    await waitFor(() => {
      expect(download.getLink()).not.toBeNull();
    });
    expect(download.getLink()).toHaveAttribute('download', 'orders.csv');
  });
});

describe('ExportMenu — the JSON format', () => {
  it('writes the rows as they are, not the rendered text', async () => {
    // JSON export skips the column config entirely: it is the format a developer
    // reaches for when they want the data back, so it must keep types and nesting.
    const download = setupDownloadMocks();
    render(<Harness />);

    await exportAs(DEFAULT_LABELS.exportJson);

    await waitFor(() => {
      expect(download.getContent()).not.toBe('');
    });
    expect(JSON.parse(download.getContent())).toEqual(orders);
    expect(download.getLink()).toHaveAttribute('download', 'orders.json');
  });
});

// ===========================================================================
// `toExportString` ends with a bare `return ''` (ExportMenu.tsx:131) for anything that
// is not null, an array, an object, a string, a number or a boolean. Nothing reached it.
//
// That branch is the safety net: an accessor that returns a symbol, a function or a
// bigint would otherwise fall through and export whatever `String()` made of it, or
// throw. Rows come from an API and pass through consumer-supplied accessors, so the
// exporter cannot assume the value is one of the six shapes it knows.
// ===========================================================================
const oddballColumns: DataTableColumnDef<Order>[] = [
  {id: 'items', accessorKey: 'items', header: 'Items'},
  {id: 'oddball', accessorFn: () => Symbol('not exportable'), header: 'Oddball'},
];

function OddballHarness() {
  'use no memo';
  const table = useReactTable({data: orders, columns: oddballColumns, getCoreRowModel: getCoreRowModel()});
  return <ExportMenu table={table} formats={['csv']} fileName="orders" />;
}

describe('ExportMenu — a value it has no rule for', () => {
  it('exports an empty field rather than guessing', async () => {
    const download = setupDownloadMocks();
    render(<OddballHarness />);

    await exportAs(DEFAULT_LABELS.exportCsv);

    await waitFor(() => {
      expect(download.getContent()).not.toBe('');
    });
    const [, row] = download.getContent().split('\n');
    expect(row).toBe('"Shirt, Trousers",');
  });
});

// ===========================================================================
// The menu's `onClose` (ExportMenu.tsx:104) had no coverage: every test picks a format.
// Opening the export menu and changing your mind is the ordinary case, and a menu that
// ignores the dismiss covers the toolbar underneath it.
// ===========================================================================
describe('ExportMenu — dismissing the menu', () => {
  it('closes on Escape without exporting anything', async () => {
    const download = setupDownloadMocks();
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.exportLabel}));
    await screen.findByRole('menuitem', {name: DEFAULT_LABELS.exportCsv});

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('menuitem', {name: DEFAULT_LABELS.exportCsv})).not.toBeInTheDocument();
    });
    expect(download.getContent()).toBe('');
  });
});

describe('ExportMenu, props that change after mount', () => {
  it('names the file after the latest fileName', async () => {
    // A page that puts the date range in the file name changes it while the menu is closed.
    const download = setupDownloadMocks();
    const {rerender} = render(<Harness fileName="orders" />);

    rerender(<Harness fileName="orders-2024" />);
    await exportAs(DEFAULT_LABELS.exportCsv);

    await waitFor(() => {
      expect(download.getLink()).not.toBeNull();
    });
    expect(download.getLink()).toHaveAttribute('download', 'orders-2024.csv');
  });

  it('offers a format added after mount', async () => {
    const {rerender} = render(<Harness formats={['csv']} />);

    rerender(<Harness formats={['csv', 'xlsx']} />);
    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.exportLabel}));

    expect(await screen.findByRole('menuitem', {name: DEFAULT_LABELS.exportExcel})).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  });
});

describe('ExportMenu, a parent that re-renders', () => {
  it('keeps an open menu open and still exports once', async () => {
    // A page that polls re-renders the toolbar with the same props every few seconds.
    const onExport = vi.fn();
    const formats: ExportFormat[] = ['csv', 'json'];
    const {rerender} = render(<Harness formats={formats} onExport={onExport} />);
    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.exportLabel}));
    const csv = await screen.findByRole('menuitem', {name: DEFAULT_LABELS.exportCsv});

    rerender(<Harness formats={formats} onExport={onExport} />);

    expect(screen.getByRole('menuitem', {name: DEFAULT_LABELS.exportCsv})).toBe(csv);
    await userEvent.click(csv);
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onExport).toHaveBeenCalledWith('csv', expect.any(Array));
  });
});

describe('ExportMenu, a header that is not plain text', () => {
  it('heads the column with its id', async () => {
    // A header rendered from a function has no text to put in a file.
    const download = setupDownloadMocks();
    const tableColumns: DataTableColumnDef<Order>[] = [
      {id: 'total', accessorKey: 'total', header: 'Total'},
      {id: 'paid', accessorKey: 'paid', header: () => <strong>Paid</strong>},
    ];
    render(<Harness tableColumns={tableColumns} />);

    await exportAs(DEFAULT_LABELS.exportCsv);

    await waitFor(() => {
      expect(download.getContent()).not.toBe('');
    });
    expect(download.getContent().split('\n')).toEqual(['\uFEFFTotal,paid', '42.5,true']);
  });
});

describe('ExportMenu, a format it does not know', () => {
  it('still lists it and hands it to onExport', async () => {
    // `onExport` takes over every format, so a plain-JS consumer can pass one of its own.
    // The type rejects that, so the extra entry is merged in the way untyped code would.
    const onExport = vi.fn<(format: ExportFormat, rows: Order[]) => void>();
    const formats = Object.assign(['csv'] satisfies ExportFormat[], {1: 'pdf'});
    render(<Harness formats={formats} onExport={onExport} />);
    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.exportLabel}));
    const items = await screen.findAllByRole('menuitem');
    expect(items).toHaveLength(2);

    await userEvent.click(items[1]);

    expect(onExport).toHaveBeenCalledExactlyOnceWith('pdf', orders);
  });
});
