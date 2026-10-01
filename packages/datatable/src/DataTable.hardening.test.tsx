import {ThemeProvider, createTheme} from '@mui/material';
import {fireEvent, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {DataTable} from './DataTable';
import {DEFAULT_LABELS as L} from './i18n';
import {getTableStateStorageKey} from './storage/storageKey';
import {render} from './test/test-utils';
import type {DataTableColumnDef, ServerTableState} from './types';
import {DEFAULT_PAGE_SIZE} from './types';
import {useTableServerState} from './useTableServerState';

interface Visit {
  readonly id: string;
  readonly guest: string;
  readonly seenAt: Date;
  readonly note: string;
  readonly [key: string]: unknown;
}

const visits: Visit[] = [
  {id: 'visit-1', guest: 'Noor', seenAt: new Date('2026-04-02T09:30:00.000Z'), note: 'first\r\nsecond'},
  {id: 'visit-2', guest: 'Ada', seenAt: new Date('2026-04-01T09:30:00.000Z'), note: 'plain'},
];

const columns: DataTableColumnDef<Visit>[] = [
  {id: 'guest', accessorKey: 'guest', header: 'Guest, full name'},
  {id: 'seenAt', accessorKey: 'seenAt', header: 'Seen "at"', enableSorting: false},
  {id: 'note', accessorKey: 'note', header: 'Note', enableSorting: false},
];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('onServerStateChange written inline', () => {
  it('reports the state once on mount, not once per render of the page', () => {
    const emitted = vi.fn();

    function Page() {
      // Uncompiled, as most consumers are: the handler below is a new function per render.
      'use no memo';
      const [serverState, setServerState] = useState<ServerTableState | null>(null);
      return (
        <DataTable
          columns={columns}
          data={visits}
          totalRows={serverState ? 30 : 0}
          manualPagination
          onServerStateChange={(next) => {
            emitted(next);
            setServerState(next);
          }}
        />
      );
    }

    render(<Page />);

    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('still reports to the callback of the latest render', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];

    function Page() {
      'use no memo';
      const [version, setVersion] = useState(1);
      return (
        <>
          <button onClick={() => setVersion(2)}>next version</button>
          <DataTable
            columns={columns}
            data={visits}
            onServerStateChange={(next) => seen.push(`v${version}:${next.sorting.length}`)}
          />
        </>
      );
    }

    render(<Page />);
    await user.click(screen.getByRole('button', {name: 'next version'}));
    await user.click(screen.getByText('Guest, full name'));

    expect(seen).toEqual(['v1:0', 'v2:1']);
  });
});

describe('saved state that is not what the table wrote', () => {
  it('falls back to the defaults for each slice it cannot use', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(
      getTableStateStorageKey('hardening-corrupt'),
      JSON.stringify({
        density: 'huge',
        columnVisibility: 'none',
        columnOrder: 5,
        columnSizing: null,
        columnPinning: 'left',
        grouping: 'guest',
        sorting: [null],
        columnFilters: [3],
      }),
    );

    render(
      <DataTable
        columns={columns}
        data={visits}
        tableId="hardening-corrupt"
        enableColumnResizing
        enableColumnPinning
        enableDensityToggle
      />,
    );

    expect(screen.getByRole('cell', {name: 'Noor'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Ada'})).toBeInTheDocument();
  });
});

describe('exporting', () => {
  const originalCreateElement = document.createElement.bind(document);

  /** Captures what the component hands to `new Blob(...)`; jsdom's Blob cannot be read. */
  function captureDownload() {
    let content = '';
    const OriginalBlob = globalThis.Blob;
    vi.stubGlobal(
      'Blob',
      class MockBlob extends OriginalBlob {
        constructor(parts: BlobPart[], options?: BlobPropertyBag) {
          super(parts, options);
          content = String(parts[0]);
        }
      },
    );
    vi.stubGlobal('URL', {createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn()});
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = originalCreateElement(tag);
      if (tag === 'a') element.click = vi.fn();
      return element;
    });
    return () => content;
  }

  async function exportAs(user: ReturnType<typeof userEvent.setup>, label: string) {
    await user.click(screen.getByRole('button', {name: L.exportLabel}));
    await user.click(await screen.findByRole('menuitem', {name: label}));
  }

  it('quotes a heading that holds a comma or a quote, so the columns stay lined up', async () => {
    const user = userEvent.setup();
    const content = captureDownload();
    render(<DataTable columns={columns} data={visits} enableExport />);

    await exportAs(user, L.exportCsv);

    await waitFor(() => expect(content()).not.toBe(''));
    expect(content().split('\n')[0]).toBe('"Guest, full name","Seen ""at""",Note');
  });

  it('writes a date as a date and keeps a carriage return inside its cell', async () => {
    const user = userEvent.setup();
    const content = captureDownload();
    render(<DataTable columns={columns} data={visits} enableExport />);

    await exportAs(user, L.exportCsv);

    await waitFor(() => expect(content()).not.toBe(''));
    expect(content()).toContain('Noor,2026-04-02T09:30:00.000Z,"first\r\nsecond"');
  });

  it('leaves the cell empty for a date that is not one', async () => {
    const user = userEvent.setup();
    const content = captureDownload();
    const unreadable: Visit[] = [{id: 'visit-3', guest: 'Kit', seenAt: new Date('not a date'), note: 'plain'}];
    render(<DataTable columns={columns} data={unreadable} enableExport />);

    await exportAs(user, L.exportCsv);

    await waitFor(() => expect(content()).not.toBe(''));
    expect(content().split('\n')[1]).toBe('Kit,,plain');
  });

  it('exports the rows in the order they are sorted on screen', async () => {
    const user = userEvent.setup();
    const content = captureDownload();
    render(<DataTable columns={columns} data={visits} enableExport />);
    await user.click(screen.getByText('Guest, full name'));

    await exportAs(user, L.exportCsv);

    await waitFor(() => expect(content()).not.toBe(''));
    const guests = content()
      .split('\n')
      .slice(1)
      .filter((line) => /^(Ada|Noor),/.test(line))
      .map((line) => line.split(',')[0]);
    expect(guests).toEqual(['Ada', 'Noor']);
  });

  it('exports every row of a grouped table, not one per group', async () => {
    const user = userEvent.setup();
    const content = captureDownload();
    const seenAt = new Date('2026-04-03T09:30:00.000Z');
    const grouped: Visit[] = [
      {id: 'visit-1', guest: 'Noor', seenAt, note: 'returning'},
      {id: 'visit-2', guest: 'Ada', seenAt, note: 'new'},
      {id: 'visit-3', guest: 'Kit', seenAt, note: 'new'},
    ];
    render(
      <DataTable
        columns={columns}
        data={grouped}
        enableGrouping
        initialGrouping={['note']}
        enableExport
        exportFormats={['json']}
      />,
    );

    await exportAs(user, L.exportJson);

    await waitFor(() => expect(content()).not.toBe(''));
    const exported = JSON.parse(content()) as Visit[];
    expect(exported.map((visit) => visit.guest).toSorted()).toEqual(['Ada', 'Kit', 'Noor']);
  });

  it('waits for an export the page runs itself before saying how it ended', async () => {
    const user = userEvent.setup();
    let finish = () => {};
    const onExport = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const onExportComplete = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={visits}
        enableExport
        onExport={onExport}
        onExportComplete={onExportComplete}
      />,
    );

    await exportAs(user, L.exportCsv);
    await waitFor(() => expect(onExport).toHaveBeenCalled());
    expect(onExportComplete).not.toHaveBeenCalled();

    finish();
    await waitFor(() => expect(onExportComplete).toHaveBeenCalledWith('csv', true));
  });

  it('reports an export the page runs itself as failed when its promise rejects', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onExportComplete = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={visits}
        enableExport
        onExport={() => Promise.reject(new Error('the server said no'))}
        onExportComplete={onExportComplete}
      />,
    );

    await exportAs(user, L.exportCsv);

    await waitFor(() => expect(onExportComplete).toHaveBeenCalledWith('csv', false));
    expect(onExportComplete).toHaveBeenCalledTimes(1);
  });

  it('says when an export starts and how it ended', async () => {
    const user = userEvent.setup();
    captureDownload();
    const onExportStart = vi.fn();
    const onExportComplete = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={visits}
        enableExport
        onExportStart={onExportStart}
        onExportComplete={onExportComplete}
      />,
    );

    await exportAs(user, L.exportCsv);

    await waitFor(() => expect(onExportComplete).toHaveBeenCalledWith('csv', true));
    expect(onExportStart).toHaveBeenCalledWith('csv');
  });

  it('reports a failed export instead of leaving a rejected promise behind', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('URL', {
      createObjectURL: () => {
        throw new Error('no blob urls here');
      },
      revokeObjectURL: vi.fn(),
    });
    const onExportComplete = vi.fn();
    render(<DataTable columns={columns} data={visits} enableExport onExportComplete={onExportComplete} />);

    await exportAs(user, L.exportCsv);

    await waitFor(() => expect(onExportComplete).toHaveBeenCalledWith('csv', false));
  });
});

