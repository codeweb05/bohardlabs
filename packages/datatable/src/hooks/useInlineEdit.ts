import type {Row} from '@tanstack/react-table';
import {useCallback, useState} from 'react';

import {getErrorMessage} from '../query/errors';
import type {RowData, UseInlineEditOptions, UseInlineEditReturn} from '../types';

/**
 * Row-level edit state for a table that saves through the consumer's own data layer.
 *
 * It holds which row is open, the draft values, and the outcome of the last save. It does
 * not fetch, cache or invalidate anything: `onSave` is your function, and what happens
 * after a successful write (refetch, optimistic patch, toast) is yours to decide in
 * `onSuccess`. That is why this hook has no React Query in it and ships from the main
 * entry point rather than `@bohar/datatable/server`.
 *
 * Only changed fields are sent. A save with no changes closes the row without a request.
 * A failed save keeps the row open with the draft intact, so the user can fix and retry.
 *
 * @example
 * ```tsx
 * const edit = useInlineEdit<Order>({
 *   onSave: (id, patch) => api.patch(`/orders/${id}`, patch),
 *   onSuccess: () => queryClient.invalidateQueries({queryKey: ['orders']}),
 * });
 * ```
 */
export function useInlineEdit<TData extends RowData>(options: UseInlineEditOptions<TData>): UseInlineEditReturn<TData> {
  const {onSave, onError, onSuccess} = options;

  // State
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<TData>>({});
  const [originalData, setOriginalData] = useState<TData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if a row is being edited
  const isEditing = useCallback((rowId: string) => editingRowId === rowId, [editingRowId]);

  // Start editing a row
  const startEdit = useCallback((row: Row<TData>) => {
    const rowId = String(row.original.id);
    setEditingRowId(rowId);
    setOriginalData(row.original);
    setEditingData({...row.original});
  }, []);

  // Cancel editing. The message is cleared too: without that, a failed save leaves its
  // error on screen through the cancel and into the next row the user opens.
  const cancelEdit = useCallback(() => {
    setEditingRowId(null);
    setEditingData({});
    setOriginalData(null);
    setError(null);
  }, []);

  // Update a field while editing
  const updateField = useCallback((field: keyof TData, value: unknown) => {
    setEditingData((prev) => ({...prev, [field]: value}));
  }, []);

  // Save edited row
  const saveEdit = useCallback(async () => {
    if (!editingRowId || !originalData) {
      cancelEdit();
      return;
    }

    // Calculate changed fields only
    const changedFields: Partial<TData> = {};
    for (const key in editingData) {
      const typedKey = key as keyof TData;
      if (editingData[typedKey] !== originalData[typedKey]) {
        changedFields[typedKey] = editingData[typedKey] as TData[keyof TData];
      }
    }

    // If no changes, just cancel
    if (Object.keys(changedFields).length === 0) {
      cancelEdit();
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editingRowId, changedFields);
      setEditingRowId(null);
      setEditingData({});
      setOriginalData(null);
      setError(null);
      onSuccess?.(editingRowId);
    } catch (caught) {
      // The row stays open with the draft in it. `onError` gets an `Error` whatever the
      // transport threw, because a consumer's handler should not have to type-narrow it.
      setError(getErrorMessage(caught));
      onError?.(caught instanceof Error ? caught : new Error(getErrorMessage(caught)), editingRowId);
      throw caught;
    } finally {
      setIsSaving(false);
    }
  }, [editingRowId, editingData, originalData, onSave, onSuccess, onError, cancelEdit]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    editingRowId,
    editingData,
    isEditing,
    isSaving,
    error,
    startEdit,
    cancelEdit,
    updateField,
    saveEdit,
    clearError,
  };
}
