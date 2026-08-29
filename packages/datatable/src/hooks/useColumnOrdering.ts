import type {ColumnOrderState, Table} from '@tanstack/react-table';
import {useCallback, useState} from 'react';

import type {UseColumnOrderingReturn} from '../types';
import {orderWithPinned, resolveColumnPinning} from './useColumnPinning';

interface UseColumnOrderingOptions {
  readonly onOrderChange?: (newOrder: ColumnOrderState) => void;
}

export function useColumnOrdering<TData>(
  table: Table<TData>,
  options?: UseColumnOrderingOptions,
): UseColumnOrderingReturn {
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const isDragging = draggedColumn !== null;

  // Move `columnId` to the slot currently held by `targetId`. Works off the full
  // leaf-column list (which TanStack already returns in visual order), so special
  // columns like select/actions keep their positions without special-casing.
  const moveColumn = useCallback(
    (columnId: string, targetId: string) => {
      if (columnId === targetId) return;

      const currentOrder = table.getState().columnOrder;
      const columns = currentOrder.length > 0 ? currentOrder : table.getAllLeafColumns().map((c) => c.id);

      const fromIndex = columns.indexOf(columnId);
      const toIndex = columns.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1) return;

      const newOrder = [...columns];
      newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, columnId);

      // Frozen columns have to stay at the front of the row, so a drag that would break
      // the pinned block snaps back into it. A no-op when nothing is pinned.
      const pinning = table.getState().columnPinning;
      const nextOrder = orderWithPinned(newOrder, pinning.left ?? []);

      table.setColumnOrder(nextOrder);

      // Reordering two frozen columns against each other has to move the pinned array
      // with them: the header paints `columnPinning.left` in its own order, so leaving it
      // on the old arrangement splits the header from the body it labels.
      const nextPinning = resolveColumnPinning(pinning, nextOrder);
      if (nextPinning !== pinning) {
        table.setColumnPinning(nextPinning);
      }

      options?.onOrderChange?.(nextOrder);
    },
    [table, options],
  );

  const handleDragStart = useCallback((columnId: string) => {
    setDraggedColumn(columnId);
  }, []);

  const handleDragOver = useCallback(
    (columnId: string) => {
      if (!draggedColumn) return;
      // Back over the source row: the drop indicator disappears, so the pending
      // commit has to disappear with it.
      setDragOverColumn(draggedColumn === columnId ? null : columnId);
    },
    [draggedColumn],
  );

  // `dropEffect` is 'none' when the browser rejected the drop: Escape mid-drag, or a
  // release outside a valid target. Committing on every `dragend` reorders a column
  // the user visibly cancelled.
  const handleDragEnd = useCallback(
    (dropEffect?: string) => {
      if (dropEffect !== 'none' && draggedColumn && dragOverColumn) {
        moveColumn(draggedColumn, dragOverColumn);
      }

      setDraggedColumn(null);
      setDragOverColumn(null);
    },
    [draggedColumn, dragOverColumn, moveColumn],
  );

  const handleDragCancel = useCallback(() => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  }, []);

  return {
    draggedColumn,
    dragOverColumn,
    isDragging,
    moveColumn,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}
