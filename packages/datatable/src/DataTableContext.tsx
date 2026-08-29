import type {ColumnPinningState, Row, Table} from '@tanstack/react-table';
import {useCallback, useMemo, useState} from 'react';

import type {TableCoreContextValue, TableEditingContextValue, TableUIContextValue} from './DataTableContext.hooks';
import {TableCoreContext, TableEditingContext, TableUIContext} from './DataTableContext.hooks';
import {useLabels} from './i18n';
import type {RowData, TableDensity} from './types';

// ============================================================================
// PROVIDER
// ============================================================================

/** Props for DataTableProvider */
interface DataTableProviderProps<TData extends RowData> {
  readonly children: React.ReactNode;
  readonly table: Table<TData>;
  readonly density: TableDensity;
  readonly setDensity: (density: TableDensity) => void;
  readonly isMobile?: boolean;
  readonly onRowEdit?: (rowId: string, data: Partial<TData>) => Promise<void>;
  readonly rowSelection?: Record<string, boolean>;
  readonly pagination?: {pageIndex: number; pageSize: number};
  readonly columnSizing?: Record<string, number>;
  readonly columnVisibility?: Record<string, boolean>;
  readonly columnOrder?: readonly string[];
  readonly columnPinning?: ColumnPinningState;
  readonly sorting?: Array<{id: string; desc: boolean}>;
  readonly expanded?: Record<string, boolean> | boolean;
  readonly dataVersion?: number;
  readonly columnsVersion?: number;
}

/** Provider component for DataTable context — wraps 3 nested contexts */
export function DataTableProvider<TData extends RowData>({
  children,
  table,
  density,
  setDensity,
  isMobile = false,
  onRowEdit,
  rowSelection,
  pagination,
  columnSizing,
  columnVisibility,
  columnOrder,
  columnPinning,
  sorting,
  expanded,
  dataVersion,
  columnsVersion,
}: Readonly<DataTableProviderProps<TData>>) {
  const labels = useLabels();

  // Inline editing state
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<TData>>({});
  const [originalData, setOriginalData] = useState<TData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const isEditing = useCallback((rowId: string) => editingRowId === rowId, [editingRowId]);

  const startEdit = useCallback((row: Row<TData>) => {
    setEditingRowId(String(row.original.id));
    setOriginalData(row.original);
    setEditingData({...row.original});
    setEditError(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingRowId(null);
    setEditingData({});
    setOriginalData(null);
    setEditError(null);
  }, []);

  const updateEditField = useCallback((field: keyof TData, value: unknown) => {
    setEditingData((prev) => ({...prev, [field]: value}));
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingRowId || !originalData || !onRowEdit) {
      cancelEdit();
      return;
    }

    const changedFields: Partial<TData> = {};
    for (const key in editingData) {
      const typedKey = key as keyof TData;
      if (editingData[typedKey] !== originalData[typedKey]) {
        changedFields[typedKey] = editingData[typedKey] as TData[keyof TData];
      }
    }

    if (Object.keys(changedFields).length === 0) {
      cancelEdit();
      return;
    }

    setIsSaving(true);
    setEditError(null);

    try {
      await onRowEdit(editingRowId, changedFields);
      cancelEdit();
    } catch (error) {
      // Anything that is not a thrown `Error` lands here: an axios rejection carrying a
      // plain object, a string thrown by a consumer's `onRowEdit`, an aborted request.
      // The row renders this, so it has to be translated.
      const message = error instanceof Error ? error.message : labels.saveFailed;
      setEditError(message);
    } finally {
      setIsSaving(false);
    }
  }, [editingRowId, editingData, originalData, onRowEdit, cancelEdit, labels]);

  // Core context — table instance, mobile flag, data and column versions
  const coreValue = useMemo<TableCoreContextValue<TData>>(
    () => ({table, isMobile, dataVersion, columnsVersion}),
    [table, isMobile, dataVersion, columnsVersion],
  );

  // UI context — all UI state that triggers re-renders
  const uiValue = useMemo<TableUIContextValue>(
    () => ({
      density,
      setDensity,
      rowSelection,
      pagination,
      columnSizing,
      columnVisibility,
      columnOrder,
      columnPinning,
      sorting,
      expanded,
    }),

    [
      density,
      setDensity,
      rowSelection,
      pagination,
      columnSizing,
      columnVisibility,
      columnOrder,
      columnPinning,
      sorting,
      expanded,
    ],
  );

  // Editing context — inline editing state
  const editingValue = useMemo<TableEditingContextValue<TData>>(
    () => ({
      editingRowId,
      editingData,
      isEditing,
      startEdit,
      cancelEdit,
      saveEdit,
      updateEditField,
      isSaving,
      editError,
    }),
    [editingRowId, editingData, isEditing, startEdit, cancelEdit, saveEdit, updateEditField, isSaving, editError],
  );

  return (
    <TableCoreContext.Provider value={coreValue as unknown as TableCoreContextValue<RowData>}>
      <TableUIContext.Provider value={uiValue}>
        <TableEditingContext.Provider value={editingValue as unknown as TableEditingContextValue<RowData>}>
          {children}
        </TableEditingContext.Provider>
      </TableUIContext.Provider>
    </TableCoreContext.Provider>
  );
}
