/**
 * Coverage for `handleDragCancel`, the one part of `useColumnOrdering` that nothing
 * reached. The rest of the hook is exercised through `toolbar/ColumnOrdering.test.tsx`.
 *
 * The hook is exported from the package entry point, so `handleDragCancel` is public API
 * even though no component in this repo calls it: the header wires `onDragEnd` to
 * `handleDragEnd` and the reorder dialog does the same. A consumer wiring a `dragexit` or
 * an Escape key to it gets the abort path, and it has to leave no pending move behind.
 */
import type {ColumnDef} from '@tanstack/react-table';
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {act, renderHook} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import {useColumnOrdering} from './useColumnOrdering';

interface Item {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly [key: string]: unknown;
}

const data: Item[] = [{id: 'item-1', name: 'Detergent', quantity: 2}];
const columns: ColumnDef<Item>[] = [
  {id: 'name', accessorKey: 'name'},
  {id: 'quantity', accessorKey: 'quantity'},
];

function renderColumnOrdering() {
  const onOrderChange = vi.fn<(order: string[]) => void>();
  const view = renderHook(() => {
    const table = useReactTable({data, columns, getCoreRowModel: getCoreRowModel()});
    return useColumnOrdering<Item>(table, {onOrderChange});
  });
  return {...view, onOrderChange};
}

describe('useColumnOrdering — cancelling a drag', () => {
  it('drops the pending move', () => {
    // `handleDragEnd` would commit here. Cancel is the path that must not, or Escape
    // mid-drag reorders the very column the user was backing out of.
    const {result, onOrderChange} = renderColumnOrdering();
    act(() => {
      result.current.handleDragStart('name');
    });
    act(() => {
      result.current.handleDragOver('quantity');
    });

    act(() => {
      result.current.handleDragCancel();
    });

    expect(onOrderChange).not.toHaveBeenCalled();
  });

  it('clears the drag state so the next drag starts clean', () => {
    // `isDragging` drives the drop indicator and the dragged column's styling. Leaving
    // it set paints a column as mid-drag with no drag in progress.
    const {result} = renderColumnOrdering();
    act(() => {
      result.current.handleDragStart('name');
    });
    act(() => {
      result.current.handleDragOver('quantity');
    });
    expect(result.current.isDragging).toBe(true);

    act(() => {
      result.current.handleDragCancel();
    });

    expect(result.current.draggedColumn).toBeNull();
    expect(result.current.dragOverColumn).toBeNull();
    expect(result.current.isDragging).toBe(false);
  });

  it('is safe to call with no drag in progress', () => {
    const {result} = renderColumnOrdering();

    act(() => {
      result.current.handleDragCancel();
    });

    expect(result.current.isDragging).toBe(false);
  });
});

/**
 * `moveColumn` is the half of the hook a consumer can call directly, from a keyboard
 * shortcut or a "move left" menu item, so it has to hold up against ids it was not built
 * around: the column it is already on, one that does not exist, and a table whose pinning
 * state was restored from storage without a `left` list.
 */
describe('useColumnOrdering, moving a column by id', () => {
  it('reports the new order, starting from the declared one when none is stored', () => {
    const {result, onOrderChange} = renderColumnOrdering();

    act(() => {
      result.current.moveColumn('quantity', 'name');
    });

    expect(onOrderChange).toHaveBeenCalledExactlyOnceWith(['quantity', 'name']);
  });

  it('does nothing when a column is moved onto itself', () => {
    const {result, onOrderChange} = renderColumnOrdering();

    act(() => {
      result.current.moveColumn('name', 'name');
    });

    expect(onOrderChange).not.toHaveBeenCalled();
  });

  it('does nothing for a column the table does not have', () => {
    // A stored shortcut can outlive the column it pointed at.
    const {result, onOrderChange} = renderColumnOrdering();

    act(() => {
      result.current.moveColumn('retired', 'name');
    });
    act(() => {
      result.current.moveColumn('name', 'retired');
    });

    expect(onOrderChange).not.toHaveBeenCalled();
  });

  it('still reorders when the pinning state carries no left list', () => {
    const onOrderChange = vi.fn<(order: string[]) => void>();
    const {result} = renderHook(() => {
      const table = useReactTable({
        data,
        columns,
        initialState: {columnPinning: {}},
        getCoreRowModel: getCoreRowModel(),
      });
      return useColumnOrdering<Item>(table, {onOrderChange});
    });

    act(() => {
      result.current.moveColumn('quantity', 'name');
    });

    expect(onOrderChange).toHaveBeenCalledExactlyOnceWith(['quantity', 'name']);
  });
});

describe('useColumnOrdering, a drag-over with no drag in progress', () => {
  it('marks no drop target', () => {
    // A file dragged in from the desktop fires `dragover` on the headers too. Marking a
    // target for it would commit a move on the next real drag.
    const {result, onOrderChange} = renderColumnOrdering();

    act(() => {
      result.current.handleDragOver('quantity');
    });

    expect(result.current.dragOverColumn).toBeNull();

    act(() => {
      result.current.handleDragEnd();
    });

    expect(onOrderChange).not.toHaveBeenCalled();
  });
});
