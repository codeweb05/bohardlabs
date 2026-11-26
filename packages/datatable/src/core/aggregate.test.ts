/**
 * The footer's arithmetic, and its reads of the consumer's untyped `meta`. Each aggregate
 * is checked with no input, with nulls among the numbers, and, for the median, with an
 * even count.
 */
import {createElement, isValidElement} from 'react';
import {describe, expect, it} from 'vitest';

import {aggregate, columnAggregate, formatTotal} from './aggregate';

describe('aggregate', () => {
  it.each(['sum', 'avg', 'count', 'min', 'max', 'median', 'distinct'] as const)(
    'gives null for no values: %s',
    (fn) => {
      expect(aggregate(fn, [])).toBeNull();
    },
  );

  it('adds, averages and bounds the numbers, skipping nulls rather than counting them as zero', () => {
    const values = [4, null, 10, undefined, 1, 'n/a', Number.NaN];

    expect(aggregate('sum', values)).toBe(15);
    expect(aggregate('avg', values)).toBe(5);
    expect(aggregate('min', values)).toBe(1);
    expect(aggregate('max', values)).toBe(10);
  });

  it('gives null when not one value is a number', () => {
    for (const fn of ['sum', 'avg', 'min', 'max', 'median'] as const) {
      expect(aggregate(fn, [null, 'x', undefined])).toBeNull();
    }
  });

  it('takes the middle value, or the mean of the middle two for an even count', () => {
    expect(aggregate('median', [9, 1, 5])).toBe(5);
    expect(aggregate('median', [10, 1, null, 4, 3])).toBe(3.5);
  });

  it('counts what is there, and what is different', () => {
    const values = ['a', null, 'b', 'a', undefined, 0];

    expect(aggregate('count', values)).toBe(4);
    expect(aggregate('distinct', values)).toBe(3);
    expect(aggregate('count', [null])).toBe(0);
  });

  it('hands a custom aggregate the raw values, and drops what is not a finite number', () => {
    const values = [2, 'x', null];

    expect(aggregate((seen) => seen.length, values)).toBe(3);
    expect(aggregate(() => Number.POSITIVE_INFINITY, values)).toBeNull();
    expect(aggregate(() => null, values)).toBeNull();
  });
});

describe('columnAggregate', () => {
  it('reads a named or custom aggregate off the meta', () => {
    const custom = () => 1;

    expect(columnAggregate({aggregate: 'sum'})).toBe('sum');
    expect(columnAggregate({aggregate: custom})).toBe(custom);
  });

  it('ignores a meta with no aggregate, or one it does not know', () => {
    expect(columnAggregate(undefined)).toBeUndefined();
    expect(columnAggregate(null)).toBeUndefined();
    expect(columnAggregate({group: 'Billing'})).toBeUndefined();
    expect(columnAggregate({aggregate: 'total'})).toBeUndefined();
  });
});

describe('formatTotal', () => {
  it('shows a plain number in the user’s locale by default', () => {
    expect(formatTotal(undefined, 1234.5)).toBe(new Intl.NumberFormat().format(1234.5));
    expect(formatTotal({formatAggregate: 'currency'}, 2)).toBe(new Intl.NumberFormat().format(2));
  });

  it('uses the column’s own format when it gives back something to render', () => {
    expect(formatTotal({formatAggregate: (value: number) => `$${value}`}, 3)).toBe('$3');
    expect(formatTotal({formatAggregate: (value: number) => value * 100}, 3)).toBe(300);
    expect(isValidElement(formatTotal({formatAggregate: () => createElement('b', null, 'x')}, 3))).toBe(true);
  });

  it('falls back to the default when the format gives back nothing React can show', () => {
    expect(formatTotal({formatAggregate: () => ({amount: 3})}, 3)).toBe(new Intl.NumberFormat().format(3));
  });
});
