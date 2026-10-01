import type {Table} from '@tanstack/react-table';
import {useCallback, useEffect, useRef, useState} from 'react';

import type {RowData} from '../types';

/** The narrowest and widest one column may get, where that differs from the table's. */
interface ResizeLimits {
  readonly min: number;
  readonly max: number;
}

interface ResizeState {
  columnId: string | null;
  startX: number;
  startWidth: number;
  limits?: ResizeLimits;
}

interface UseColumnResizeOptions<TData extends RowData> {
  table: Table<TData>;
  minWidth?: number;
  maxWidth?: number;
}

interface UseColumnResizeReturn {
  isResizing: boolean;
  resizingColumnId: string | null;
  handleResizeStart: (
    columnId: string,
    startWidth: number,
    limits?: ResizeLimits,
  ) => (e: React.MouseEvent | React.TouchEvent) => void;
  /** Applies a width delta in one step. The keyboard path, where there is no drag to follow. */
  resizeColumnBy: (columnId: string, currentWidth: number, delta: number, limits?: ResizeLimits) => void;
}

export function useColumnResize<TData extends RowData>({
  table,
  minWidth = 50,
  maxWidth = 500,
}: UseColumnResizeOptions<TData>): UseColumnResizeReturn {
  const [resizingColumnId, setResizingColumnId] = useState<string | null>(null);
  const resizeStateRef = useRef<ResizeState>({
    columnId: null,
    startX: 0,
    startWidth: 0,
  });

  // Keep table/constraints in refs so the effect handlers stay current without re-subscribing
  const tableRef = useRef(table);
  const minWidthRef = useRef(minWidth);
  const maxWidthRef = useRef(maxWidth);

  useEffect(() => {
    tableRef.current = table;
  }, [table]);

  useEffect(() => {
    minWidthRef.current = minWidth;
  }, [minWidth]);

  useEffect(() => {
    maxWidthRef.current = maxWidth;
  }, [maxWidth]);

  // Manage document-level listeners via effect when resizing is active
  useEffect(() => {
    if (resizingColumnId === null) return;

    const applyWidth = (clientX: number) => {
      const {columnId, startX, startWidth, limits} = resizeStateRef.current;
      if (!columnId) return;

      const min = limits?.min ?? minWidthRef.current;
      const max = limits?.max ?? maxWidthRef.current;
      const newWidth = Math.min(max, Math.max(min, startWidth + (clientX - startX)));
      tableRef.current.setColumnSizing((prev) => ({
        ...prev,
        [columnId]: newWidth,
      }));
    };

    const handleMouseMove = (e: MouseEvent) => {
      applyWidth(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      applyWidth(touch.clientX);
    };

    const handleEnd = () => {
      resizeStateRef.current = {columnId: null, startX: 0, startWidth: 0};
      setResizingColumnId(null);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleEnd);
    // The browser fires `touchcancel` instead of `touchend` whenever it takes the gesture
    // away (an incoming call, a system gesture, a move it reinterprets as a scroll).
    // Without it the drag never ends: the body keeps `col-resize` and `user-select: none`,
    // and the document listeners stay subscribed, so the next touch anywhere on the page
    // goes on resizing the column.
    document.addEventListener('touchcancel', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);

      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizingColumnId]);

  const handleResizeStart = useCallback(
    (columnId: string, startWidth: number, limits?: ResizeLimits) => (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;

      resizeStateRef.current = {
        columnId,
        startX: clientX,
        startWidth,
        limits,
      };
      setResizingColumnId(columnId);
    },
    [],
  );

  const resizeColumnBy = useCallback((columnId: string, currentWidth: number, delta: number, limits?: ResizeLimits) => {
    const min = limits?.min ?? minWidthRef.current;
    const max = limits?.max ?? maxWidthRef.current;
    const nextWidth = Math.min(max, Math.max(min, currentWidth + delta));
    if (nextWidth === currentWidth) return;

    tableRef.current.setColumnSizing((prev) => ({...prev, [columnId]: nextWidth}));
  }, []);

  return {
    isResizing: resizingColumnId !== null,
    resizingColumnId,
    handleResizeStart,
    resizeColumnBy,
  };
}