describe('resizing a column with its own limits', () => {
  const sized: DataTableColumnDef<Visit>[] = [
    {id: 'guest', accessorKey: 'guest', header: 'Guest', size: 124, minSize: 120},
    {id: 'note', accessorKey: 'note', header: 'Note', size: 600, maxSize: 800},
  ];

  function handles(): HTMLElement[] {
    return screen.getAllByRole('separator', {name: L.resizeColumn});
  }

  function announcedWidth(handle: HTMLElement | undefined): number {
    return Number(handle?.getAttribute('aria-valuenow'));
  }

  it('stops at the narrowest the column says it may get', () => {
    render(<DataTable columns={sized} data={visits} enableColumnResizing />);
    const [guest] = handles();
    if (!guest) throw new Error('Expected a resize handle per column');

    fireEvent.keyDown(guest, {key: 'ArrowLeft'});

    expect(announcedWidth(handles()[0])).toBe(120);
    expect(handles()[0]).toHaveAttribute('aria-valuemin', '120');
  });

  it('lets a column that may be wide get wider, instead of snapping it back', () => {
    render(<DataTable columns={sized} data={visits} enableColumnResizing />);
    const [, note] = handles();
    if (!note) throw new Error('Expected a resize handle per column');

    fireEvent.keyDown(note, {key: 'ArrowRight'});

    expect(announcedWidth(handles()[1])).toBe(608);
    expect(handles()[1]).toHaveAttribute('aria-valuemax', '800');
  });

  it('grows the table by what the column grew', () => {
    render(<DataTable columns={sized} data={visits} enableColumnResizing ariaLabel="Visits" />);
    expect(screen.getByRole('table', {name: 'Visits'})).toHaveStyle({width: '724px'});
    const [, note] = handles();
    if (!note) throw new Error('Expected a resize handle per column');

    fireEvent.keyDown(note, {key: 'ArrowRight'});

    expect(screen.getByRole('table', {name: 'Visits'})).toHaveStyle({width: '732px'});
  });
});

