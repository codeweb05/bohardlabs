/**
 * Layout props that had no test: `stickyHeader` on its own, a column's static `sticky`,
 * `getRowSx`, `animateExpansion={false}`, and the keyboard and reset paths of a resizable
 * column.
 *
 * None of these change what the table says, only where it sits and how it is painted, which
 * is why they went unasserted: every other suite reads text and roles. They are still
 * contract. A sticky header with no height to scroll inside does nothing, a frozen column
 * that is not opaque shows the columns sliding under it, and a resize handle that only
 * answers to a mouse locks keyboard users out of a width they may need.
 *
 * jsdom lays nothing out, so the assertions are on the styles MUI resolves for each element
 * and on the ARIA values the resize handle reports.
 */
import {ThemeProvider, alpha, createTheme} from '@mui/material';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';

import {DataTable} from './DataTable';
import type {TestRole} from './test/test-utils';
import {fireEvent, generateTestRoles, parentOf, render, screen} from './test/test-utils';
import type {DataTableColumnDef, RowAction} from './types';

const columns: DataTableColumnDef<TestRole>[] = [
  {id: 'name', accessorKey: 'name', header: 'Name', enableSorting: true},
  {id: 'roleType', accessorKey: 'roleType', header: 'Type'},
];

const data = generateTestRoles(3);

const rowActions: RowAction<TestRole>[] = [{id: 'edit', label: 'Edit', onClick: () => {}}];

/**
 * The declarations MUI generated for an element. jsdom's `getComputedStyle` drops values it
 * cannot resolve, `calc()` among them, so those are read from the injected rules instead.
 */
function generatedCss(element: HTMLElement | null): string {
  if (!element) throw new Error('Expected an element to read styles from');
  // Only the generated class: the `Mui*` ones are shared by every element of that kind.
  const classNames = Array.from(element.classList).filter((className) => className.startsWith('css-'));
  return Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .map((rule) => rule.cssText)
    .filter((css) => classNames.some((className) => css.includes(`.${className}`)))
    .join('\n');
}

function rowOf(name: string): HTMLElement {
  return screen.getByRole('row', {name: new RegExp(name)});
}

/** The width a resize handle announces. A separator is not a role `toHaveValue` reads. */
function announcedWidth(handle: HTMLElement): number {
  return Number(handle.getAttribute('aria-valuenow'));
}

describe('DataTable, sticky header', () => {
  it('gives the scroll container a height to stick inside when none is passed', () => {
    render(<DataTable columns={columns} data={data} stickyHeader ariaLabel="Roles" />);

    expect(generatedCss(parentOf(screen.getByRole('table', {name: 'Roles'})))).toContain(
      'max-height: calc(100vh - 330px)',
    );
  });

  it('prefers the height the consumer passes', () => {
    render(<DataTable columns={columns} data={data} stickyHeader maxHeight={320} ariaLabel="Roles" />);

    expect(parentOf(screen.getByRole('table', {name: 'Roles'}))).toHaveStyle({maxHeight: '320px'});
  });

  it('keeps the actions header above the rows scrolling under it', () => {
    render(<DataTable columns={columns} data={data} stickyHeader rowActions={rowActions} />);

    expect(screen.getByRole('columnheader', {name: 'Actions'})).toHaveStyle({position: 'sticky', zIndex: '10'});
  });

  it('falls back to an English name for the select-all box when the label is blanked', () => {
    // An empty string from a half-filled translation file would leave the checkbox unnamed.
    render(<DataTable columns={columns} data={data} enableRowSelection labels={{selectAll: ''}} />);

    expect(screen.getByRole('checkbox', {name: 'Select all rows'})).toBeInTheDocument();
  });
});

