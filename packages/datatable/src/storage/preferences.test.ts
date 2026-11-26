import {describe, expect, it} from 'vitest';

import {dropStaleColumns, toColumnPreferences} from './preferences';
import type {ColumnLayout} from './preferences';

const DEFAULTS: ColumnLayout = {
  columnOrder: [],
  columnPinning: {left: [], right: []},
  columnVisibility: {notes: false},
};

describe('toColumnPreferences', () => {
  it('keeps only the visibility that differs from the default', () => {
    const preferences = toColumnPreferences(
      {...DEFAULTS, columnVisibility: {notes: false, status: true, total: false}},
      DEFAULTS,
    );

    // `notes` is hidden by default and `status` visible by default: neither is a choice.
    expect(preferences.columnVisibility).toEqual({total: false});
  });

  it('keeps a default-hidden column the user showed', () => {
    const preferences = toColumnPreferences({...DEFAULTS, columnVisibility: {notes: true}}, DEFAULTS);

    expect(preferences.columnVisibility).toEqual({notes: true});
  });

  it('leaves out an order and a pinning equal to the defaults', () => {
    const preferences = toColumnPreferences({...DEFAULTS, columnPinning: {}}, DEFAULTS);

    // An own `undefined`, so a write merged over the stored entry clears it.
    expect(preferences).toHaveProperty('columnOrder', undefined);
    expect(preferences).toHaveProperty('columnPinning', undefined);
  });

  it('keeps an order and a pinning the user changed', () => {
    const preferences = toColumnPreferences(
      {...DEFAULTS, columnOrder: ['total', 'status'], columnPinning: {left: ['total']}},
      DEFAULTS,
    );

    expect(preferences.columnOrder).toEqual(['total', 'status']);
    expect(preferences.columnPinning).toEqual({left: ['total']});
  });

  it('keeps a right pinning that differs from defaults with no right side', () => {
    const preferences = toColumnPreferences(
      {...DEFAULTS, columnPinning: {right: ['total']}},
      {
        ...DEFAULTS,
        columnPinning: {left: ['total']},
      },
    );

    expect(preferences.columnPinning).toEqual({right: ['total']});
  });
});

describe('dropStaleColumns', () => {
  const IDS = ['status', 'total'];

  it('drops every layout entry for a column the table no longer has', () => {
    const state = dropStaleColumns(
      {
        pageSize: 50,
        columnOrder: ['gone', 'total', 'status'],
        columnPinning: {left: ['gone', 'status'], right: ['total', 'gone']},
        columnSizing: {gone: 200, total: 120},
        columnVisibility: {gone: false, status: false},
      },
      IDS,
    );

    expect(state).toEqual({
      pageSize: 50,
      columnOrder: ['total', 'status'],
      columnPinning: {left: ['status'], right: ['total']},
      columnSizing: {total: 120},
      columnVisibility: {status: false},
    });
  });

  it('keeps a pinning side that was never stored missing', () => {
    expect(dropStaleColumns({columnPinning: {left: ['gone']}}, IDS).columnPinning).toEqual({left: []});
  });

  it('passes an entry with no column layout through', () => {
    const state = dropStaleColumns({density: 'compact'}, IDS);

    expect(state.density).toBe('compact');
    expect(state.columnOrder).toBeUndefined();
    expect(state.columnPinning).toBeUndefined();
    expect(state.columnSizing).toBeUndefined();
    expect(state.columnVisibility).toBeUndefined();
  });
});
