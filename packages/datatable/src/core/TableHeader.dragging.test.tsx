/**
 * Coverage for the header cell's own drag handlers (TableHeader.tsx:565-571).
 *
 * Column reordering has two entry points: the toolbar list, which is tested in
 * toolbar/ColumnOrdering.test.tsx, and dragging a header directly, which nothing
 * touched. The `onDragOver` body was uncovered, and its `preventDefault()` is the line
 * that makes the drop legal at all: without it the browser refuses the drop and the
 * header snaps back, with no error anywhere to explain why.
 */
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {createEvent, fireEvent, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import {DataTableProvider} from '../DataTableContext';
import {render} from '../test/test-utils';
import type {DataTableColumnDef, RowData} from '../types';
import {TableHeader} from './TableHeader';

interface Item extends RowData {
  readonly id: number;
  readonly name: string;
  readonly email: string;
}

const data: Item[] = [{id: 1, name: 'Detergent', email: 'ada@example.com'}];

const columns: DataTableColumnDef<Item>[] = [
  {id: 'name', accessorKey: 'name', header: 'Name'},
  {id: 'email', accessorKey: 'email', header: 'Email'},
];

interface HarnessProps {
  readonly enableColumnOrdering?: boolean;
  readonly onColumnDragStart?: (columnId: string) => void;
  readonly onColumnDragOver?: (columnId: string) => void;
  readonly onColumnDragEnd?: () => void;
}

function Harness(props: Readonly<HarnessProps>) {
  'use no memo';
  const table = useReactTable({data, columns, getCoreRowModel: getCoreRowModel()});

  return (
    <DataTableProvider table={table} density="comfortable" setDensity={() => {}} isMobile={false}>
      <table>
        <TableHeader table={table} {...props} />
      </table>
    </DataTableProvider>
  );
}

function headerCell(name: string) {
  return screen.getByRole('columnheader', {name: new RegExp(name)});
}

describe('TableHeader — dragging a column', () => {
  it('reports the column the drag started on', () => {
    const onColumnDragStart = vi.fn();
    render(<Harness enableColumnOrdering onColumnDragStart={onColumnDragStart} />);

    fireEvent.dragStart(headerCell('Name'));

    expect(onColumnDragStart).toHaveBeenCalledExactlyOnceWith('name');
  });

  it('reports the column being dragged over', () => {
    const onColumnDragOver = vi.fn();
    render(<Harness enableColumnOrdering onColumnDragOver={onColumnDragOver} />);

    fireEvent.dragOver(headerCell('Email'));

    expect(onColumnDragOver).toHaveBeenCalledExactlyOnceWith('email');
  });

  it('accepts the drop by cancelling the default drag-over behaviour', () => {
    // The browser's default is to reject the drop. Not calling preventDefault here is
    // the classic HTML5 drag-and-drop bug: the drag looks fine and nothing happens.
    render(<Harness enableColumnOrdering onColumnDragOver={vi.fn()} />);
    const event = createEvent.dragOver(headerCell('Email'));

    fireEvent(headerCell('Email'), event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('reports the end of the drag', () => {
    const onColumnDragEnd = vi.fn();
    render(<Harness enableColumnOrdering onColumnDragEnd={onColumnDragEnd} />);

    fireEvent.dragEnd(headerCell('Name'));

    expect(onColumnDragEnd).toHaveBeenCalledOnce();
  });

  it('marks the headers draggable only when ordering is enabled', () => {
    const {unmount} = render(<Harness enableColumnOrdering />);

    expect(headerCell('Name')).toHaveAttribute('draggable', 'true');

    unmount();
    render(<Harness />);

    expect(headerCell('Name')).toHaveAttribute('draggable', 'false');
  });

  it('survives a drag with no handlers wired up', () => {
    // Every handler is optional, and `enableColumnOrdering` without them is what a
    // consumer gets if they turn the prop on before wiring the state.
    render(<Harness enableColumnOrdering />);

    expect(() => {
      fireEvent.dragStart(headerCell('Name'));
      fireEvent.dragOver(headerCell('Email'));
      fireEvent.dragEnd(headerCell('Email'));
    }).not.toThrow();
  });
});