describe('DataTable, a column declared sticky', () => {
  const stickyColumns: DataTableColumnDef<TestRole>[] = [
    {id: 'name', accessorKey: 'name', header: 'Name', sticky: 'left'},
    {id: 'roleType', accessorKey: 'roleType', header: 'Type'},
  ];

  it('pins the header and every cell of that column to the left edge', () => {
    render(<DataTable columns={stickyColumns} data={data} />);

    expect(screen.getByRole('columnheader', {name: 'Name'})).toHaveStyle({position: 'sticky', left: '0px'});
    expect(screen.getByRole('cell', {name: 'Role 1'})).toHaveStyle({position: 'sticky', left: '0px'});
    expect(screen.getByRole('columnheader', {name: 'Type'})).not.toHaveStyle({position: 'sticky'});
    expect(screen.getByRole('cell', {name: 'SUPER_ADMIN'})).not.toHaveStyle({position: 'sticky'});
  });

  it('lets a runtime pin take over, so the offset is the measured one', () => {
    render(<DataTable columns={stickyColumns} data={data} initialColumnPinning={{left: ['name']}} />);

    expect(screen.getByRole('columnheader', {name: 'Name'})).toHaveStyle({
      position: 'sticky',
      left: 'var(--dt-pin-name, 0px)',
    });
    expect(screen.getByRole('cell', {name: 'Role 1'})).toHaveStyle({
      position: 'sticky',
      left: 'var(--dt-pin-name, 0px)',
    });
  });
});

describe('DataTable, getRowSx', () => {
  it('styles the rows it returns something for and leaves the rest alone', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        getRowSx={(row) => (row.roleType === 'ADMIN' ? {opacity: 0.5} : undefined)}
      />,
    );

    expect(rowOf('Role 2')).toHaveStyle({opacity: '0.5'});
    expect(rowOf('Role 1')).not.toHaveStyle({opacity: '0.5'});
  });
});

describe('DataTable, expansion without animation', () => {
  function renderTable() {
    render(
      <DataTable
        columns={columns}
        data={data}
        enableExpanding
        animateExpansion={false}
        renderExpandedRow={(row) => <p>Details for {row.original.name}</p>}
      />,
    );
  }

  it('reserves no row for a closed panel', () => {
    renderTable();

    // The header row and the three data rows. With the animation on, each data row is
    // followed by an empty row that the panel collapses into.
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.queryByText(/Details for/)).not.toBeInTheDocument();
  });

  it('shows the panel on expand and removes it on collapse', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getAllByRole('button', {name: 'Expand row'})[0]);

    expect(screen.getByText('Details for Role 1')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(5);

    await user.click(screen.getByRole('button', {name: 'Collapse row'}));

    expect(screen.queryByText('Details for Role 1')).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });
});

describe('DataTable, resizing a column without a mouse', () => {
  const resizableColumns: DataTableColumnDef<TestRole>[] = [
    {id: 'name', accessorKey: 'name', header: 'Name', enableSorting: true},
    {id: 'roleType', accessorKey: 'roleType', header: 'Type', size: 500, enableSorting: false},
  ];

  function handles(): HTMLElement[] {
    return screen.getAllByRole('separator', {name: 'Resize column'});
  }

  it('widens and narrows the column with the arrow keys', () => {
    render(<DataTable columns={resizableColumns} data={data} enableColumnResizing />);
    expect(announcedWidth(handles()[0])).toBe(150);

    fireEvent.keyDown(handles()[0], {key: 'ArrowRight'});
    expect(announcedWidth(handles()[0])).toBe(158);
    expect(screen.getByRole('columnheader', {name: /Name/})).toHaveStyle({width: '158px'});
    expect(screen.getByRole('cell', {name: 'Role 1'})).toHaveStyle({width: '158px'});

    fireEvent.keyDown(handles()[0], {key: 'ArrowLeft', shiftKey: true});
    expect(announcedWidth(handles()[0])).toBe(126);
  });

  it('stops at the widest a column may get', () => {
    render(<DataTable columns={resizableColumns} data={data} enableColumnResizing />);
    expect(announcedWidth(handles()[1])).toBe(500);
    expect(handles()[1]).toHaveAttribute('aria-valuemax', '500');

    fireEvent.keyDown(handles()[1], {key: 'ArrowRight'});

    expect(announcedWidth(handles()[1])).toBe(500);
  });

  it('puts the column back to its declared width on Home', () => {
    render(<DataTable columns={resizableColumns} data={data} enableColumnResizing />);
    fireEvent.keyDown(handles()[0], {key: 'ArrowRight', shiftKey: true});
    expect(announcedWidth(handles()[0])).toBe(182);

    fireEvent.keyDown(handles()[0], {key: 'Home'});

    expect(announcedWidth(handles()[0])).toBe(150);
  });

  it('puts the column back to its declared width on a double click', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={resizableColumns} data={data} enableColumnResizing />);
    fireEvent.keyDown(handles()[1], {key: 'ArrowLeft'});
    expect(announcedWidth(handles()[1])).toBe(492);

    await user.dblClick(handles()[1]);

    expect(announcedWidth(handles()[1])).toBe(500);
  });

  it('keeps a resized width through a sort', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={resizableColumns} data={data} enableColumnResizing />);
    fireEvent.keyDown(handles()[0], {key: 'ArrowRight'});

    await user.click(screen.getByRole('button', {name: 'Sort ascending'}));

    expect(screen.getByRole('button', {name: 'Sort descending'})).toBeInTheDocument();
    expect(announcedWidth(handles()[0])).toBe(158);
    expect(screen.getByRole('cell', {name: 'Role 1'})).toHaveStyle({width: '158px'});
  });
});

