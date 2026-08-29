import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {render} from '../test/test-utils';
import {ExportMenu} from './ExportMenu';

// Mock the excel wrapper
vi.mock('../export/excel', () => ({
  createHeaderRow: vi.fn((headers: string[]) => headers.map((h) => ({value: h, fontWeight: 'bold'}))),
  createDataRow: vi.fn((values: string[]) => values.map((v) => ({value: v}))),
  writeExcelFile: vi.fn(),
}));

// Capture original before any spy replaces it
const originalCreateElement = document.createElement.bind(document);

function setupDownloadMocks() {
  // Capture blob content at construction time (jsdom Blob lacks .text()/.arrayBuffer())
  let lastBlobContent = '';
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

  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:test'),
    revokeObjectURL: vi.fn(),
  });

  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = originalCreateElement(tag);
    if (tag === 'a') {
      el.click = vi.fn();
    }
    return el;
  });

  return {getContent: () => lastBlobContent};
}

// Minimal mock table that ExportMenu needs
function createMockTable(
  data: Array<{id: string; [key: string]: unknown}>,
  columns: Array<{
    id: string;
    accessorKey?: string;
    accessorFn?: (row: Record<string, unknown>) => unknown;
    header: string;
  }>,
) {
  return {
    getFilteredRowModel: () => ({
      rows: data.map((d) => ({original: d})),
    }),
    getAllLeafColumns: () =>
      columns.map((col) => ({
        id: col.id,
        getIsVisible: () => true,
        columnDef: {
          accessorKey: col.accessorKey,
          accessorFn: col.accessorFn,
          header: col.header,
        },
      })),
  };
}

