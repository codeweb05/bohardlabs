import type {DataTableColumnDef, RowData} from './types';

/**
 * A non-data column (expand, select, actions): fixed width, no sort/filter/resize/hide.
 * The cell content is painted by TableRow/CardItem from the column id, not from `cell`.
 */
export function chromeColumn<TData extends RowData>(
  id: string,
  size: number,
  header: DataTableColumnDef<TData>['header'] = () => null,
): DataTableColumnDef<TData> {
  return {
    id,
    header,
    cell: () => null,
    enableSorting: false,
    enableFiltering: false,
    enableResizing: false,
    enableHiding: false,
    size,
    minSize: size,
    maxSize: size,
  } as DataTableColumnDef<TData>;
}
