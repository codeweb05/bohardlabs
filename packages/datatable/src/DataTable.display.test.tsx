/**
 * `enableDisplayMenu` end to end: wrapping reaches every cell and survives a reload,
 * fitting writes widths the table then applies, and fullscreen puts the table over the page.
 *
 * jsdom lays nothing out. For fitting, a content box switched to `max-content` reports ten
 * pixels per character, and every cell is sixteen pixels wider than its content box.
 */
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {DataTable} from './DataTable';
import {DEFAULT_LABELS} from './i18n';
import {getTableStateStorageKey} from './storage/storageKey';
import type {TestRole} from './test/test-utils';
import {generateTestRoles, parentOf, render, screen, waitFor} from './test/test-utils';
import type {DataTableColumnDef} from './types';

const columns: DataTableColumnDef<TestRole>[] = [
  {id: 'name', accessorKey: 'name', header: 'Name'},
  {id: 'roleType', accessorKey: 'roleType', header: 'Type', minSize: 200},
  {id: 'fixed', accessorKey: 'id', header: 'Id', enableResizing: false},
];

const data = generateTestRoles(3);
const tableId = 'display-menu';

async function choose(item: string, role: 'menuitem' | 'menuitemcheckbox' = 'menuitem') {
  await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.display}));
  await userEvent.click(await screen.findByRole(role, {name: item}));
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
}

function contentOf(cellText: string): HTMLElement | null {
  return screen.getByRole('cell', {name: cellText}).querySelector('.cell-content');
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const key of ['fullscreenEnabled', 'fullscreenElement', 'exitFullscreen']) Reflect.deleteProperty(document, key);
  Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
});

describe('DataTable, Display menu', () => {
  it('is not in the toolbar unless asked for', () => {
    render(<DataTable columns={columns} data={data} />);

    expect(screen.queryByRole('button', {name: DEFAULT_LABELS.display})).not.toBeInTheDocument();
  });

  it('wraps every cell, and remembers it for the table', async () => {
    const {unmount} = render(<DataTable columns={columns} data={data} tableId={tableId} enableDisplayMenu />);
    expect(contentOf('Role 1')).toHaveStyle({whiteSpace: 'nowrap'});

    await choose(DEFAULT_LABELS.wrapCells, 'menuitemcheckbox');

    expect(contentOf('Role 1')).toHaveStyle({whiteSpace: 'normal'});
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(getTableStateStorageKey(tableId)) ?? '{}')).toMatchObject({
        wrapCells: true,
      }),
    );

    unmount();
    render(<DataTable columns={columns} data={data} tableId={tableId} enableDisplayMenu />);
    expect(contentOf('Role 1')).toHaveStyle({whiteSpace: 'normal'});
  });

  it('stops wrapping on Reset to Default', async () => {
    localStorage.setItem(getTableStateStorageKey(tableId), JSON.stringify({version: 2, wrapCells: true}));
    render(<DataTable columns={columns} data={data} tableId={tableId} enableDisplayMenu />);
    expect(contentOf('Role 1')).toHaveStyle({whiteSpace: 'normal'});

    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.resetToDefault}));

    expect(contentOf('Role 1')).toHaveStyle({whiteSpace: 'nowrap'});
  });

  it('leaves a column that chose its own overflow alone', async () => {
    const ownOverflow: DataTableColumnDef<TestRole>[] = [
      {id: 'name', accessorKey: 'name', header: 'Name', overflow: 'ellipsis'},
    ];
    render(<DataTable columns={ownOverflow} data={data} enableDisplayMenu />);

    await choose(DEFAULT_LABELS.wrapCells, 'menuitemcheckbox');

    expect(contentOf('Role 1')).toHaveStyle({whiteSpace: 'nowrap'});
  });

  it('fits each resizable column to its widest cell, header included, within its limits', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      if (this.style.width === 'max-content') return (this.textContent ?? '').length * 10;
      return this.matches('td, th') ? 166 : 150;
    });
    render(<DataTable columns={columns} data={data} enableDisplayMenu enableColumnResizing />);

    await choose(DEFAULT_LABELS.fitColumns);

    // "Role 1": 60 of text and 16 of padding. "SUPER_ADMIN" needs 126, under the 200 minimum.
    expect(screen.getByRole('columnheader', {name: /Name/})).toHaveStyle({width: '76px'});
    expect(screen.getByRole('columnheader', {name: /Type/})).toHaveStyle({width: '200px'});
    expect(screen.getByRole('columnheader', {name: /Id/})).toHaveStyle({width: '150px'});
  });

  it('offers fitting only where the table applies column widths', async () => {
    render(<DataTable columns={columns} data={data} enableDisplayMenu />);

    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.display}));

    expect(await screen.findByRole('menuitemcheckbox', {name: DEFAULT_LABELS.wrapCells})).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', {name: DEFAULT_LABELS.fitColumns})).not.toBeInTheDocument();
  });

  it('does not offer fitting on the phone card view', async () => {
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
    render(<DataTable columns={columns} data={data} enableDisplayMenu enableColumnResizing />);

    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.display}));

    expect(await screen.findByRole('menuitemcheckbox', {name: DEFAULT_LABELS.wrapCells})).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', {name: DEFAULT_LABELS.fitColumns})).not.toBeInTheDocument();
  });

  it('fits nothing while there is no table to measure', async () => {
    render(<DataTable columns={columns} data={[]} enableDisplayMenu enableColumnResizing />);

    await choose(DEFAULT_LABELS.fitColumns);

    expect(screen.getByText(DEFAULT_LABELS.noData)).toBeInTheDocument();
  });

  it('covers the page in fullscreen, and gives it back', async () => {
    let fullscreenElement: Element | null = null;
    const change = (element: Element | null) => {
      fullscreenElement = element;
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    };
    Object.defineProperty(document, 'fullscreenEnabled', {configurable: true, value: true});
    Object.defineProperty(document, 'fullscreenElement', {configurable: true, get: () => fullscreenElement});
    Object.defineProperty(document, 'exitFullscreen', {configurable: true, value: () => change(null)});
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: () => change(document.documentElement),
    });
    render(<DataTable columns={columns} data={data} enableDisplayMenu />);
    const paper = () => parentOf(screen.getByTestId('data-table-content'));

    await choose(DEFAULT_LABELS.fullscreen);
    expect(paper()).toHaveStyle({position: 'fixed'});

    await choose(DEFAULT_LABELS.exitFullscreen);
    expect(paper()).not.toHaveStyle({position: 'fixed'});
  });
});
