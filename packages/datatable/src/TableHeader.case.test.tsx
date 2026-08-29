import {screen, within} from '@testing-library/react';
import {beforeAll, describe, expect, it, vi} from 'vitest';

import {DataTable} from './DataTable';
import type {TestRole} from './test/test-utils';
import {generateTestRoles, render} from './test/test-utils';
import type {DataTableColumnDef, HeaderCase} from './types';

const testData = generateTestRoles(3);

// One sortable and one non-sortable column: before the fix these rendered in different
// cases, because the UA stylesheet resets `text-transform` on the sortable header's <button>.
const testColumns: DataTableColumnDef<TestRole>[] = [
  {id: 'name', accessorKey: 'name', header: 'Name', enableSorting: true},
  {id: 'description', accessorKey: 'description', header: 'Description', enableSorting: false},
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

function getHeaderTransform(name: string) {
  const cell = screen.getByRole('columnheader', {name: new RegExp(name)});
  return window.getComputedStyle(cell).textTransform;
}

describe('DataTable header casing', () => {
  it('capitalizes headers by default', () => {
    render(<DataTable columns={testColumns} data={testData} enableSorting />);

    expect(getHeaderTransform('Name')).toBe('capitalize');
    expect(getHeaderTransform('Description')).toBe('capitalize');
  });

  it.each<[HeaderCase, string]>([
    ['uppercase', 'uppercase'],
    ['lowercase', 'lowercase'],
    ['capitalize', 'capitalize'],
    ['none', 'none'],
  ])('applies headerCase="%s" to every header', (headerCase, expected) => {
    render(<DataTable columns={testColumns} data={testData} enableSorting headerCase={headerCase} />);

    expect(getHeaderTransform('Name')).toBe(expected);
    expect(getHeaderTransform('Description')).toBe(expected);
  });

  it('renders the header string verbatim when casing is off', () => {
    render(
      <DataTable columns={[{id: 'name', accessorKey: 'name', header: 'oRDeR iD'}]} data={testData} headerCase="none" />,
    );

    expect(screen.getByRole('columnheader', {name: 'oRDeR iD'})).toBeInTheDocument();
    expect(getHeaderTransform('oRDeR iD')).toBe('none');
  });

  it('gives sortable and non-sortable headers the same casing', () => {
    render(<DataTable columns={testColumns} data={testData} enableSorting />);

    // The sortable header wraps its label in a <button>; it must inherit the cell's
    // casing rather than fall back to the UA stylesheet's `none`. Asserted against the
    // non-sortable header rather than against the literal `inherit`, so this compares the
    // two cases the test is named for instead of how the value happens to be spelled.
    const sortButton = within(screen.getByRole('columnheader', {name: /Name/})).getByRole('button');
    expect(window.getComputedStyle(sortButton).textTransform).toBe(getHeaderTransform('Description'));
  });
});
