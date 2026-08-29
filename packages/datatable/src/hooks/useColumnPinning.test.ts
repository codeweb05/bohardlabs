/**
 * `resolveColumnOrder` reconciles a saved column order against the columns the table actually has.
 * Every table persists its order, so this runs on each render of every list page in the app.
 */
import {describe, expect, it} from 'vitest';

import {resolveColumnOrder} from './useColumnPinning';

const NO_PINS: readonly string[] = [];

describe('resolveColumnOrder', () => {
  it('uses the coded order when nothing has been saved', () => {
    expect(resolveColumnOrder([], ['name', 'email', 'actions'], NO_PINS)).toEqual(['name', 'email', 'actions']);
  });

  it('keeps the saved order for columns that still exist', () => {
    expect(resolveColumnOrder(['email', 'name'], ['name', 'email'], NO_PINS)).toEqual(['email', 'name']);
  });

  it('drops a saved id the table no longer has', () => {
    expect(resolveColumnOrder(['email', 'legacy', 'name'], ['name', 'email'], NO_PINS)).toEqual(['email', 'name']);
  });

  it('folds a new column in beside the column it was defined after', () => {
    // The customers table gained Building between Phone and Account Status. Appending it instead
    // left everyone who had ever reordered that table with a layout nobody chose, and no way back
    // short of resetting every preference for the table.
    const stored = ['name', 'phone', 'accountStatus', 'createdAt'];
    const coded = ['name', 'phone', 'building', 'accountStatus', 'createdAt'];

    expect(resolveColumnOrder(stored, coded, NO_PINS)).toEqual([
      'name',
      'phone',
      'building',
      'accountStatus',
      'createdAt',
    ]);
  });

  it('keeps a run of new columns in the order the code defines them', () => {
    const stored = ['name', 'phone', 'accountStatus'];
    const coded = ['name', 'phone', 'building', 'zone', 'accountStatus'];

    expect(resolveColumnOrder(stored, coded, NO_PINS)).toEqual(['name', 'phone', 'building', 'zone', 'accountStatus']);
  });

  it('anchors a new column to where the user moved its neighbour, not to the coded position', () => {
    // The saved order is the user's, and it wins: Building follows Phone wherever Phone now sits.
    const stored = ['phone', 'name', 'accountStatus'];
    const coded = ['name', 'phone', 'building', 'accountStatus'];

    expect(resolveColumnOrder(stored, coded, NO_PINS)).toEqual(['phone', 'building', 'name', 'accountStatus']);
  });

  it('puts a new first column at the front, where it has no predecessor to follow', () => {
    // An order saved before row selection was enabled: the checkbox has to lead the row.
    expect(resolveColumnOrder(['name', 'email'], ['select', 'name', 'email'], NO_PINS)).toEqual([
      'select',
      'name',
      'email',
    ]);
  });

  it('still runs the result through the pinned/leading/trailing blocks', () => {
    const stored = ['name', 'actions', 'email'];
    const coded = ['select', 'name', 'email', 'phone', 'actions'];

    expect(resolveColumnOrder(stored, coded, ['email'])).toEqual(['select', 'email', 'name', 'phone', 'actions']);
  });
});
