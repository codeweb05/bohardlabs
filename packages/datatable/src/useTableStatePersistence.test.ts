import {act, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {getTableStateStorageKey} from './storage/storageKey';
import type {PersistedTableState} from './types';
import {useTableStatePersistence} from './useTableStatePersistence';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', {value: localStorageMock});

describe('useTableStatePersistence', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  describe('when tableId is undefined', () => {
    it('isEnabled should be false', () => {
      const {result} = renderHook(() => useTableStatePersistence(undefined));
      expect(result.current.isEnabled).toBe(false);
    });

    it('loadPersistedState should return null', () => {
      const {result} = renderHook(() => useTableStatePersistence(undefined));
      expect(result.current.loadPersistedState()).toBeNull();
    });

    it('savePersistedState should not call localStorage', () => {
      const {result} = renderHook(() => useTableStatePersistence(undefined));

      act(() => {
        result.current.savePersistedState({sorting: [{id: 'name', desc: false}]});
      });

      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('clearPersistedState should not call localStorage', () => {
      const {result} = renderHook(() => useTableStatePersistence(undefined));

      act(() => {
        result.current.clearPersistedState();
      });

      expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    });
  });

  describe('when tableId is provided', () => {
    const tableId = 'test-table';
    const storageKey = getTableStateStorageKey(tableId);

    it('isEnabled should be true', () => {
      const {result} = renderHook(() => useTableStatePersistence(tableId));
      expect(result.current.isEnabled).toBe(true);
    });

    describe('loadPersistedState', () => {
      it('should return null when no state is stored', () => {
        const {result} = renderHook(() => useTableStatePersistence(tableId));
        expect(result.current.loadPersistedState()).toBeNull();
      });

      it('should return stored state', () => {
        const storedState: PersistedTableState = {
          sorting: [{id: 'name', desc: true}],
          pageSize: 25,
          density: 'compact',
        };
        localStorageMock.setItem(storageKey, JSON.stringify(storedState));

        const {result} = renderHook(() => useTableStatePersistence(tableId));
        const loadedState = result.current.loadPersistedState();

        expect(loadedState).toEqual(storedState);
      });

      it('should return null and log warning on parse error', () => {
        localStorageMock.setItem(storageKey, 'invalid json');
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const {result} = renderHook(() => useTableStatePersistence(tableId));
        const loadedState = result.current.loadPersistedState();

        expect(loadedState).toBeNull();
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });

    describe('savePersistedState', () => {
      it('should save state to localStorage', () => {
        const {result} = renderHook(() => useTableStatePersistence(tableId));

        const stateToSave: PersistedTableState = {
          sorting: [{id: 'createdAt', desc: true}],
          columnVisibility: {description: false},
          pageSize: 50,
        };

        act(() => {
          result.current.savePersistedState(stateToSave);
        });

        expect(localStorageMock.setItem).toHaveBeenCalledWith(storageKey, JSON.stringify(stateToSave));
      });
    });

    describe('clearPersistedState', () => {
      it('should remove state from localStorage', () => {
        localStorageMock.setItem(storageKey, JSON.stringify({sorting: []}));

        const {result} = renderHook(() => useTableStatePersistence(tableId));

        act(() => {
          result.current.clearPersistedState();
        });

        expect(localStorageMock.removeItem).toHaveBeenCalledWith(storageKey);
      });
    });

    describe('updatePersistedField', () => {
      it('should update a single field in existing state', () => {
        const existingState: PersistedTableState = {
          sorting: [{id: 'name', desc: false}],
          pageSize: 10,
        };
        localStorageMock.setItem(storageKey, JSON.stringify(existingState));
        // Clear mock calls from setup so we can track calls from the hook
        vi.mocked(localStorageMock.setItem).mockClear();

        const {result} = renderHook(() => useTableStatePersistence(tableId));

        act(() => {
          result.current.updatePersistedField('pageSize', 25);
          vi.advanceTimersByTime(150);
        });

        // Get all calls to setItem with our storage key
        const savedCalls = localStorageMock.setItem.mock.calls.filter((call) => call[0] === storageKey);
        expect(savedCalls.length).toBeGreaterThan(0);
        // Get the last call (the one from updatePersistedField)
        const lastCall = savedCalls[savedCalls.length - 1];
        const savedState = JSON.parse(lastCall[1]);
        expect(savedState.pageSize).toBe(25);
        expect(savedState.sorting).toEqual([{id: 'name', desc: false}]);
      });

      it('should create new state if none exists', () => {
        const {result} = renderHook(() => useTableStatePersistence(tableId));

        act(() => {
          result.current.updatePersistedField('density', 'spacious');
          vi.advanceTimersByTime(150);
        });

        const savedCall = localStorageMock.setItem.mock.calls.find((call) => call[0] === storageKey);
        expect(savedCall).toBeDefined();
        const savedState = JSON.parse(savedCall![1]);
        expect(savedState.density).toBe('spacious');
      });

      it('should update sorting field', () => {
        const {result} = renderHook(() => useTableStatePersistence(tableId));

        const newSorting = [{id: 'email', desc: true}];
        act(() => {
          result.current.updatePersistedField('sorting', newSorting);
          vi.advanceTimersByTime(150);
        });

        const savedCall = localStorageMock.setItem.mock.calls.find((call) => call[0] === storageKey);
        const savedState = JSON.parse(savedCall![1]);
        expect(savedState.sorting).toEqual(newSorting);
      });

      it('should update columnFilters field', () => {
        const {result} = renderHook(() => useTableStatePersistence(tableId));

        const newFilters = [{id: 'status', value: 'active'}];
        act(() => {
          result.current.updatePersistedField('columnFilters', newFilters);
          vi.advanceTimersByTime(150);
        });

        const savedCall = localStorageMock.setItem.mock.calls.find((call) => call[0] === storageKey);
        const savedState = JSON.parse(savedCall![1]);
        expect(savedState.columnFilters).toEqual(newFilters);
      });

      it('should update globalFilter field', () => {
        const {result} = renderHook(() => useTableStatePersistence(tableId));

        act(() => {
          result.current.updatePersistedField('globalFilter', 'search term');
          vi.advanceTimersByTime(150);
        });

        const savedCall = localStorageMock.setItem.mock.calls.find((call) => call[0] === storageKey);
        const savedState = JSON.parse(savedCall![1]);
        expect(savedState.globalFilter).toBe('search term');
      });

      it('should update columnVisibility field', () => {
        const {result} = renderHook(() => useTableStatePersistence(tableId));

        const visibility = {name: true, email: false, status: true};
        act(() => {
          result.current.updatePersistedField('columnVisibility', visibility);
          vi.advanceTimersByTime(150);
        });

        const savedCall = localStorageMock.setItem.mock.calls.find((call) => call[0] === storageKey);
        const savedState = JSON.parse(savedCall![1]);
        expect(savedState.columnVisibility).toEqual(visibility);
      });

      it('should update columnOrder field', () => {
        const {result} = renderHook(() => useTableStatePersistence(tableId));

        const order = ['name', 'email', 'status', 'createdAt'];
        act(() => {
          result.current.updatePersistedField('columnOrder', order);
          vi.advanceTimersByTime(150);
        });

        const savedCall = localStorageMock.setItem.mock.calls.find((call) => call[0] === storageKey);
        const savedState = JSON.parse(savedCall![1]);
        expect(savedState.columnOrder).toEqual(order);
      });

      it('should update columnPinning field', () => {
        const {result} = renderHook(() => useTableStatePersistence(tableId));

        const pinning = {left: ['select'], right: ['actions']};
        act(() => {
          result.current.updatePersistedField('columnPinning', pinning);
          vi.advanceTimersByTime(150);
        });

        const savedCall = localStorageMock.setItem.mock.calls.find((call) => call[0] === storageKey);
        const savedState = JSON.parse(savedCall![1]);
        expect(savedState.columnPinning).toEqual(pinning);
      });

      it('should update columnSizing field', () => {
        const {result} = renderHook(() => useTableStatePersistence(tableId));

        const sizing = {name: 200, email: 250};
        act(() => {
          result.current.updatePersistedField('columnSizing', sizing);
          vi.advanceTimersByTime(150);
        });

        const savedCall = localStorageMock.setItem.mock.calls.find((call) => call[0] === storageKey);
        const savedState = JSON.parse(savedCall![1]);
        expect(savedState.columnSizing).toEqual(sizing);
      });

      it('should update grouping field', () => {
        const {result} = renderHook(() => useTableStatePersistence(tableId));

        const grouping = ['status', 'role'];
        act(() => {
          result.current.updatePersistedField('grouping', grouping);
          vi.advanceTimersByTime(150);
        });

        const savedCall = localStorageMock.setItem.mock.calls.find((call) => call[0] === storageKey);
        const savedState = JSON.parse(savedCall![1]);
        expect(savedState.grouping).toEqual(grouping);
      });

      it('should batch multiple field updates into a single write', () => {
        const {result} = renderHook(() => useTableStatePersistence(tableId));

        act(() => {
          result.current.updatePersistedField('density', 'compact');
          result.current.updatePersistedField('pageSize', 50);
          result.current.updatePersistedField('sorting', [{id: 'name', desc: true}]);
        });

        // No write yet — still within debounce window
        const callsBefore = localStorageMock.setItem.mock.calls.filter((call) => call[0] === storageKey);
        expect(callsBefore.length).toBe(0);

        act(() => {
          vi.advanceTimersByTime(150);
        });

        // Single write with all fields merged
        const callsAfter = localStorageMock.setItem.mock.calls.filter((call) => call[0] === storageKey);
        expect(callsAfter.length).toBe(1);
        const savedState = JSON.parse(callsAfter[0][1]);
        expect(savedState.density).toBe('compact');
        expect(savedState.pageSize).toBe(50);
        expect(savedState.sorting).toEqual([{id: 'name', desc: true}]);
      });
    });

    describe('persistWholeState', () => {
      it('should persist all fields in a single debounced write', () => {
        const {result} = renderHook(() => useTableStatePersistence(tableId));

        act(() => {
          result.current.persistWholeState({
            sorting: [{id: 'name', desc: false}],
            density: 'spacious',
            pageSize: 25,
          });
          vi.advanceTimersByTime(150);
        });

        const savedCall = localStorageMock.setItem.mock.calls.find((call) => call[0] === storageKey);
        expect(savedCall).toBeDefined();
        const savedState = JSON.parse(savedCall![1]);
        expect(savedState.sorting).toEqual([{id: 'name', desc: false}]);
        expect(savedState.density).toBe('spacious');
        expect(savedState.pageSize).toBe(25);
      });
    });

    describe('flush', () => {
      it('should immediately write pending changes', () => {
        const {result} = renderHook(() => useTableStatePersistence(tableId));

        act(() => {
          result.current.updatePersistedField('density', 'compact');
        });

        // Not yet written
        expect(localStorageMock.setItem.mock.calls.filter((c) => c[0] === storageKey).length).toBe(0);

        act(() => {
          result.current.flush();
        });

        const calls = localStorageMock.setItem.mock.calls.filter((c) => c[0] === storageKey);
        expect(calls.length).toBe(1);
        expect(JSON.parse(calls[0][1]).density).toBe('compact');
      });
    });
  });

  describe('multiple tables', () => {
    it('should store state separately for different tableIds', () => {
      const tableId1 = 'users-table';
      const tableId2 = 'roles-table';

      const {result: hook1} = renderHook(() => useTableStatePersistence(tableId1));
      const {result: hook2} = renderHook(() => useTableStatePersistence(tableId2));

      act(() => {
        hook1.current.savePersistedState({pageSize: 10, density: 'compact'});
        hook2.current.savePersistedState({pageSize: 25, density: 'spacious'});
      });

      const state1 = hook1.current.loadPersistedState();
      const state2 = hook2.current.loadPersistedState();

      expect(state1?.pageSize).toBe(10);
      expect(state1?.density).toBe('compact');
      expect(state2?.pageSize).toBe(25);
      expect(state2?.density).toBe('spacious');
    });
  });
});

// ===========================================================================
// The two write paths swallow their exceptions (useTableStatePersistence.ts:66 and :89)
// and neither was reached before. `localStorage.setItem` throws for real in two ordinary
// situations: Safari private browsing, where the quota is zero, and any browser whose
// origin quota is full. Persistence is a convenience, so a failure there must never take
// the table down with it, and the warning is the only signal a developer gets.
// ===========================================================================
describe('useTableStatePersistence — when localStorage refuses the write', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warns instead of throwing when saving fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    const {result} = renderHook(() => useTableStatePersistence('quota-table'));

    expect(() => {
      act(() => {
        result.current.savePersistedState({pageSize: 25});
      });
    }).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('quota-table'), expect.any(Error));
  });

  it('warns instead of throwing when clearing fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    localStorageMock.removeItem.mockImplementationOnce(() => {
      throw new Error('SecurityError');
    });
    const {result} = renderHook(() => useTableStatePersistence('locked-table'));

    expect(() => {
      act(() => {
        result.current.clearPersistedState();
      });
    }).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('locked-table'), expect.any(Error));
  });
});

