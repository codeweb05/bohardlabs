/**
 * Coverage for `DataTableProvider` and the granular context hooks, previously ~40%.
 *
 * The provider carries a second, independent inline-editing implementation (the other
 * being `useInlineEdit`), and nothing tested it. That matters for a package: a
 * consumer who passes `onRowEdit` to `<DataTable>` gets THIS one, not the hook.
 *
 * The block at the bottom is a KNOWN ISSUE and is EXPECTED TO FAIL.
 */
import type {ColumnDef} from '@tanstack/react-table';
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {act, renderHook, waitFor} from '@testing-library/react';
import type {ReactNode} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {DataTableProvider} from './DataTableContext';
import {
  useDataTable,
  useDataTableContext,
  useTableCore,
  useTableDensity,
  useTableEditing,
  useTableEditingContext,
  useTableMobile,
  useTableUI,
} from './DataTableContext.hooks';
import {DataTableLabelsProvider} from './i18n';
import type {DataTableLabels} from './i18n';
import type {TableDensity} from './types';

interface Item {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly [key: string]: unknown;
}

const data: Item[] = [
  {id: 'row-1', name: 'Detergent', quantity: 2},
  {id: 'row-2', name: 'Softener', quantity: 5},
];

const columns: ColumnDef<Item>[] = [
  {id: 'name', accessorKey: 'name'},
  {id: 'quantity', accessorKey: 'quantity'},
];

const onRowEdit = vi.fn<(rowId: string, patch: Partial<Item>) => Promise<void>>();
const setDensity = vi.fn<(density: TableDensity) => void>();

interface ProviderOptions {
  readonly withRowEdit?: boolean;
  readonly isMobile?: boolean;
  readonly density?: TableDensity;
  readonly labels?: Partial<DataTableLabels>;
}

/**
 * Renders a hook under a provider fed by a real table instance, and returns the rows
 * alongside so tests can hand `startEdit` a genuine `Row` object.
 */
function renderUnderProvider<TResult>(useHook: () => TResult, options: ProviderOptions = {}) {
  function Wrapper({children}: Readonly<{children: ReactNode}>) {
    const table = useReactTable({data, columns, getCoreRowModel: getCoreRowModel(), getRowId: (row) => row.id});
    return (
      <DataTableLabelsProvider labels={options.labels}>
        <DataTableProvider<Item>
          table={table}
          density={options.density ?? 'comfortable'}
          setDensity={setDensity}
          isMobile={options.isMobile ?? false}
          onRowEdit={options.withRowEdit === false ? undefined : onRowEdit}
          rowSelection={{'row-1': true}}
          pagination={{pageIndex: 1, pageSize: 25}}
          columnVisibility={{quantity: false}}
          sorting={[{id: 'name', desc: true}]}
          dataVersion={7}
        >
          {children}
        </DataTableProvider>
      </DataTableLabelsProvider>
    );
  }

  return renderHook(() => ({result: useHook(), table: useDataTable<Item>()}), {wrapper: Wrapper});
}

/** The editing slice plus the rows it needs as input. */
function renderEditing(options: ProviderOptions = {}) {
  const view = renderUnderProvider(() => useTableEditingContext<Item>(), options);
  return {
    view,
    edit: () => view.result.current.result,
    rows: () => view.result.current.table.getRowModel().rows,
  };
}

beforeEach(() => {
  onRowEdit.mockReset().mockResolvedValue(undefined);
  setDensity.mockReset();
});

describe('DataTableContext — hooks outside a provider', () => {
  it.each([
    ['useTableCore', useTableCore],
    ['useTableUI', useTableUI],
    ['useTableEditingContext', useTableEditingContext],
  ])('%s names the provider it needs', (_name, useHook) => {
    // The message is the whole diagnostic here: a bare "cannot read property of
    // undefined" from deep inside a cell tells a consumer nothing.
    expect(() => renderHook(() => useHook())).toThrow(/DataTableProvider/);
  });
});