describe('ExportMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders export button', () => {
    const table = createMockTable([], []);

    render(<ExportMenu table={table as any} />);

    expect(screen.getByLabelText(/export/i)).toBeInTheDocument();
  });

  it('shows format options when clicked', async () => {
    const user = userEvent.setup();
    const table = createMockTable([], []);

    render(<ExportMenu table={table as any} formats={['csv', 'xlsx', 'json']} />);

    await user.click(screen.getByLabelText(/export/i));

    expect(screen.getByText(/csv/i)).toBeInTheDocument();
    expect(screen.getByText(/excel/i)).toBeInTheDocument();
    expect(screen.getByText(/json/i)).toBeInTheDocument();
  });

  it('calls onExport callback when provided', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    const data = [{id: '1', name: 'Alice'}];
    const table = createMockTable(data, [{id: 'name', accessorKey: 'name', header: 'Name'}]);

    render(<ExportMenu table={table as any} formats={['csv']} onExport={onExport} />);

    await user.click(screen.getByLabelText(/export/i));
    await user.click(screen.getByText(/csv/i));

    expect(onExport).toHaveBeenCalledWith('csv', data);
  });

  describe('CSV export', () => {
    it('generates CSV with headers and data from accessorKey', async () => {
      const user = userEvent.setup();
      const {getContent} = setupDownloadMocks();

      const data = [
        {id: '1', name: 'Alice', email: 'alice@test.com'},
        {id: '2', name: 'Bob', email: 'bob@test.com'},
      ];
      const columns = [
        {id: 'name', accessorKey: 'name', header: 'Name'},
        {id: 'email', accessorKey: 'email', header: 'Email'},
      ];
      const table = createMockTable(data, columns);

      render(<ExportMenu table={table as any} formats={['csv']} fileName="test-export" />);

      await user.click(screen.getByLabelText(/export/i));
      await user.click(screen.getByText(/csv/i));

      const csvText = getContent();
      expect(csvText).toContain('Name,Email');
      expect(csvText).toContain('Alice,alice@test.com');
      expect(csvText).toContain('Bob,bob@test.com');
    });

    it('uses accessorFn to resolve column values', async () => {
      const user = userEvent.setup();
      const {getContent} = setupDownloadMocks();

      const data = [{id: '1', firstName: 'Alice', lastName: 'Smith'}];
      const columns = [
        {
          id: 'fullName',
          accessorFn: (row: Record<string, unknown>) => `${row.firstName} ${row.lastName}`,
          header: 'Full Name',
        },
      ];
      const table = createMockTable(data, columns);

      render(<ExportMenu table={table as any} formats={['csv']} />);

      await user.click(screen.getByLabelText(/export/i));
      await user.click(screen.getByText(/csv/i));

      expect(getContent()).toContain('Alice Smith');
    });

    it('returns empty string for null/undefined values', async () => {
      const user = userEvent.setup();
      const {getContent} = setupDownloadMocks();

      const data = [{id: '1', name: null}];
      const columns = [{id: 'name', accessorKey: 'name', header: 'Name'}];
      const table = createMockTable(data, columns);

      render(<ExportMenu table={table as any} formats={['csv']} />);

      await user.click(screen.getByLabelText(/export/i));
      await user.click(screen.getByText(/csv/i));

      // Header row present, data row present but value is empty
      const lines = getContent().split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('Name');
      expect(lines[1]).toBe('');
    });

    it('returns empty string for object values', async () => {
      const user = userEvent.setup();
      const {getContent} = setupDownloadMocks();

      const data = [{id: '1', nested: {foo: 'bar'}}];
      const columns = [{id: 'nested', accessorKey: 'nested', header: 'Nested'}];
      const table = createMockTable(data, columns);

      render(<ExportMenu table={table as any} formats={['csv']} />);

      await user.click(screen.getByLabelText(/export/i));
      await user.click(screen.getByText(/csv/i));

      // Object values should be empty, not [object Object]
      const lines = getContent().split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('Nested');
      expect(lines[1]).toBe('');
    });

    it('joins array values with commas', async () => {
      const user = userEvent.setup();
      const {getContent} = setupDownloadMocks();

      const data = [{id: '1', tags: ['a', 'b', 'c']}];
      const columns = [
        {
          id: 'tags',
          accessorFn: (row: Record<string, unknown>) => row.tags,
          header: 'Tags',
        },
      ];
      const table = createMockTable(data, columns);

      render(<ExportMenu table={table as any} formats={['csv']} />);

      await user.click(screen.getByLabelText(/export/i));
      await user.click(screen.getByText(/csv/i));

      const lines = getContent().split('\n');
      expect(lines[0]).toBe('Tags');
      // Array values joined with ", " and CSV-quoted because of the comma
      expect(lines[1]).toBe('"a, b, c"');
    });

    it('escapes values containing commas and quotes', async () => {
      const user = userEvent.setup();
      const {getContent} = setupDownloadMocks();

      const data = [{id: '1', desc: 'Hello, "world"'}];
      const columns = [{id: 'desc', accessorKey: 'desc', header: 'Description'}];
      const table = createMockTable(data, columns);

      render(<ExportMenu table={table as any} formats={['csv']} />);

      await user.click(screen.getByLabelText(/export/i));
      await user.click(screen.getByText(/csv/i));

      expect(getContent()).toContain('"Hello, ""world"""');
    });
  });

  describe('XLSX export', () => {
    it('calls writeExcelFile with headers, data rows, and column widths', async () => {
      const user = userEvent.setup();
      const {writeExcelFile} = await import('../export/excel');

      const data = [
        {id: '1', name: 'Alice'},
        {id: '2', name: 'Bob'},
      ];
      const columns = [{id: 'name', accessorKey: 'name', header: 'Name'}];
      const table = createMockTable(data, columns);

      render(<ExportMenu table={table as any} formats={['xlsx']} fileName="test" />);

      await user.click(screen.getByLabelText(/export/i));
      await user.click(screen.getByText(/excel/i));

      expect(writeExcelFile).toHaveBeenCalledOnce();
      const [rows, options] = (writeExcelFile as ReturnType<typeof vi.fn>).mock.calls[0];

      // First row is header (bold)
      expect(rows[0]).toEqual([{value: 'Name', fontWeight: 'bold'}]);
      // Data rows
      expect(rows[1]).toEqual([{value: 'Alice'}]);
      expect(rows[2]).toEqual([{value: 'Bob'}]);
      // fileName
      expect(options.fileName).toBe('test.xlsx');
      // Column widths should be present
      expect(options.columns).toBeDefined();
      expect(options.columns[0].width).toBeGreaterThan(0);
    });

    it('computes column width from max of header and data lengths', async () => {
      const user = userEvent.setup();
      const {writeExcelFile} = await import('../export/excel');

      const data = [{id: '1', name: 'A very long name value here'}];
      const columns = [{id: 'name', accessorKey: 'name', header: 'Name'}];
      const table = createMockTable(data, columns);

      render(<ExportMenu table={table as any} formats={['xlsx']} />);

      await user.click(screen.getByLabelText(/export/i));
      await user.click(screen.getByText(/excel/i));

      const [, options] = (writeExcelFile as ReturnType<typeof vi.fn>).mock.calls[0];
      // Width should be based on data length (27 chars) + 2 padding = 29
      expect(options.columns[0].width).toBe(29);
    });

    it('caps column width at 50', async () => {
      const user = userEvent.setup();
      const {writeExcelFile} = await import('../export/excel');

      const longValue = 'x'.repeat(100);
      const data = [{id: '1', name: longValue}];
      const columns = [{id: 'name', accessorKey: 'name', header: 'Name'}];
      const table = createMockTable(data, columns);

      render(<ExportMenu table={table as any} formats={['xlsx']} />);

      await user.click(screen.getByLabelText(/export/i));
      await user.click(screen.getByText(/excel/i));

      const [, options] = (writeExcelFile as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(options.columns[0].width).toBe(50);
    });
  });

  describe('column filtering', () => {
    it('excludes select and actions columns from export', async () => {
      const user = userEvent.setup();
      const {getContent} = setupDownloadMocks();

      const table = {
        getFilteredRowModel: () => ({rows: [{original: {id: '1', name: 'Test'}}]}),
        getAllLeafColumns: () => [
          {id: 'select', getIsVisible: () => true, columnDef: {accessorKey: 'id', header: 'Select'}},
          {id: 'name', getIsVisible: () => true, columnDef: {accessorKey: 'name', header: 'Name'}},
          {id: 'actions', getIsVisible: () => true, columnDef: {header: 'Actions'}},
        ],
      };

      render(<ExportMenu table={table as any} formats={['csv']} />);

      await user.click(screen.getByLabelText(/export/i));
      await user.click(screen.getByText(/csv/i));

      const csvText = getContent();
      // Only 'Name' column should be present, not 'Select' or 'Actions'
      expect(csvText).toContain('Name');
      expect(csvText).not.toContain('Select');
      expect(csvText).not.toContain('Actions');
    });

    it('excludes hidden columns from export', async () => {
      const user = userEvent.setup();
      const {getContent} = setupDownloadMocks();

      const table = {
        getFilteredRowModel: () => ({rows: [{original: {id: '1', name: 'Test', email: 'test@test.com'}}]}),
        getAllLeafColumns: () => [
          {id: 'name', getIsVisible: () => true, columnDef: {accessorKey: 'name', header: 'Name'}},
          {id: 'email', getIsVisible: () => false, columnDef: {accessorKey: 'email', header: 'Email'}},
        ],
      };

      render(<ExportMenu table={table as any} formats={['csv']} />);

      await user.click(screen.getByLabelText(/export/i));
      await user.click(screen.getByText(/csv/i));

      const csvText = getContent();
      expect(csvText).toContain('Name');
      expect(csvText).not.toContain('Email');
    });
  });
});