describe('a sorted column', () => {
  it('announces its direction on the header cell', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={visits} />);
    const header = () => screen.getByRole('columnheader', {name: /Guest, full name/});
    expect(header()).toHaveAttribute('aria-sort', 'none');

    await user.click(screen.getByText('Guest, full name'));
    expect(header()).toHaveAttribute('aria-sort', 'ascending');

    await user.click(screen.getByText('Guest, full name'));
    expect(header()).toHaveAttribute('aria-sort', 'descending');
  });

  it('leaves a column that cannot be sorted without a direction', () => {
    render(<DataTable columns={columns} data={visits} />);

    expect(screen.getByRole('columnheader', {name: 'Note'})).not.toHaveAttribute('aria-sort');
  });
});

describe('under a branded theme', () => {
  function generatedCss(): string {
    return Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .map((rule) => rule.cssText)
      .join('\n');
  }

  it('tints the toolbar and the pager from the theme, not from fixed black or white', () => {
    const theme = createTheme({palette: {text: {primary: '#112233'}}});
    render(
      <ThemeProvider theme={theme}>
        <DataTable columns={columns} data={visits} />
      </ThemeProvider>,
    );

    const tint = 'background-color: rgba(17, 34, 51, 0.01)';
    expect(generatedCss().split(tint).length - 1).toBeGreaterThanOrEqual(2);
  });

  it('keeps the hidden heading of the actions column to a pixel', () => {
    render(<DataTable columns={columns} data={visits} rowActions={[{id: 'open', label: 'Open', onClick: vi.fn()}]} />);

    const heading = screen.getByText(L.actions);
    expect(heading).toHaveStyle({width: '1px', height: '1px'});
  });
});

describe('defaults given to useTableServerState', () => {
  const sorting = [{id: 'guest', desc: true}];
  const seen: Array<{pageSize: number; sorted: number}> = [];

  function Page({shared}: Readonly<{shared: boolean}>) {
    const {serverState, onServerStateChange} = useTableServerState('hardening-defaults', {pageSize: 25, sorting});
    seen.push({pageSize: serverState.pagination.pageSize, sorted: serverState.sorting.length});
    return (
      <DataTable
        columns={columns}
        data={visits}
        totalRows={60}
        manualPagination
        manualSorting
        pageSize={shared ? 25 : undefined}
        initialSorting={shared ? sorting : undefined}
        onServerStateChange={onServerStateChange}
      />
    );
  }

  afterEach(() => {
    seen.length = 0;
  });

  it('hold from the first request on when the table is given the same ones', () => {
    render(<Page shared />);

    expect(new Set(seen.map((state) => `${state.pageSize}/${state.sorted}`))).toEqual(new Set(['25/1']));
  });

  it("are replaced by the table's own on mount when it is not", () => {
    render(<Page shared={false} />);

    expect(seen.at(0)).toEqual({pageSize: 25, sorted: 1});
    expect(seen.at(-1)).toEqual({pageSize: DEFAULT_PAGE_SIZE, sorted: 0});
  });
});
