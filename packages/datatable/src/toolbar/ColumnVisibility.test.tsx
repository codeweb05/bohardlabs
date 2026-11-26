/**
 * `ColumnVisibility` on its own, with only the props it requires.
 *
 * `DataTable` always passes the reordering, pinning and mobile flags, and every column in
 * its own tests has a text header, so three things were never run: the popover with the
 * flags left out, a column whose header is not text, and a drag that did not start in the
 * list. The last matters more than it looks. A row is a drop target, and a drop target that
 * accepts anything lets a file or a piece of selected text dragged across the popover show
 * the "move" cursor and then do nothing.
 *
 * jsdom attaches no `DataTransfer` to a synthetic drag event, so one is supplied.
 */
import {ThemeProvider, createTheme} from '@mui/material';
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {DataTableProvider} from '../DataTableContext';
import {DEFAULT_LABELS} from '../i18n';
import {fireEvent, parentOf, render, screen, waitFor} from '../test/test-utils';
import type {DataTableColumnDef, RowData} from '../types';
import {ColumnVisibility} from './ColumnVisibility';

interface Item extends RowData {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly city: string;
  readonly notes: string;
  readonly code: string;
}

const data: Item[] = [
  {id: 1, name: 'Detergent', email: 'ada@example.com', phone: '555', city: 'Pune', notes: '', code: 'D1'},
];

const columns: DataTableColumnDef<Item>[] = [
  {id: 'name', accessorKey: 'name', header: 'Name'},
  {id: 'email', accessorKey: 'email', header: () => <strong>Email</strong>},
];

/**
 * Two groups, plus three columns that land in the ungrouped list: one with no `meta`, one
 * whose group is an empty string, and one whose `meta` says something else entirely.
 */
const groupedColumns: DataTableColumnDef<Item>[] = [
  {id: 'name', accessorKey: 'name', header: 'Name'},
  {id: 'email', accessorKey: 'email', header: 'Email', meta: {group: 'Contact'}},
  {id: 'phone', accessorKey: 'phone', header: 'Phone', meta: {group: 'Contact'}},
  {id: 'city', accessorKey: 'city', header: 'Town', meta: {group: 'Address'}},
  {id: 'notes', accessorKey: 'notes', header: 'Notes', meta: {group: ''}},
  {id: 'code', accessorKey: 'code', header: 'Code', meta: {label: 'Product code'}},
];

interface HarnessProps {
  readonly enableReordering?: boolean;
  readonly dark?: boolean;
  readonly grouped?: boolean;
  readonly onReset?: () => void;
}

/** A shadow no default theme has, at the elevation MUI gives a popover. */
const POPOVER_SHADOW = '0 0 0 3px rgb(1, 2, 3)';

function themeFor(mode: 'light' | 'dark') {
  const theme = createTheme({palette: {mode}});
  theme.shadows[8] = POPOVER_SHADOW;
  return theme;
}

const lightTheme = themeFor('light');
const darkTheme = themeFor('dark');

function Harness({enableReordering, dark = false, grouped = false, onReset}: Readonly<HarnessProps>) {
  'use no memo';
  const table = useReactTable({data, columns: grouped ? groupedColumns : columns, getCoreRowModel: getCoreRowModel()});

  return (
    <ThemeProvider theme={dark ? darkTheme : lightTheme}>
      {/* The layout goes in the way DataTable passes it: it is what re-renders the open list. */}
      <DataTableProvider
        table={table}
        density="comfortable"
        setDensity={() => {}}
        columnVisibility={table.getState().columnVisibility}
        columnOrder={table.getState().columnOrder}
      >
        <ColumnVisibility table={table} enableReordering={enableReordering} onReset={onReset} />
      </DataTableProvider>
    </ThemeProvider>
  );
}

async function openPopover(props: HarnessProps = {}): Promise<HTMLElement> {
  render(<Harness {...props} />);
  await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.columns}));
  return screen.findByRole('list', {name: DEFAULT_LABELS.columns});
}

