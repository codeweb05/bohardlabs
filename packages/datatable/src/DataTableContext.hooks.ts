import type {ColumnPinningState, Row, Table} from '@tanstack/react-table';
import {createContext, useContext, useMemo} from 'react';

import type {DataTableContextValue, RowData, TableDensity} from './types';

// ============================================================================
// CONTEXT TYPES
// ============================================================================

/** Core table context — stable references that rarely change */
export interface TableCoreContextValue<TData extends RowData> {
  readonly table: Table<TData>;
  readonly isMobile: boolean;
  readonly dataVersion?: number;
  /**
   * Bumped whenever the `columns` prop changes identity. Same job as `dataVersion`, for
   * the other half of the table: headers and cell renderers both live on the column
   * definitions and are read through the stable `table` reference, so a language switch
   * or a swap to a different column set has no input the React Compiler can see and the
   * previous render's markup is served instead.
   */
  readonly columnsVersion?: number;
}

/** UI state context — changes on user interactions (sort, page, select, expand, etc.) */
export interface TableUIContextValue {
  readonly density: TableDensity;
  readonly setDensity: (density: TableDensity) => void;
  readonly rowSelection?: Record<string, boolean>;
  readonly pagination?: {pageIndex: number; pageSize: number};
  readonly columnSizing?: Record<string, number>;
  readonly columnVisibility?: Record<string, boolean>;
  readonly columnOrder?: readonly string[];
  readonly columnPinning?: ColumnPinningState;
  readonly sorting?: Array<{id: string; desc: boolean}>;
  readonly expanded?: Record<string, boolean> | boolean;
}

/** Editing context — only changes when inline editing is active */
export interface TableEditingContextValue<TData extends RowData> {
  readonly editingRowId: string | null;
  readonly editingData: Partial<TData>;
  readonly isEditing: (rowId: string) => boolean;
  readonly startEdit: (row: Row<TData>) => void;
  readonly cancelEdit: () => void;
  readonly saveEdit: () => Promise<void>;
  readonly updateEditField: (field: keyof TData, value: unknown) => void;
  readonly isSaving: boolean;
  readonly editError: string | null;
}

// ============================================================================
// CONTEXTS
// ============================================================================

export const TableCoreContext = createContext<TableCoreContextValue<RowData> | undefined>(undefined);
export const TableUIContext = createContext<TableUIContextValue | undefined>(undefined);
export const TableEditingContext = createContext<TableEditingContextValue<RowData> | undefined>(undefined);

// ============================================================================
// GRANULAR HOOKS
// ============================================================================

/** Hook to access core table context (table instance, mobile, dataVersion) */
export function useTableCore<TData extends RowData>(): TableCoreContextValue<TData> {
  const context = useContext(TableCoreContext);
  if (!context) {
    throw new Error('useTableCore must be used within a DataTableProvider');
  }
  return context as unknown as TableCoreContextValue<TData>;
}

/** Hook to access UI state context (density, selection, pagination, sorting, etc.) */
export function useTableUI(): TableUIContextValue {
  const context = useContext(TableUIContext);
  if (!context) {
    throw new Error('useTableUI must be used within a DataTableProvider');
  }
  return context;
}

/** Hook to access inline editing context */
export function useTableEditingContext<TData extends RowData>(): TableEditingContextValue<TData> {
  const context = useContext(TableEditingContext);
  if (!context) {
    throw new Error('useTableEditingContext must be used within a DataTableProvider');
  }
  return context as unknown as TableEditingContextValue<TData>;
}

// ============================================================================
// BACKWARD-COMPATIBLE HOOKS (merge all 3 contexts)
// ============================================================================

/** Hook to access full DataTable context (backward-compatible — merges all 3 contexts) */
export function useDataTableContext<TData extends RowData>(): DataTableContextValue<TData> {
  const core = useTableCore<TData>();
  const ui = useTableUI();
  const editing = useTableEditingContext<TData>();

  return useMemo(
    () => ({
      ...core,
      ...ui,
      ...editing,
    }),
    [core, ui, editing],
  ) as DataTableContextValue<TData>;
}

/** Hook to access just the table instance */
export function useDataTable<TData extends RowData>(): Table<TData> {
  const {table} = useTableCore<TData>();
  return table;
}

/** Hook to access density state */
export function useTableDensity(): {
  density: TableDensity;
  setDensity: (density: TableDensity) => void;
} {
  const {density, setDensity} = useTableUI();
  return {density, setDensity};
}

/** Hook to access inline editing state */
export function useTableEditing<TData extends RowData>() {
  const editing = useTableEditingContext<TData>();
  return editing;
}

/** Hook to check if currently on mobile */
export function useTableMobile(): boolean {
  const {isMobile} = useTableCore();
  return isMobile;
}
