import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

import {DataTable} from './DataTable';
import type {TestRole} from './test/test-utils';
import {generateTestRoles, render} from './test/test-utils';
import type {DataTableColumnDef} from './types';

const testData = generateTestRoles(3);

const testColumns: DataTableColumnDef<TestRole>[] = [
  {id: 'name', accessorKey: 'name', header: 'Name'},
  {id: 'roleType', accessorKey: 'roleType', header: 'Type'},
  {id: 'description', accessorKey: 'description', header: 'Description'},
];

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

async function openColumnsPopover() {
  await userEvent.click(screen.getByRole('button', {name: /columns/i}));
  return screen.findByRole('presentation');
}

async function pin(columnLabel: string) {
  const popover = await openColumnsPopover();
  await userEvent.click(within(popover).getByRole('button', {name: new RegExp(`freeze ${columnLabel}`, 'i')}));
  // The popover marks the rest of the document aria-hidden, so the table is unreachable
  // by role until it closes.
  await userEvent.keyboard('{Escape}');
}

/** Column ids in the order the header row paints them. */
function headerOrder(): string[] {
  return screen
    .getAllByRole('columnheader')
    .map((cell) => cell.dataset.columnId)
    .filter((id): id is string => Boolean(id));
}

/** Column ids in the order the first body row paints them. */
function firstRowOrder(): string[] {
  const rows = screen.getAllByRole('row');
  return within(rows[1])
    .getAllByRole('cell')
    .map((cell) => cell.dataset.columnId)
    .filter((id): id is string => Boolean(id));
}

describe('DataTable column pinning', () => {
  it('renders a pin control per column when pinning is enabled', async () => {
    render(<DataTable tableId="pin-control" data={testData} columns={testColumns} />);

    const popover = await openColumnsPopover();

    expect(within(popover).getAllByRole('button', {name: /freeze/i})).toHaveLength(testColumns.length);
  });

  it('omits the pin control when pinning is disabled', async () => {
    render(<DataTable tableId="pin-disabled" data={testData} columns={testColumns} enableColumnPinning={false} />);

    const popover = await openColumnsPopover();

    expect(within(popover).queryByRole('button', {name: /freeze/i})).not.toBeInTheDocument();
  });

  it('moves a pinned column to the front and marks it sticky', async () => {
    render(<DataTable tableId="pin-order" data={testData} columns={testColumns} />);

    await pin('Description');

    await waitFor(() => {
      expect(headerOrder()[0]).toBe('description');
    });
    expect(firstRowOrder()[0]).toBe('description');

    const [pinnedHeader] = screen.getAllByRole('columnheader');
    expect(pinnedHeader).toHaveStyle({position: 'sticky'});
  });

  it('freezes the selection checkbox even when nothing is pinned', async () => {
    render(<DataTable tableId="pin-select-default" data={testData} columns={testColumns} enableRowSelection />);

    await waitFor(() => {
      expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0);
    });

    expect(headerOrder()[0]).toBe('select');
    const [selectHeader] = screen.getAllByRole('columnheader');
    expect(selectHeader).toHaveStyle({position: 'sticky'});
  });

  it('keeps the selection checkbox left of a pinned column', async () => {
    render(<DataTable tableId="pin-select" data={testData} columns={testColumns} enableRowSelection />);

    await pin('Description');

    // Regression: `getHeaderGroups()` renders `columnPinning.left` ahead of `columnOrder`,
    // so pinning used to push the checkbox to the right of the frozen column in the header
    // while the body kept it on the left.
    await waitFor(() => {
      expect(headerOrder().slice(0, 2)).toEqual(['select', 'description']);
    });
    expect(firstRowOrder().slice(0, 2)).toEqual(['select', 'description']);
  });

  it('keeps multiple pinned columns in the order they were pinned', async () => {
    render(<DataTable tableId="pin-many" data={testData} columns={testColumns} enableRowSelection />);

    await pin('Description');
    await pin('Type');

    await waitFor(() => {
      expect(headerOrder().slice(0, 3)).toEqual(['select', 'description', 'roleType']);
    });
    expect(firstRowOrder().slice(0, 3)).toEqual(['select', 'description', 'roleType']);
  });

  it('keeps the header and the body in step when two pinned columns are reordered', async () => {
    // Regression: the header paints `columnPinning.left` in the array's own order while
    // the body follows `columnOrder`, so a drag that reordered the frozen block rewrote
    // the order and left the pin array behind. The header then labelled the wrong cells.
    render(<DataTable tableId="pin-reorder" data={testData} columns={testColumns} enableRowSelection />);

    await pin('Description');
    await pin('Type');
    await waitFor(() => {
      expect(headerOrder().slice(0, 3)).toEqual(['select', 'description', 'roleType']);
    });

    const popover = await openColumnsPopover();
    within(popover)
      .getByRole('button', {name: /^Reorder Description/})
      .focus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(headerOrder().slice(0, 3)).toEqual(['select', 'roleType', 'description']);
    });
    expect(firstRowOrder().slice(0, 3)).toEqual(['select', 'roleType', 'description']);
  });

  it('restores the original position when a column is unpinned', async () => {
    render(<DataTable tableId="pin-toggle" data={testData} columns={testColumns} enableRowSelection />);

    await pin('Description');
    await waitFor(() => {
      expect(headerOrder()[1]).toBe('description');
    });

    await pin('Description');

    await waitFor(() => {
      expect(headerOrder()).toEqual(['select', 'description', 'name', 'roleType']);
    });
    const [, unpinnedHeader] = screen.getAllByRole('columnheader');
    expect(unpinnedHeader).not.toHaveStyle({position: 'sticky'});
  });
});

describe('DataTable column pinning on a mobile layout', () => {
  beforeEach(() => {
    // The mobile branch renders cards, so there is no scrollable row of columns for a
    // frozen column to stay in front of and the pin control has nothing to act on.
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('omits the pin control', async () => {
    render(<DataTable tableId="pin-mobile" data={testData} columns={testColumns} enableRowSelection />);

    const popover = await openColumnsPopover();

    expect(within(popover).queryByRole('button', {name: /freeze/i})).not.toBeInTheDocument();
    // The visibility checkboxes are still there; only pinning is dropped.
    expect(within(popover).getAllByRole('checkbox').length).toBeGreaterThan(0);
  });
});
