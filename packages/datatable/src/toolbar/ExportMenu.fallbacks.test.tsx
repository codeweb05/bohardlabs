/**
 * One issue found while sweeping the toolbar for coverage. It lives in its own file
 * because `ExportMenu.test.tsx` builds its table out of `as any` literals, and this
 * assertion needs a real table instance.
 *
 * The whole file is a KNOWN ISSUE and is EXPECTED TO FAIL.
 */
import type {ColumnDef} from '@tanstack/react-table';
import {getCoreRowModel, getFilteredRowModel, useReactTable} from '@tanstack/react-table';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';

import {DEFAULT_LABELS, DataTableLabelsProvider} from '../i18n';
import {render, screen} from '../test/test-utils';
import {ExportMenu} from './ExportMenu';

interface Item {
  readonly id: string;
  readonly name: string;
  readonly [key: string]: unknown;
}

const data: Item[] = [{id: 'row-1', name: 'Detergent'}];
const columns: ColumnDef<Item>[] = [{id: 'name', accessorKey: 'name', header: 'Name'}];

function Harness() {
  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  return <ExportMenu table={table} formats={['csv', 'xlsx', 'json']} />;
}

// ===========================================================================
// KNOWN ISSUE — toolbar/ExportMenu.tsx:78-82, :88 and :92
//
//   return t('dataTable.exportCsv') ?? 'Export CSV';
//   aria-label={t('dataTable.export') ?? 'Export'}
//
// `t()` never returns null or undefined — i18next returns the KEY when a translation is
// missing — so every `??` fallback in this component is dead code. Dropping the
// `dataTable.export*` keys does not produce "Export CSV"; it produces a menu of raw
// key strings and a trigger announced as "dataTable.export".
//
// Same defect as the one already fixed in `EditActions` (`t(key, {defaultValue: …})` is
// what actually falls back) and as the one still open in `DensityToggle`. These three
// were the only copies of the pattern in the DataTable.
//
// EXPECTED TO FAIL until the fallbacks use `defaultValue`.
// ===========================================================================

describe('the export labels come from `labels`', () => {
  it('names the trigger from the override', () => {
    render(
      <DataTableLabelsProvider labels={{exportLabel: 'Exporter'}}>
        <Harness />
      </DataTableLabelsProvider>,
    );

    expect(screen.getByRole('button', {name: 'Exporter'})).toBeInTheDocument();
  });

  it('names each format from the override', async () => {
    render(
      <DataTableLabelsProvider labels={{exportCsv: 'CSV', exportExcel: 'Excel', exportJson: 'JSON'}}>
        <Harness />
      </DataTableLabelsProvider>,
    );

    await userEvent.click(screen.getByLabelText(/export/i));

    expect(screen.getByRole('menuitem', {name: 'CSV'})).toBeInTheDocument();
    expect(screen.getByRole('menuitem', {name: 'Excel'})).toBeInTheDocument();
    expect(screen.getByRole('menuitem', {name: 'JSON'})).toBeInTheDocument();
  });

  it('falls back to English for the keys the consumer did not override', () => {
    render(<Harness />);

    expect(screen.getByRole('button', {name: DEFAULT_LABELS.exportLabel})).toBeInTheDocument();
  });
});