function dataTransfer() {
  return {effectAllowed: '', dropEffect: '', setData: vi.fn<(format: string, value: string) => void>()};
}

/** The rules MUI generated for an element, for values jsdom's computed style drops. */
function generatedCss(element: HTMLElement | null): string {
  if (!element) throw new Error('Expected an element to read styles from');
  const classNames = Array.from(element.classList);
  return Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .map((rule) => rule.cssText)
    .filter((css) => classNames.some((className) => css.includes(`.${className}`)))
    .join('\n');
}

describe('ColumnVisibility with only a table', () => {
  it('lists the columns with a checkbox each and nothing to drag or freeze', async () => {
    const list = await openPopover();

    expect(within(list).getAllByRole('checkbox')).toHaveLength(2);
    expect(within(list).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(DEFAULT_LABELS.reorderHint)).not.toBeInTheDocument();
    for (const row of within(list).getAllByRole('listitem')) {
      expect(row).toHaveAttribute('draggable', 'false');
    }
  });

  it('names a column by its id when the header is not text', async () => {
    // A header rendered from a function has no string to print beside the checkbox.
    const list = await openPopover();

    expect(within(list).getByRole('checkbox', {name: 'Name'})).toBeChecked();
    expect(within(list).getByRole('checkbox', {name: 'email'})).toBeChecked();
  });
});

describe('ColumnVisibility, drags that are not a reorder', () => {
  it('does not accept a drag that did not start in the list', async () => {
    const list = await openPopover({enableReordering: true});
    const [first] = within(list).getAllByRole('listitem');

    // `fireEvent` returns false when the handler called `preventDefault`, which for a
    // dragover is how a row says "you may drop here".
    const notAccepted = fireEvent.dragOver(first, {dataTransfer: dataTransfer()});

    expect(notAccepted).toBe(true);
  });

  it('accepts one that did', async () => {
    const list = await openPopover({enableReordering: true});
    const [first, second] = within(list).getAllByRole('listitem');
    const transfer = dataTransfer();

    fireEvent.dragStart(first, {dataTransfer: transfer});
    const notAccepted = fireEvent.dragOver(second, {dataTransfer: transfer});

    expect(notAccepted).toBe(false);
    expect(transfer.dropEffect).toBe('move');
  });

  it('swallows the drop, so the browser does not open the dragged text', async () => {
    // Firefox navigates to dropped text unless the drop is cancelled.
    const list = await openPopover({enableReordering: true});
    const [first] = within(list).getAllByRole('listitem');

    expect(fireEvent.drop(first, {dataTransfer: dataTransfer()})).toBe(false);
  });
});

describe('ColumnVisibility, under a theme of the consumer', () => {
  it.each([{dark: false}, {dark: true}])('casts the shadow the theme gives a popover, dark: $dark', async ({dark}) => {
    const list = await openPopover({dark});
    // The list sits in its group's box, which sits in the scroll container.
    const paper = parentOf(parentOf(parentOf(list)));

    // MUI hands the paper its shadow as a variable, and the rule only points at it.
    expect(paper).toHaveStyle({'--Paper-shadow': POPOVER_SHADOW});
    expect(generatedCss(paper)).toContain('box-shadow: var(--Paper-shadow)');
  });
});

/** The checkbox names in each list, keyed by the list's name, in the order on screen. */
function listsOnScreen(): Record<string, string[]> {
  return Object.fromEntries(
    screen.getAllByRole('list').map((list) => [
      list.getAttribute('aria-label'),
      within(list)
        .getAllByRole('checkbox')
        .map((box) => box.getAttribute('aria-label')),
    ]),
  );
}

