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
import {fireEvent, parentOf, render, screen} from '../test/test-utils';
import type {DataTableColumnDef, RowData} from '../types';
import {ColumnVisibility} from './ColumnVisibility';

interface Item extends RowData {
  readonly id: number;
  readonly name: string;
  readonly email: string;
}

const data: Item[] = [{id: 1, name: 'Detergent', email: 'ada@example.com'}];

const columns: DataTableColumnDef<Item>[] = [
  {id: 'name', accessorKey: 'name', header: 'Name'},
  {id: 'email', accessorKey: 'email', header: () => <strong>Email</strong>},
];

interface HarnessProps {
  readonly enableReordering?: boolean;
  readonly dark?: boolean;
}

function Harness({enableReordering, dark = false}: Readonly<HarnessProps>) {
  'use no memo';
  const table = useReactTable({data, columns, getCoreRowModel: getCoreRowModel()});

  return (
    <ThemeProvider theme={createTheme({palette: {mode: dark ? 'dark' : 'light'}})}>
      <DataTableProvider table={table} density="comfortable" setDensity={() => {}}>
        <ColumnVisibility table={table} enableReordering={enableReordering} />
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

describe('ColumnVisibility, under a dark theme', () => {
  it('casts a heavier shadow, which is what lifts the popover off a dark page', async () => {
    const list = await openPopover({dark: true});

    expect(generatedCss(parentOf(list))).toContain('rgba(0, 0, 0, 0.4)');
  });

  it('keeps the light one under a light theme', async () => {
    const list = await openPopover();

    expect(generatedCss(parentOf(list))).toContain('rgba(0, 0, 0, 0.08)');
  });
});