// ===========================================================================
// Persistence is opt-in: no `tableId` means the hook must be inert. Each of the four
// writers guards on it separately (useTableStatePersistence.ts:59, :76, :97, :111 and
// :134), and three of those guards had never been reached, because every test above
// passes an id.
//
// A `<DataTable>` without `tableId` is the common case for a nested sub-list, and it
// shares the origin's localStorage with every other table on the page. A writer that
// skipped its guard would save under a key derived from `undefined`, so two unrelated
// sub-lists would silently start overwriting each other's layout.
// ===========================================================================
describe('useTableStatePersistence — without a tableId', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('reports itself as disabled', () => {
    const {result} = renderHook(() => useTableStatePersistence(undefined));

    expect(result.current.isEnabled).toBe(false);
  });

  it('writes nothing, whichever writer is called', () => {
    const {result} = renderHook(() => useTableStatePersistence(undefined));

    act(() => {
      result.current.savePersistedState({pageSize: 25});
      result.current.updatePersistedField('density', 'compact');
      result.current.persistWholeState({pageSize: 25, density: 'compact'});
      result.current.flush();
      result.current.clearPersistedState();
    });

    expect(localStorageMock.setItem).not.toHaveBeenCalled();
    expect(localStorageMock.removeItem).not.toHaveBeenCalled();
  });

  it('reads back nothing', () => {
    const {result} = renderHook(() => useTableStatePersistence(undefined));

    expect(result.current.loadPersistedState()).toBeNull();
  });
});

// ===========================================================================
// `flush` also returns early when there is nothing pending (line 99). Without that
// guard every flush would read the whole persisted blob back and write it out again,
// which is a storage write per idle debounce tick.
// ===========================================================================
describe('useTableStatePersistence — flushing nothing', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('does not write when no field is pending', () => {
    const {result} = renderHook(() => useTableStatePersistence('idle-table'));

    act(() => {
      result.current.flush();
    });

    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });
});