describe('ColumnVisibility, groups', () => {
  it('lists the ungrouped columns first, then each group under its heading', async () => {
    await openPopover({grouped: true});

    expect(listsOnScreen()).toEqual({
      Columns: ['Name', 'Notes', 'Code'],
      Contact: ['Email', 'Phone'],
      Address: ['Town'],
    });
    expect(screen.getByText('Contact')).toBeVisible();
    expect(screen.getByText('Address')).toBeVisible();
  });

  it('refuses a drop on a row of another group', async () => {
    await openPopover({grouped: true, enableReordering: true});
    const [email, phone] = within(screen.getByRole('list', {name: 'Contact'})).getAllByRole('listitem');
    const [town] = within(screen.getByRole('list', {name: 'Address'})).getAllByRole('listitem');
    const transfer = dataTransfer();

    fireEvent.dragStart(email, {dataTransfer: transfer});
    expect(fireEvent.dragOver(phone, {dataTransfer: transfer})).toBe(false);
    // Across the boundary the row says no, and the pending drop on Phone is dropped with it.
    expect(fireEvent.dragOver(town, {dataTransfer: transfer})).toBe(true);
    fireEvent.dragEnd(email, {dataTransfer: {...transfer, dropEffect: 'move'}});

    expect(listsOnScreen().Contact).toEqual(['Email', 'Phone']);
  });

  it('moves a column with the arrow keys inside its group only', async () => {
    await openPopover({grouped: true, enableReordering: true});
    // The position counts the whole list, not the group.
    const handle = screen.getByRole('button', {name: 'Reorder Email, position 2 of 6'});

    fireEvent.keyDown(handle, {key: 'ArrowDown'});
    expect(listsOnScreen().Contact).toEqual(['Phone', 'Email']);

    // Email is last in Contact now. Town follows it in the row, but in another group.
    fireEvent.keyDown(screen.getByRole('button', {name: 'Reorder Email, position 3 of 6'}), {key: 'ArrowDown'});
    expect(listsOnScreen().Contact).toEqual(['Phone', 'Email']);
    expect(listsOnScreen().Address).toEqual(['Town']);
  });
});

describe('ColumnVisibility, search', () => {
  it('matches the column id as well as what the row shows', async () => {
    await openPopover({grouped: true});

    await userEvent.type(screen.getByRole('textbox', {name: DEFAULT_LABELS.searchColumns}), 'CITY');

    // A group with nothing left in it goes, heading and all.
    expect(listsOnScreen()).toEqual({Address: ['Town']});
    expect(screen.queryByText('Contact')).not.toBeInTheDocument();
  });

  it('matches the label', async () => {
    await openPopover({grouped: true});

    await userEvent.type(screen.getByRole('textbox', {name: DEFAULT_LABELS.searchColumns}), ' pho ');

    expect(listsOnScreen()).toEqual({Contact: ['Phone']});
  });

  it('starts empty each time the menu opens', async () => {
    await openPopover({grouped: true});
    await userEvent.type(screen.getByRole('textbox', {name: DEFAULT_LABELS.searchColumns}), 'town');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.columns}));

    expect(await screen.findByRole('textbox', {name: DEFAULT_LABELS.searchColumns})).toHaveValue('');
    expect(Object.keys(listsOnScreen())).toEqual(['Columns', 'Contact', 'Address']);
  });
});

describe('ColumnVisibility, footer', () => {
  it('counts the hidden columns', async () => {
    await openPopover({grouped: true});
    expect(screen.getByText('Hidden (0)')).toBeVisible();

    await userEvent.click(screen.getByRole('checkbox', {name: 'Phone'}));

    expect(screen.getByText('Hidden (1)')).toBeVisible();
  });

  it('offers no reset without a handler', async () => {
    await openPopover();

    expect(screen.queryByRole('button', {name: DEFAULT_LABELS.resetColumns})).not.toBeInTheDocument();
  });

  it('hands the reset to the table', async () => {
    const onReset = vi.fn<() => void>();
    await openPopover({onReset});

    await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.resetColumns}));

    expect(onReset).toHaveBeenCalledOnce();
  });
});