describe('DataTableContext — reading state', () => {
  it('exposes the table, the mobile flag and the data version', () => {
    const {result} = renderUnderProvider(() => useTableCore<Item>(), {isMobile: true});

    expect(result.current.result.table.getRowModel().rows).toHaveLength(2);
    expect(result.current.result.isMobile).toBe(true);
    expect(result.current.result.dataVersion).toBe(7);
  });

  it('exposes every UI slice the toolbar and cells read', () => {
    const {result} = renderUnderProvider(() => useTableUI(), {density: 'compact'});

    expect(result.current.result).toMatchObject({
      density: 'compact',
      rowSelection: {'row-1': true},
      pagination: {pageIndex: 1, pageSize: 25},
      columnVisibility: {quantity: false},
      sorting: [{id: 'name', desc: true}],
    });
  });

  it('merges all three contexts for the backward-compatible hook', () => {
    const {result} = renderUnderProvider(() => useDataTableContext<Item>());

    expect(result.current.result.isMobile).toBe(false);
    expect(result.current.result.density).toBe('comfortable');
    expect(result.current.result.editingRowId).toBeNull();
  });

  it('narrows to the table instance', () => {
    const {result} = renderUnderProvider(() => useDataTable<Item>());

    expect(result.current.result.getRowModel().rows).toHaveLength(2);
  });

  it('narrows to the density pair and forwards a change to the owner', () => {
    // Density lives outside the DataTable (it is persisted per table), so the setter
    // has to reach the caller rather than mutate context state.
    const {result} = renderUnderProvider(() => useTableDensity());

    expect(result.current.result.density).toBe('comfortable');

    act(() => {
      result.current.result.setDensity('spacious');
    });

    expect(setDensity).toHaveBeenCalledExactlyOnceWith('spacious');
  });

  it('narrows to the mobile flag', () => {
    const {result} = renderUnderProvider(() => useTableMobile(), {isMobile: true});

    expect(result.current.result).toBe(true);
  });

  it('narrows to the editing slice', () => {
    const {result} = renderUnderProvider(() => useTableEditing<Item>());

    expect(result.current.result.editingRowId).toBeNull();
  });
});

describe('DataTableProvider — inline editing', () => {
  it('starts with no row in edit mode', () => {
    const {edit} = renderEditing();

    expect(edit().editingRowId).toBeNull();
    expect(edit().editingData).toEqual({});
    expect(edit().isSaving).toBe(false);
    expect(edit().editError).toBeNull();
    expect(edit().isEditing('row-1')).toBe(false);
  });

  it('seeds the draft from the row and reports only that row as editing', () => {
    const {edit, rows} = renderEditing();

    act(() => {
      edit().startEdit(rows()[0]);
    });

    expect(edit().editingRowId).toBe('row-1');
    expect(edit().editingData).toEqual(data[0]);
    expect(edit().isEditing('row-1')).toBe(true);
    expect(edit().isEditing('row-2')).toBe(false);
  });

  it('merges a field update into the draft', () => {
    const {edit, rows} = renderEditing();

    act(() => {
      edit().startEdit(rows()[0]);
    });
    act(() => {
      edit().updateEditField('name', 'Bleach');
    });

    expect(edit().editingData).toEqual({...data[0], name: 'Bleach'});
  });

  it('sends only the changed fields and leaves edit mode', async () => {
    // A PATCH carrying every field would overwrite columns the user never touched.
    const {edit, rows} = renderEditing();

    act(() => {
      edit().startEdit(rows()[0]);
    });
    act(() => {
      edit().updateEditField('quantity', 9);
    });
    await act(async () => {
      await edit().saveEdit();
    });

    expect(onRowEdit).toHaveBeenCalledExactlyOnceWith('row-1', {quantity: 9});
    expect(edit().editingRowId).toBeNull();
  });

  it('does not call the server when nothing changed', async () => {
    const {edit, rows} = renderEditing();

    act(() => {
      edit().startEdit(rows()[0]);
    });
    await act(async () => {
      await edit().saveEdit();
    });

    expect(onRowEdit).not.toHaveBeenCalled();
    expect(edit().editingRowId).toBeNull();
  });

  it('does nothing when saving with no row in edit mode', async () => {
    const {edit} = renderEditing();

    await act(async () => {
      await edit().saveEdit();
    });

    expect(onRowEdit).not.toHaveBeenCalled();
  });

  it('keeps the draft and reports the error when the save fails', async () => {
    // Dropping the row out of edit mode on failure would lose what the user typed.
    onRowEdit.mockRejectedValue(new Error('Conflict'));
    const {edit, rows} = renderEditing();

    act(() => {
      edit().startEdit(rows()[0]);
    });
    act(() => {
      edit().updateEditField('name', 'Bleach');
    });
    await act(async () => {
      await edit().saveEdit();
    });

    await waitFor(() => {
      expect(edit().editError).toBe('Conflict');
    });
    expect(edit().editingRowId).toBe('row-1');
    expect(edit().editingData).toMatchObject({name: 'Bleach'});
    expect(edit().isSaving).toBe(false);
  });

  it('clears a previous error when a new edit starts', () => {
    const {edit, rows} = renderEditing();

    act(() => {
      edit().startEdit(rows()[0]);
    });
    act(() => {
      edit().updateEditField('name', 'Bleach');
    });
    act(() => {
      edit().cancelEdit();
    });

    expect(edit().editingRowId).toBeNull();
    expect(edit().editingData).toEqual({});
    expect(edit().editError).toBeNull();
  });

  it('switches cleanly from one row to another', () => {
    const {edit, rows} = renderEditing();

    act(() => {
      edit().startEdit(rows()[0]);
    });
    act(() => {
      edit().updateEditField('name', 'Bleach');
    });
    act(() => {
      edit().startEdit(rows()[1]);
    });

    expect(edit().editingRowId).toBe('row-2');
    expect(edit().editingData).toEqual(data[1]);
  });
});

