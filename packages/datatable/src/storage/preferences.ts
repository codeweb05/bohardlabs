import type {ColumnOrderState, ColumnPinningState, VisibilityState} from '@tanstack/react-table';

import type {PersistedTableState} from '../types';

/**
 * The shape version written into every entry. An entry without it was written by an earlier
 * build, which stored the whole resolved column layout, defaults included. Such an entry is
 * read as preferences and written back once in this shape.
 */
export const PERSISTED_STATE_VERSION = 2;

/** The column layout the column defs and the `initial*` props declare, or the user changed. */
export interface ColumnLayout {
  readonly columnOrder: ColumnOrderState;
  readonly columnPinning: ColumnPinningState;
  readonly columnVisibility: VisibilityState;
}

function pinnedIds(pinning: ColumnPinningState): string {
  return JSON.stringify([pinning.left ?? [], pinning.right ?? []]);
}

/**
 * What the user chose, and nothing the defaults already say. A column whose visibility
 * matches its default is left out, and so are an order or a pinning equal to the default
 * one, so a default changed in a later release still reaches the users who never touched
 * it. `undefined` rather than a missing key: a write is merged over the stored entry on
 * unmount, and only an own `undefined` clears what was there.
 */
export function toColumnPreferences(layout: ColumnLayout, defaults: ColumnLayout): Partial<ColumnLayout> {
  return {
    columnVisibility: Object.fromEntries(
      Object.entries(layout.columnVisibility).filter(
        ([id, visible]) => visible !== (defaults.columnVisibility[id] ?? true),
      ),
    ),
    columnOrder:
      JSON.stringify(layout.columnOrder) === JSON.stringify(defaults.columnOrder) ? undefined : layout.columnOrder,
    columnPinning:
      pinnedIds(layout.columnPinning) === pinnedIds(defaults.columnPinning) ? undefined : layout.columnPinning,
  };
}

/**
 * The stored entry without the columns the table no longer has, so a renamed or removed
 * column falls back to its default instead of leaving a blank or a stray width behind.
 */
export function dropStaleColumns(state: PersistedTableState, columnIds: readonly string[]): PersistedTableState {
  const known = new Set(columnIds);
  const isKnown = (id: string) => known.has(id);
  const pick = <TValue>(map: Record<string, TValue> | undefined) =>
    map && Object.fromEntries(Object.entries(map).filter(([id]) => isKnown(id)));
  const {columnOrder, columnPinning, columnSizing, columnVisibility} = state;

  return {
    ...state,
    columnSizing: pick(columnSizing),
    columnVisibility: pick(columnVisibility),
    columnOrder: columnOrder?.filter(isKnown),
    columnPinning: columnPinning && {
      ...columnPinning,
      ...(columnPinning.left && {left: columnPinning.left.filter(isKnown)}),
      ...(columnPinning.right && {right: columnPinning.right.filter(isKnown)}),
    },
  };
}
