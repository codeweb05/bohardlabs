/**
 * Coverage for `useInlineEdit`, previously 0%.
 *
 * The hook is exported from the DataTable barrel but nothing in the app renders it
 * yet, so this is the only description of its contract. The parts worth pinning
 * down: only changed fields are sent, a no-op save does not hit the server at all,
 * and a failed save keeps the row in edit mode so the user can retry.
 *
 * The block at the bottom guards a bug that has since been fixed; it is kept as a
 * regression test.
 */
import type {ColumnDef} from '@tanstack/react-table';
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {act, renderHook, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {createTestWrapper} from '../test/test-utils';
import {useInlineEdit} from './useInlineEdit';

interface Item {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly [key: string]: unknown;
}

const data: Item[] = [
  {id: 'item-1', name: 'Detergent', quantity: 2},
  {id: 'item-2', name: 'Softener', quantity: 5},
];

const columns: ColumnDef<Item>[] = [
  {id: 'name', accessorKey: 'name'},
  {id: 'quantity', accessorKey: 'quantity'},
];

const onSave = vi.fn<(rowId: string, patch: Partial<Item>) => Promise<void>>();
const onSuccess = vi.fn();
const onError = vi.fn();

/** Renders the hook next to a real table so `startEdit` gets a genuine Row object. */
function renderInlineEdit() {
  const {wrapper} = createTestWrapper();
  return renderHook(
    () => {
      const table = useReactTable({data, columns, getCoreRowModel: getCoreRowModel()});
      return {edit: useInlineEdit<Item>({onSave, onSuccess, onError}), rows: table.getRowModel().rows};
    },
    {wrapper},
  );
}

beforeEach(() => {
  onSave.mockReset().mockResolvedValue(undefined);
  onSuccess.mockReset();
  onError.mockReset();
});

describe('useInlineEdit', () => {
  it('starts with no row in edit mode', () => {
    const {result} = renderInlineEdit();

    expect(result.current.edit.editingRowId).toBeNull();
    expect(result.current.edit.editingData).toEqual({});
    expect(result.current.edit.isSaving).toBe(false);
    expect(result.current.edit.error).toBeNull();
    expect(result.current.edit.isEditing('item-1')).toBe(false);
  });

  it('seeds the draft from the row when editing starts', () => {
    const {result} = renderInlineEdit();

    act(() => {
      result.current.edit.startEdit(result.current.rows[0]);
    });

    expect(result.current.edit.editingRowId).toBe('item-1');
    expect(result.current.edit.editingData).toEqual(data[0]);
  });

  it('reports only the edited row as editing', () => {
    const {result} = renderInlineEdit();

    act(() => {
      result.current.edit.startEdit(result.current.rows[0]);
    });

    expect(result.current.edit.isEditing('item-1')).toBe(true);
    expect(result.current.edit.isEditing('item-2')).toBe(false);
  });

  it('merges field updates into the draft without touching the rest', () => {
    const {result} = renderInlineEdit();

    act(() => {
      result.current.edit.startEdit(result.current.rows[0]);
    });
    act(() => {
      result.current.edit.updateField('name', 'Bleach');
    });

    expect(result.current.edit.editingData).toEqual({...data[0], name: 'Bleach'});
  });

  it('sends only the fields that actually changed', async () => {
    // A PATCH carrying every field would clobber concurrent edits to columns the
    // user never touched.
    const {result} = renderInlineEdit();

    act(() => {
      result.current.edit.startEdit(result.current.rows[0]);
    });
    act(() => {
      result.current.edit.updateField('quantity', 9);
    });
    await act(async () => {
      await result.current.edit.saveEdit();
    });

    expect(onSave).toHaveBeenCalledExactlyOnceWith('item-1', {quantity: 9});
  });

  it('does not call the server when nothing changed', async () => {
    const {result} = renderInlineEdit();

    act(() => {
      result.current.edit.startEdit(result.current.rows[0]);
    });
    await act(async () => {
      await result.current.edit.saveEdit();
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.edit.editingRowId).toBeNull();
  });

  it('does nothing when saving without an active row', async () => {
    const {result} = renderInlineEdit();

    await act(async () => {
      await result.current.edit.saveEdit();
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('leaves edit mode and reports success after a save', async () => {
    const {result} = renderInlineEdit();

    act(() => {
      result.current.edit.startEdit(result.current.rows[0]);
    });
    act(() => {
      result.current.edit.updateField('name', 'Bleach');
    });
    await act(async () => {
      await result.current.edit.saveEdit();
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledExactlyOnceWith('item-1');
    });
    expect(result.current.edit.editingRowId).toBeNull();
    expect(result.current.edit.editingData).toEqual({});
  });

  it('keeps the row in edit mode when the save fails', async () => {
    // Dropping the draft on failure would lose whatever the user typed.
    onSave.mockRejectedValue(new Error('Conflict'));
    const {result} = renderInlineEdit();

    act(() => {
      result.current.edit.startEdit(result.current.rows[0]);
    });
    act(() => {
      result.current.edit.updateField('name', 'Bleach');
    });
    await act(async () => {
      await result.current.edit.saveEdit().catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.edit.error).toBe('Conflict');
    });
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'item-1');
    expect(result.current.edit.editingRowId).toBe('item-1');
    expect(result.current.edit.editingData).toMatchObject({name: 'Bleach'});
  });

  it('discards the draft on cancel', () => {
    const {result} = renderInlineEdit();

    act(() => {
      result.current.edit.startEdit(result.current.rows[0]);
    });
    act(() => {
      result.current.edit.updateField('name', 'Bleach');
    });
    act(() => {
      result.current.edit.cancelEdit();
    });

    expect(result.current.edit.editingRowId).toBeNull();
    expect(result.current.edit.editingData).toEqual({});
  });

  it('switches cleanly from one row to another', () => {
    const {result} = renderInlineEdit();

    act(() => {
      result.current.edit.startEdit(result.current.rows[0]);
    });
    act(() => {
      result.current.edit.updateField('name', 'Bleach');
    });
    act(() => {
      result.current.edit.startEdit(result.current.rows[1]);
    });

    expect(result.current.edit.editingRowId).toBe('item-2');
    expect(result.current.edit.editingData).toEqual(data[1]);
  });
});

// ===========================================================================
// REGRESSION — hooks/useInlineEdit.ts:51 and :88
//
// Both `cancelEdit` and `clearError` dismiss the error by calling
// `saveMutation.reset()`. But `useAppMutation` does not surface the raw mutation
// error — it exposes its OWN `errorMessage` state (see src/lib/react-query/hooks.ts)
// and clears that only in `onSuccess` or via the `clearError` it returns.
// `reset()` never touches it.
//
// So once a save fails, `error` stays populated: the message survives cancelling the
// edit, survives starting an edit on a different row, and cannot be dismissed at all
// through the API this hook exposes.
//
// Failed when written; passes now that both also call `saveMutation.clearError()`.
// ===========================================================================
describe('Regression — the save error must be dismissable', () => {
  beforeEach(() => {
    onSave.mockRejectedValue(new Error('Conflict'));
  });

  async function failASave() {
    const view = renderInlineEdit();
    act(() => {
      view.result.current.edit.startEdit(view.result.current.rows[0]);
    });
    act(() => {
      view.result.current.edit.updateField('name', 'Bleach');
    });
    await act(async () => {
      await view.result.current.edit.saveEdit().catch(() => undefined);
    });
    await waitFor(() => {
      expect(view.result.current.edit.error).toBe('Conflict');
    });
    return view;
  }

  it('clears the error when clearError is called', async () => {
    const {result} = await failASave();

    act(() => {
      result.current.edit.clearError();
    });

    expect(result.current.edit.error).toBeNull();
  });

  it('clears the error when the edit is cancelled', async () => {
    const {result} = await failASave();

    act(() => {
      result.current.edit.cancelEdit();
    });

    expect(result.current.edit.error).toBeNull();
  });
});