// ===========================================================================
// KNOWN ISSUE — DataTableContext.tsx:102
//
//   const message = error instanceof Error ? error.message : 'Failed to save changes';
//   setEditError(message);
//
// The fallback message is a hardcoded English literal, and it is shown to the user:
// `editError` is what the editing row renders when a save fails. Every rejection that
// is not an `Error` instance lands here — an axios rejection carrying a plain object,
// a string thrown by a consumer's `onRowEdit`, an aborted request — so this is the
// message a user sees whenever the failure is anything other than a thrown `Error`.
//
// The provider does not call `useTranslation` at all today, so the fix is to bring `t`
// in and add a key (there is no `dataTable.editing.saveFailed` yet; the `editing`
// group only holds clickToEdit / saveChanges / discardChanges).
//
// The assertion empties the translation bundle, which turns every translated string
// into its own key, and then checks the English literal is gone — so any correct fix
// passes it whichever key name is chosen.
//
// EXPECTED TO FAIL until the message comes from `t()`.
// ===========================================================================

describe('the save-failure message comes from `labels`', () => {
  it('reports the override rather than the English default', async () => {
    // A rejection that is not an Error instance, which is what any non-throw failure
    // path produces.
    onRowEdit.mockRejectedValue({status: 409});
    const {edit, rows} = renderEditing({labels: {saveFailed: 'Echec de l enregistrement'}});

    act(() => {
      edit().startEdit(rows()[0]);
    });
    act(() => {
      edit().updateEditField('name', 'Bleach');
    });
    await act(async () => {
      await edit().saveEdit();
    });

    await waitFor(() => {
      expect(edit().editError).not.toBeNull();
    });
    expect(edit().editError).toBe('Echec de l enregistrement');
  });
});

// ===========================================================================
// Every test above mounts once. React Compiler memoizes both the provider and these
// hooks, so a second render takes the cache-hit path, and `useDataTableContext` has its
// own `useMemo` over the three contexts on top of that (DataTableContext.hooks.ts:93).
// Neither had ever run.
//
// The assertion that matters is the table instance: the core context is meant to hold
// stable references, and a table object that changed identity on every parent render
// would invalidate the memo of every cell in the grid.
// ===========================================================================
describe('DataTableContext — re-rendering', () => {
  it('keeps the table instance stable across a re-render', () => {
    const view = renderUnderProvider(() => useTableCore<Item>());
    const first = view.result.current.result.table;

    view.rerender();

    expect(view.result.current.result.table).toBe(first);
    expect(view.result.current.result.dataVersion).toBe(7);
  });

  it('keeps reporting the same merged state across a re-render', () => {
    const view = renderUnderProvider(() => useDataTableContext<Item>());

    view.rerender();

    expect(view.result.current.result.density).toBe('comfortable');
    expect(view.result.current.result.isMobile).toBe(false);
    expect(view.result.current.result.editingRowId).toBeNull();
  });

  it('keeps reporting the same UI slice across a re-render', () => {
    const view = renderUnderProvider(() => useTableUI(), {density: 'compact'});

    view.rerender();

    expect(view.result.current.result).toMatchObject({
      density: 'compact',
      pagination: {pageIndex: 1, pageSize: 25},
    });
  });
});
