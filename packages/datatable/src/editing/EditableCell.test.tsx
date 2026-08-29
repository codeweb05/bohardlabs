/**
 * Coverage for `EditableCell`, previously 0%.
 *
 * This is the component that turns an `editConfig` into an actual input: it picks the
 * field by `type`, seeds it from the in-flight draft (NOT the row's original value),
 * and runs `validate` on every render so the error follows what the user typed.
 *
 * The block at the bottom covers the wiring: the table used to re-implement the edit
 * path itself and never render this component. Kept as a regression test.
 */
import type {Cell, Row} from '@tanstack/react-table';
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {DataTable} from '../DataTable';
import type {TableEditingContextValue} from '../DataTableContext.hooks';
import {TableEditingContext, useTableEditing} from '../DataTableContext.hooks';
import {render} from '../test/test-utils';
import type {DataTableColumnDef, RowData} from '../types';
import {EditableCell} from './EditableCell';

interface Item extends RowData {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly status: string;
}

const data: Item[] = [{id: 'row-1', name: 'Detergent', quantity: 2, status: 'ACTIVE'}];

const updateEditField = vi.fn();
const saveEdit = vi.fn<() => Promise<void>>();
const cancelEdit = vi.fn();

/** The draft differs from the row so tests can prove which one the input reads. */
const draft: Partial<Item> = {id: 'row-1', name: 'Bleach', quantity: 9, status: 'PENDING'};

function editingContext(overrides: Partial<TableEditingContextValue<Item>> = {}): TableEditingContextValue<Item> {
  return {
    editingRowId: 'row-1',
    editingData: draft,
    isEditing: (rowId: string) => rowId === 'row-1',
    startEdit: vi.fn(),
    cancelEdit,
    saveEdit,
    updateEditField,
    isSaving: false,
    editError: null,
    ...overrides,
  };
}

/** Builds a real table so the cell/row/column handed to EditableCell are genuine. */
function Harness({
  columns,
  columnId,
}: Readonly<{columns: DataTableColumnDef<Item>[]; columnId: string}>): React.ReactElement {
  const table = useReactTable({data, columns, getCoreRowModel: getCoreRowModel(), getRowId: (row) => row.id});
  const row: Row<Item> = table.getRowModel().rows[0];
  const cell: Cell<Item, unknown> | undefined = row.getAllCells().find((c) => c.column.id === columnId);
  if (!cell) throw new Error(`No cell for column ${columnId}`);
  return <EditableCell cell={cell} row={row} column={cell.column} table={table} />;
}

function renderCell(
  columns: DataTableColumnDef<Item>[],
  columnId: string,
  overrides: Partial<TableEditingContextValue<Item>> = {},
) {
  return render(
    <TableEditingContext.Provider value={editingContext(overrides) as TableEditingContextValue<RowData>}>
      <Harness columns={columns} columnId={columnId} />
    </TableEditingContext.Provider>,
  );
}

const textColumn: DataTableColumnDef<Item> = {
  id: 'name',
  accessorKey: 'name',
  header: 'Name',
  enableEditing: true,
  editConfig: {type: 'text'},
};

beforeEach(() => {
  updateEditField.mockReset();
  saveEdit.mockReset().mockResolvedValue(undefined);
  cancelEdit.mockReset();
});

