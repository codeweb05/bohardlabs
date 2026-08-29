import {Box} from '@mui/material';
import type {Cell, Column, Row, Table} from '@tanstack/react-table';
import {flexRender} from '@tanstack/react-table';

import {useTableEditingContext} from '../DataTableContext.hooks';
import type {DataTableColumnDef, RowData} from '../types';
import {EditSelectField} from './EditSelectField';
import {EditTextField} from './EditTextField';

interface EditableCellProps<TData extends RowData, TValue = unknown> {
  readonly cell: Cell<TData, TValue>;
  readonly row: Row<TData>;
  readonly column: Column<TData, TValue>;
  readonly table: Table<TData>;
}

export function EditableCell<TData extends RowData, TValue = unknown>({
  cell,
  row,
  column,
}: Readonly<EditableCellProps<TData, TValue>>) {
  const {isEditing, editingData, updateEditField, saveEdit, cancelEdit} = useTableEditingContext<TData>();

  const columnDef = column.columnDef as DataTableColumnDef<TData, TValue>;
  const isRowEditing = isEditing(String(row.original.id));
  const canEdit = columnDef.enableEditing && columnDef.editConfig;

  // If not in edit mode or column not editable, render normal cell
  if (!isRowEditing || !canEdit) {
    return <>{flexRender(cell.column.columnDef.cell, cell.getContext())}</>;
  }

  const editConfig = columnDef.editConfig;
  const fieldKey = columnDef.accessorKey;
  const value = fieldKey ? editingData[fieldKey] : cell.getValue();

  // Check if editing is disabled for this row
  const isDisabled =
    typeof editConfig.disabled === 'function' ? editConfig.disabled(row.original) : (editConfig.disabled ?? false);

  // Handle value change
  const handleChange = (newValue: unknown) => {
    if (fieldKey) {
      updateEditField(fieldKey, newValue);
    }
  };

  // Validate value
  const validationError = editConfig.validate?.(value, row.original);

  // Custom edit renderer
  if (editConfig.renderEdit) {
    return (
      <Box sx={{width: '100%'}}>
        {editConfig.renderEdit({
          row,
          column,
          value,
          onChange: handleChange,
          onSave: saveEdit,
          onCancel: cancelEdit,
          error: validationError,
        })}
      </Box>
    );
  }

  // Built-in edit renderers
  switch (editConfig.type) {
    case 'select':
      return (
        <EditSelectField
          value={value as string | number}
          onChange={handleChange}
          options={editConfig.options ?? []}
          disabled={isDisabled}
          error={validationError}
        />
      );

    case 'number':
      return (
        <EditTextField
          value={value as string | number}
          onChange={handleChange}
          type="number"
          disabled={isDisabled}
          error={validationError}
        />
      );

    case 'text':
    default:
      return (
        <EditTextField
          value={value as string}
          onChange={handleChange}
          type="text"
          disabled={isDisabled}
          error={validationError}
        />
      );
  }
}