describe('DataTable, freezing a column on a table that starts with an empty pinning state', () => {
  it('freezes the column from the Columns popover', async () => {
    // `{}` is what a consumer restores from storage that only ever held right-hand pins,
    // or passes to say "nothing frozen" without spelling out the two arrays.
    const user = userEvent.setup();
    render(
      <DataTable columns={columns} data={data} enableColumnVisibility enableColumnPinning initialColumnPinning={{}} />,
    );
    await user.click(screen.getByRole('button', {name: 'Columns'}));

    await user.click(await screen.findByRole('button', {name: 'Freeze Type to the left'}));

    expect(await screen.findByRole('button', {name: 'Unfreeze Type'})).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('columnheader', {name: 'Type', hidden: true})).toHaveStyle({position: 'sticky'});
    // A frozen column moves to the front of the row.
    expect(
      screen.getAllByRole('columnheader', {hidden: true}).map((header) => header.textContent?.replace(/[↑↓]/g, '')),
    ).toEqual(['Type', 'Name']);
  });
});

describe('DataTable, under a dark theme', () => {
  const dark = createTheme({palette: {mode: 'dark'}});
  const light = createTheme();
  const darkTint = alpha(dark.palette.primary.light, 0.12);
  const lightTint = alpha(light.palette.primary.main, 0.12);

  /** `alpha()` writes `rgba(r, g, b, a)`; the injected rule is compared without spaces. */
  function squash(css: string): string {
    return css.replace(/\s+/g, '');
  }

  it('tints a selected row on hover from the lighter primary shade', () => {
    // The main shade at 12% is close to invisible on a dark paper.
    render(
      <ThemeProvider theme={dark}>
        <DataTable columns={columns} data={data} enableRowSelection />
      </ThemeProvider>,
    );

    expect(squash(generatedCss(rowOf('Role 1')))).toContain(squash(darkTint));
  });

  it('keeps the main shade under a light theme', () => {
    render(<DataTable columns={columns} data={data} enableRowSelection />);

    expect(squash(generatedCss(rowOf('Role 1')))).toContain(squash(lightTint));
    expect(squash(generatedCss(rowOf('Role 1')))).not.toContain(squash(darkTint));
  });

  it('gives a frozen cell the same tint, since it paints over the row', () => {
    render(
      <ThemeProvider theme={dark}>
        <DataTable columns={columns} data={data} enableColumnPinning initialColumnPinning={{left: ['name']}} />
      </ThemeProvider>,
    );

    expect(squash(generatedCss(screen.getByRole('cell', {name: 'Role 1'})))).toContain(squash(darkTint));
  });
});

describe('DataTable, a label that changes after mount', () => {
  const table = (actions: string) => (
    <DataTable columns={columns} data={data} rowActions={rowActions} labels={{actions}} />
  );

  it('renames the actions column and leaves the sort buttons as they were', async () => {
    // One label arriving late from a locale bundle must not disturb the others.
    const user = userEvent.setup();
    const {rerender} = render(table('Actions'));
    expect(screen.getByRole('columnheader', {name: 'Actions'})).toBeInTheDocument();

    rerender(table('Aktionen'));

    expect(screen.getByRole('columnheader', {name: 'Aktionen'})).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', {name: 'Actions'})).not.toBeInTheDocument();

    await user.click(screen.getAllByRole('button', {name: 'Sort ascending'})[0]);

    expect(screen.getByRole('button', {name: 'Sort descending'})).toBeInTheDocument();
  });
});
