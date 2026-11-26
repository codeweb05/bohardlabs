import type {ColumnSizingState} from '@tanstack/react-table';

/**
 * The DOM measurement pass over a rendered table. The pinned-column offsets and "Fit columns
 * to content" both read the header row the same way, so the selector lives here once.
 */

/** The leaf header cells, left to right, each tagged with its column id. */
export function headerCells(tableEl: HTMLElement): HTMLTableCellElement[] {
  return Array.from(tableEl.querySelectorAll<HTMLTableCellElement>('thead tr:first-of-type > th[data-column-id]'));
}

/**
 * The width each rendered column needs to show its widest content unclipped, header
 * included, in pixels, keyed by column id.
 *
 * Each cell's content box is switched to `max-content` for the read, so a column narrower
 * than its text and one wider than it both report the text's own width. The cell's padding
 * and anything beside the content box (a sort arrow, a menu button) are added back on top.
 * All writes happen before all reads, so the pass costs one layout rather than one per cell.
 */
export function measureContentWidths(tableEl: HTMLElement): Map<string, number> {
  const cells = [
    ...headerCells(tableEl).map((cell) => ({cell, content: cell.querySelector<HTMLElement>('.header-content')})),
    ...Array.from(tableEl.querySelectorAll<HTMLTableCellElement>('tbody td[data-column-id]'), (cell) => ({
      cell,
      content: cell.querySelector<HTMLElement>('.cell-content'),
    })),
  ];

  const measurable = cells.flatMap(({cell, content}) =>
    content ? [{id: String(cell.dataset.columnId), content, chrome: cell.offsetWidth - content.offsetWidth}] : [],
  );

  for (const {content} of measurable) content.style.width = 'max-content';
  const widths = new Map<string, number>();
  for (const {id, content, chrome} of measurable) {
    widths.set(id, Math.max(widths.get(id) ?? 0, Math.ceil(content.offsetWidth + chrome)));
  }
  for (const {content} of measurable) content.style.removeProperty('width');

  return widths;
}

/** The part of a TanStack column that fitting reads. */
export interface FittableColumn {
  readonly id: string;
  readonly getCanResize: () => boolean;
  readonly columnDef: {readonly minSize?: number; readonly maxSize?: number};
}

/**
 * Turns measured widths into column sizing for the resizable columns, each clamped to its
 * own `minSize` and `maxSize`. A column with no rendered cell keeps the width it has.
 */
export function fitColumnSizing(
  columns: readonly FittableColumn[],
  widths: ReadonlyMap<string, number>,
): ColumnSizingState {
  const sizing: ColumnSizingState = {};
  for (const column of columns) {
    const width = widths.get(column.id);
    if (width === undefined || !column.getCanResize()) continue;
    const {minSize = 0, maxSize = Number.POSITIVE_INFINITY} = column.columnDef;
    sizing[column.id] = Math.min(Math.max(width, minSize), maxSize);
  }
  return sizing;
}
