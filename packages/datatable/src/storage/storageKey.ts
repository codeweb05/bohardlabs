/**
 * Prefix for the table's persisted state entries.
 *
 * The component always writes under this prefix; it is not configurable through a prop. The
 * `prefix` argument below exists for the read side, so an app migrating from its own keys
 * can find users' saved page size, sorting and filters under the old name and copy them
 * across rather than silently resetting everyone.
 */
export const DEFAULT_STORAGE_PREFIX = 'dataTableState_';

export function getTableStateStorageKey(tableId: string, prefix: string = DEFAULT_STORAGE_PREFIX): string {
  return `${prefix}${tableId}`;
}
