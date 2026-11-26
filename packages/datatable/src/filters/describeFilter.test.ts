import {describe, expect, it} from 'vitest';

import {DEFAULT_LABELS} from '../i18n';
import type {ColumnFilterConfig} from '../types';
import {describeFilter} from './describeFilter';

const context = {labels: DEFAULT_LABELS, dateFormats: {display: 'DD/MM/YYYY', value: 'YYYY-MM-DD'}};

const STATUS: ColumnFilterConfig = {
  type: 'select',
  options: [
    {label: 'Pending', value: 'pending'},
    {label: 'Cancelled', value: 'cancelled'},
  ],
};

function chip(value: unknown, config?: ColumnFilterConfig, column = 'Column') {
  return describeFilter({id: 'column', value}, column, config, context);
}

describe('describeFilter', () => {
  it.each<[string, unknown, ColumnFilterConfig | undefined, string]>([
    ['text', 'acme', {type: 'text'}, 'Column contains acme'],
    ['a select, by its option label', 'cancelled', STATUS, 'Column is Cancelled'],
    ['a select with several values', ['pending', 'cancelled'], STATUS, 'Column is any of Pending, Cancelled'],
    ['a value with no option', 'archived', STATUS, 'Column is archived'],
    ['a yes/no, as yes', true, {type: 'boolean'}, 'Column is Yes'],
    ['a yes/no, as no', false, {type: 'boolean'}, 'Column is No'],
    ['a single number', 3, {type: 'number'}, 'Column is 3'],
    ['a number range', [10, 50], {type: 'number'}, 'Column between 10 and 50'],
    ['a number range with only a minimum', [10, null], {type: 'number'}, 'Column at least 10'],
    ['a number range with only a maximum', [null, 50], {type: 'number'}, 'Column at most 50'],
    ['a number list that is not a range', [1, 2, 3], {type: 'number'}, 'Column between 1, 2, 3'],
    ['a single day', '2026-11-01', {type: 'date'}, 'Column is 01/11/2026'],
    [
      'a date range',
      {from: '2026-11-01', to: '2026-11-30'},
      {type: 'date'},
      'Column between 01/11/2026 and 30/11/2026',
    ],
    ['a date range with only a start', {from: '2026-11-01'}, {type: 'date'}, 'Column after 01/11/2026'],
    ['a date range with only an end', {to: '2026-11-30'}, {type: 'date'}, 'Column before 30/11/2026'],
    ['a date it cannot parse, as it is', 'soon', {type: 'date'}, 'Column is soon'],
    ['an operator the column sets', 'cancelled', {...STATUS, operator: 'notEquals'}, 'Column is not Cancelled'],
    ['a value with no config, read off the value', 'acme', undefined, 'Column contains acme'],
    ['a range with no config', [1, 2], undefined, 'Column between 1 and 2'],
    ['a list with no config', ['a', 'b'], undefined, 'Column is any of a, b'],
    ['a `between` that is not a range', 'x', {type: 'text', operator: 'between'}, 'Column between x'],
  ])('reads %s', (_, value, config, expected) => {
    expect(chip(value, config)).toBe(expected);
  });

  it.each<[string, unknown, ColumnFilterConfig | undefined]>([
    ['an empty string', '', {type: 'text'}],
    ['undefined', undefined, {type: 'text'}],
    ['null', null, undefined],
    ['an empty list', [], STATUS],
    ['a number range with neither end', [null, null], {type: 'number'}],
    ['a date range with neither end', {}, {type: 'date'}],
    ['an object read as a single value', {from: '2026-11-01'}, {type: 'date', operator: 'equals'}],
  ])('gives %s no chip', (_, value, config) => {
    expect(chip(value, config)).toBeNull();
  });

  it('puts the words in the order the labels say', () => {
    const labels = {
      ...DEFAULT_LABELS,
      filterChip: (column: string, operator: string, value: string) => `${column}: ${value} (${operator})`,
    };

    expect(describeFilter({id: 'status', value: 'pending'}, 'Status', STATUS, {...context, labels})).toBe(
      'Status: Pending (is)',
    );
  });
});