describe('EditableCell — when it should not edit', () => {
  it('renders the plain cell for a row that is not being edited', () => {
    renderCell([textColumn], 'name', {isEditing: () => false});

    expect(screen.getByText('Detergent')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('renders the plain cell for a column without enableEditing', () => {
    renderCell([{...textColumn, enableEditing: false}], 'name');

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('renders the plain cell for a column with no editConfig', () => {
    const withoutConfig: DataTableColumnDef<Item> = {
      id: 'name',
      accessorKey: 'name',
      header: 'Name',
      enableEditing: true,
    };
    renderCell([withoutConfig], 'name');

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('EditableCell — field selection', () => {
  it('renders a text field for type text', () => {
    renderCell([textColumn], 'name');

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders a number field for type number', () => {
    renderCell(
      [{id: 'quantity', accessorKey: 'quantity', header: 'Qty', enableEditing: true, editConfig: {type: 'number'}}],
      'quantity',
    );

    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('renders a select for type select', () => {
    renderCell(
      [
        {
          id: 'status',
          accessorKey: 'status',
          header: 'Status',
          enableEditing: true,
          editConfig: {
            type: 'select',
            options: [
              {value: 'ACTIVE', label: 'Active'},
              {value: 'PENDING', label: 'Pending'},
            ],
          },
        },
      ],
      'status',
    );

    expect(screen.getByRole('combobox')).toHaveTextContent('Pending');
  });

  it('falls back to a text field for an unhandled type', () => {
    // `EditFieldType` has more members than the switch handles; anything unknown must
    // still give the user something to type in rather than an empty cell.
    renderCell([{...textColumn, editConfig: {type: 'date'}}], 'name');

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});

describe('EditableCell — value flow', () => {
  it('seeds the input from the draft, not the row', () => {
    // Re-reading the row would throw away every keystroke on the next re-render.
    renderCell([textColumn], 'name');

    expect(screen.getByRole('textbox')).toHaveValue('Bleach');
  });

  it('writes changes back to the draft under the accessor key', async () => {
    renderCell([textColumn], 'name');

    await userEvent.type(screen.getByRole('textbox'), 'X');

    expect(updateEditField).toHaveBeenCalledExactlyOnceWith('name', 'BleachX');
  });

  it('falls back to the cell value when the column has no accessorKey', () => {
    // A computed column has nowhere to write, so it must at least display something.
    renderCell(
      [{id: 'name', accessorFn: (row) => row.name, header: 'Name', enableEditing: true, editConfig: {type: 'text'}}],
      'name',
    );

    expect(screen.getByRole('textbox')).toHaveValue('Detergent');
  });
});

describe('EditableCell — disabled and validation', () => {
  it('disables the field for a boolean disabled config', () => {
    renderCell([{...textColumn, editConfig: {type: 'text', disabled: true}}], 'name');

    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('disables the field per row for a predicate disabled config', () => {
    renderCell([{...textColumn, editConfig: {type: 'text', disabled: (row) => row.status === 'ACTIVE'}}], 'name');

    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('leaves the field enabled when the predicate says no', () => {
    renderCell([{...textColumn, editConfig: {type: 'text', disabled: (row) => row.status === 'CLOSED'}}], 'name');

    expect(screen.getByRole('textbox')).toBeEnabled();
  });

  it('validates the draft value, not the stored one', () => {
    // Validation has to react to what is currently typed, otherwise the error only
    // ever reflects the value the user started from.
    const validate = vi.fn(() => 'Too long');
    renderCell([{...textColumn, editConfig: {type: 'text', validate}}], 'name');

    expect(validate).toHaveBeenCalledWith('Bleach', data[0]);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('EditableCell — custom renderer', () => {
  it('hands the renderer the draft value, a working onChange, and save/cancel', async () => {
    renderCell(
      [
        {
          ...textColumn,
          editConfig: {
            type: 'text',
            validate: () => 'Nope',
            renderEdit: ({value, onChange, onSave, onCancel, error}) => (
              <div>
                <span data-testid="value">{String(value)}</span>
                <span data-testid="error">{error}</span>
                <button type="button" onClick={() => onChange('typed')}>
                  change
                </button>
                <button type="button" onClick={onSave}>
                  save
                </button>
                <button type="button" onClick={onCancel}>
                  cancel
                </button>
              </div>
            ),
          },
        },
      ],
      'name',
    );

    expect(screen.getByTestId('value')).toHaveTextContent('Bleach');
    expect(screen.getByTestId('error')).toHaveTextContent('Nope');

    await userEvent.click(screen.getByRole('button', {name: 'change'}));
    expect(updateEditField).toHaveBeenCalledExactlyOnceWith('name', 'typed');

    await userEvent.click(screen.getByRole('button', {name: 'save'}));
    expect(saveEdit).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole('button', {name: 'cancel'}));
    expect(cancelEdit).toHaveBeenCalledOnce();
  });

  it('prefers the custom renderer over the built-in field', () => {
    renderCell([{...textColumn, editConfig: {type: 'text', renderEdit: () => <span>custom</span>}}], 'name');

    expect(screen.getByText('custom')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// React Compiler memoizes these components, so a re-render with unchanged props takes
// the cache-hit path instead of rebuilding the element tree. Nothing else in this file
// reaches that path — every other test mounts once — and it is where a compiler bug or
// a prop mutated in place would surface, as a control that keeps painting state the
// table has already moved on from.
// ===========================================================================
describe('EditableCell — re-rendering', () => {
  it('keeps the same field when re-rendered with unchanged props', () => {
    const context = editingContext() as TableEditingContextValue<RowData>;
    const {rerender} = render(
      <TableEditingContext.Provider value={context}>
        <Harness columns={[textColumn]} columnId="name" />
      </TableEditingContext.Provider>,
    );

    rerender(
      <TableEditingContext.Provider value={context}>
        <Harness columns={[textColumn]} columnId="name" />
      </TableEditingContext.Provider>,
    );

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});

// ===========================================================================
// REGRESSION — core/TableCell.tsx:99 (EditableCell was never rendered)
//
//   const content =
//     isRowEditing && columnDef.enableEditing && columnDef.editConfig?.renderEdit
//       ? columnDef.editConfig.renderEdit({…})
//       : flexRender(cell.column.columnDef.cell, cell.getContext());
//
// `TableCell` re-implements the edit path itself and only handles `renderEdit`. The
// component above — the one that implements `type: 'text' | 'number' | 'select'`,
// `editConfig.disabled` and `editConfig.validate` — is exported from the barrel but
// rendered nowhere in the table. So a column that declares the documented, fully
// typed `editConfig: {type: 'text'}` and no `renderEdit` stays read-only text while
// its row is in edit mode: the user sees the row highlight, sees the save/cancel
// buttons, and has nothing to type in.
//
// `TableCell` also hands `renderEdit` `onSave: () => {}` and `onCancel: () => {}`, so
// a custom editor's own save/cancel controls are inert there as well, even though the
// real handlers sit in the same context it already consumes.
//
// Failed when written; passes now that TableCell delegates to EditableCell.
// ===========================================================================
describe('Regression — the table must render the built-in edit fields', () => {
  function StartEditButton({row}: Readonly<{row: Row<Item>}>) {
    const {startEdit} = useTableEditing<Item>();
    return (
      <button type="button" onClick={() => startEdit(row)}>
        edit
      </button>
    );
  }

  const columns: DataTableColumnDef<Item>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Name',
      enableEditing: true,
      editConfig: {type: 'text'},
    },
    {
      id: 'edit',
      header: '',
      cell: ({row}) => <StartEditButton row={row} />,
    },
  ];

  it('shows a text input for an editConfig column once the row is in edit mode', async () => {
    render(<DataTable columns={columns} data={data} onRowEdit={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', {name: 'edit'}));

    // getByDisplayValue rather than getByRole — the toolbar's search box is also a
    // textbox, and it is not the one under test.
    expect(screen.getByDisplayValue('Detergent')).toBeInTheDocument();
  });
});
