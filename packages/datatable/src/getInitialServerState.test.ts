/**
 * Unit tests for `getInitialServerState`.
 *
 * This helper is the seam between localStorage and the first list query a page
 * fires, so every branch here is a "wrong page size on first paint" bug waiting to
 * happen. It also has to survive hand-edited / corrupted storage without throwing,
 * because a throw at this point takes the whole route down before it renders.
 */
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {getInitialServerState} from './getInitialServerState';
import {getTableStateStorageKey} from './storage/storageKey';
import type {PersistedTableState, ServerTableState} from './types';

const TABLE_ID = 'server-state-table';

const defaults: ServerTableState = {
  pagination: {pageIndex: 0, pageSize: 50},
  sorting: [],
  columnFilters: [],
  globalFilter: '',
};

function seed(state: unknown) {
  localStorage.setItem(getTableStateStorageKey(TABLE_ID), JSON.stringify(state));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getInitialServerState', () => {
  describe('fallbacks', () => {
    it('returns the defaults when no tableId is given', () => {
      expect(getInitialServerState(undefined, defaults)).toEqual(defaults);
    });

    it('returns the defaults when nothing is persisted', () => {
      expect(getInitialServerState(TABLE_ID, defaults)).toEqual(defaults);
    });

    it('returns the defaults when the stored entry is not valid JSON', () => {
      localStorage.setItem(getTableStateStorageKey(TABLE_ID), '{not json');

      expect(getInitialServerState(TABLE_ID, defaults)).toEqual(defaults);
    });

    it('returns the defaults when localStorage itself throws', () => {
      // Safari private mode and storage-blocked browsers throw on read.
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(getInitialServerState(TABLE_ID, defaults)).toEqual(defaults);
    });
  });

  describe('persisted values', () => {
    it('restores every persisted slice', () => {
      const persisted: PersistedTableState = {
        pageIndex: 3,
        pageSize: 25,
        sorting: [{id: 'name', desc: true}],
        columnFilters: [{id: 'status', value: 'ACTIVE'}],
        globalFilter: 'acme',
      };
      seed(persisted);

      expect(getInitialServerState(TABLE_ID, defaults)).toEqual({
        pagination: {pageIndex: 3, pageSize: 25},
        sorting: [{id: 'name', desc: true}],
        columnFilters: [{id: 'status', value: 'ACTIVE'}],
        globalFilter: 'acme',
      });
    });

    it('falls back per-slice, keeping the valid ones', () => {
      seed({pageSize: 25, sorting: 'not-an-array'});

      expect(getInitialServerState(TABLE_ID, defaults)).toEqual({
        pagination: {pageIndex: 0, pageSize: 25},
        sorting: [],
        columnFilters: [],
        globalFilter: '',
      });
    });

    it('keeps an empty string global filter rather than treating it as absent', () => {
      seed({globalFilter: ''});

      expect(getInitialServerState(TABLE_ID, {...defaults, globalFilter: 'fallback'}).globalFilter).toBe('');
    });
  });

  describe('rejects nonsense page values', () => {
    it.each([
      ['a negative page index', {pageIndex: -1}],
      ['a fractional page index', {pageIndex: 1.5}],
      ['a string page index', {pageIndex: '2'}],
      ['a NaN page index', {pageIndex: Number.NaN}],
    ])('ignores %s', (_label, stored) => {
      seed(stored);

      expect(getInitialServerState(TABLE_ID, defaults).pagination.pageIndex).toBe(0);
    });

    it.each([
      ['a zero page size', {pageSize: 0}],
      ['a negative page size', {pageSize: -25}],
      ['a fractional page size', {pageSize: 12.5}],
      ['a string page size', {pageSize: '25'}],
    ])('ignores %s', (_label, stored) => {
      seed(stored);

      expect(getInitialServerState(TABLE_ID, defaults).pagination.pageSize).toBe(50);
    });

    it('accepts page index zero', () => {
      seed({pageIndex: 0, pageSize: 10});

      expect(getInitialServerState(TABLE_ID, {...defaults, pagination: {pageIndex: 4, pageSize: 50}})).toMatchObject({
        pagination: {pageIndex: 0, pageSize: 10},
      });
    });
  });

  describe('rejects nonsense filter values', () => {
    it('ignores a non-array sorting value', () => {
      seed({sorting: {id: 'name'}});

      expect(getInitialServerState(TABLE_ID, defaults).sorting).toEqual([]);
    });

    it('ignores a non-array columnFilters value', () => {
      seed({columnFilters: 'status=ACTIVE'});

      expect(getInitialServerState(TABLE_ID, defaults).columnFilters).toEqual([]);
    });

    it('ignores a non-string globalFilter value', () => {
      seed({globalFilter: 42});

      expect(getInitialServerState(TABLE_ID, defaults).globalFilter).toBe('');
    });

    it('falls back to the provided defaults, not to empty values', () => {
      seed({sorting: null, columnFilters: null, globalFilter: null});

      const seededDefaults: ServerTableState = {
        pagination: {pageIndex: 0, pageSize: 50},
        sorting: [{id: 'createdAt', desc: true}],
        columnFilters: [{id: 'status', value: 'PENDING'}],
        globalFilter: 'seed',
      };

      expect(getInitialServerState(TABLE_ID, seededDefaults)).toEqual(seededDefaults);
    });
  });

  it('reads the key that useTableStatePersistence writes', () => {
    // The seed and the persist path must agree on the storage key or the whole
    // "no redundant first fetch" guarantee silently stops working.
    seed({pageSize: 10});

    expect(localStorage.getItem(getTableStateStorageKey(TABLE_ID))).not.toBeNull();
    expect(getInitialServerState(TABLE_ID, defaults).pagination.pageSize).toBe(10);
  });
});
