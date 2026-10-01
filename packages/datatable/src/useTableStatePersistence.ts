import {useCallback, useEffect, useRef} from 'react';

import {getTableStateStorageKey} from './storage/storageKey';
import type {PersistedTableState} from './types';
import {DENSITY_CONFIG} from './types';

/** Debounce delay for batching persistence writes (ms) */
const PERSIST_DEBOUNCE_MS = 150;

/**
 * Drop semantically-invalid persisted values (corrupted/hand-edited localStorage)
 * so they don't seed the table with e.g. `pageSize: 0` or a non-array filter.
 * Keeping the seed sane also keeps it identical to `getInitialServerState`, which
 * is what prevents a redundant initial fetch on mount.
 */
function sanitizePersistedState(state: PersistedTableState): PersistedTableState {
  const {pageIndex, pageSize, sorting, columnFilters, globalFilter, ...layout} = state;
  return {
    ...sanitizeLayout(layout),
    ...(typeof pageIndex === 'number' && Number.isInteger(pageIndex) && pageIndex >= 0 ? {pageIndex} : {}),
    ...(typeof pageSize === 'number' && Number.isInteger(pageSize) && pageSize > 0 ? {pageSize} : {}),
    ...(isListOf(sorting, hasId) ? {sorting} : {}),
    ...(isListOf(columnFilters, hasId) ? {columnFilters} : {}),
    ...(typeof globalFilter === 'string' ? {globalFilter} : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function hasId(value: unknown): boolean {
  return isRecord(value) && isString(value.id);
}

function isListOf(value: unknown, isItem: (item: unknown) => boolean): boolean {
  return Array.isArray(value) && value.every(isItem);
}

function isWidth(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPinning(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return [value.left, value.right].every((side) => side === undefined || isListOf(side, isString));
}

/**
 * The layout half of the same check. Each of these is read without a guard further in
 * (a density that is not a key of `DENSITY_CONFIG`, an order that is not an array), so a
 * wrong shape here is a table that throws on mount, for that user, until the entry goes.
 */
function sanitizeLayout(
  layout: Omit<PersistedTableState, 'pageIndex' | 'pageSize' | 'sorting' | 'columnFilters' | 'globalFilter'>,
): PersistedTableState {
  const {density, columnOrder, columnPinning, columnSizing, columnVisibility, grouping} = layout;
  return {
    ...(isString(density) && Object.hasOwn(DENSITY_CONFIG, density) ? {density} : {}),
    ...(isListOf(columnOrder, isString) ? {columnOrder} : {}),
    ...(isPinning(columnPinning) ? {columnPinning} : {}),
    ...(isRecord(columnSizing) && isListOf(Object.values(columnSizing), isWidth) ? {columnSizing} : {}),
    ...(isRecord(columnVisibility) ? {columnVisibility} : {}),
    ...(isListOf(grouping, isString) ? {grouping} : {}),
  };
}

/**
 * Hook for persisting DataTable state to localStorage.
 * Uses debounced batching: multiple field updates within 150ms are merged into a single write.
 */
export function useTableStatePersistence(tableId: string | undefined) {
  const pendingRef = useRef<Partial<PersistedTableState>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Load persisted state from localStorage
   */
  const loadPersistedState = useCallback((): PersistedTableState | null => {
    if (!tableId) return null;

    try {
      const key = getTableStateStorageKey(tableId);
      const stored = localStorage.getItem(key);
      if (stored) {
        return sanitizePersistedState(JSON.parse(stored) as PersistedTableState);
      }
    } catch (error) {
      console.warn(`Failed to load table state for "${tableId}":`, error);
    }
    return null;
  }, [tableId]);

  /**
   * Save state to localStorage
   */
  const savePersistedState = useCallback(
    (state: PersistedTableState) => {
      if (!tableId) return;

      try {
        const key = getTableStateStorageKey(tableId);
        localStorage.setItem(key, JSON.stringify(state));
      } catch (error) {
        console.warn(`Failed to save table state for "${tableId}":`, error);
      }
    },
    [tableId],
  );

  /**
   * Clear persisted state from localStorage
   */
  const clearPersistedState = useCallback(() => {
    if (!tableId) return;

    // Cancel any pending flush
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = {};

    try {
      const key = getTableStateStorageKey(tableId);
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to clear table state for "${tableId}":`, error);
    }
  }, [tableId]);

  /**
   * Flush pending changes to localStorage immediately
   */
  const flush = useCallback(() => {
    if (!tableId) return;
    const pending = pendingRef.current;
    if (Object.keys(pending).length === 0) return;

    const currentState = loadPersistedState() || {};
    savePersistedState({...currentState, ...pending});
    pendingRef.current = {};
  }, [tableId, loadPersistedState, savePersistedState]);

  /**
   * Update a specific field in the persisted state (debounced batch)
   */
  const updatePersistedField = useCallback(
    <TKey extends keyof PersistedTableState>(field: TKey, value: PersistedTableState[TKey]) => {
      if (!tableId) return;

      // Merge into pending
      pendingRef.current = {...pendingRef.current, [field]: value};

      // Reset debounce timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        flush();
        timerRef.current = null;
      }, PERSIST_DEBOUNCE_MS);
    },
    [tableId, flush],
  );

  /**
   * Persist entire state at once (used by single-effect pattern).
   * P2 fix (2.5): Writes directly without read-back since the state is complete.
   */
  const persistWholeState = useCallback(
    (state: PersistedTableState) => {
      if (!tableId) return;

      // Replace pending entirely — whole state already contains all fields
      pendingRef.current = state;

      // Reset debounce timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        // Write directly instead of merging via flush() — avoids unnecessary localStorage read
        savePersistedState(pendingRef.current as PersistedTableState);
        pendingRef.current = {};
        timerRef.current = null;
      }, PERSIST_DEBOUNCE_MS);
    },
    [tableId, savePersistedState],
  );

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      // Flush any remaining pending changes synchronously
      if (tableId && Object.keys(pendingRef.current).length > 0) {
        const currentState = loadPersistedState() || {};
        savePersistedState({...currentState, ...pendingRef.current});
        pendingRef.current = {};
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  return {
    loadPersistedState,
    savePersistedState,
    clearPersistedState,
    updatePersistedField,
    persistWholeState,
    flush,
    isEnabled: !!tableId,
  };
}
