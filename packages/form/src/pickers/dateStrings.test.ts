import {AdapterDateFns} from '@mui/x-date-pickers/AdapterDateFns';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';

import {dateFromString, dateToString, isDateString, isTimeString, timeFromString, timeToString} from './dateStrings';

describe('isDateString and isTimeString', () => {
  it.each([
    ['2026-03-09', true],
    ['2024-02-29', true],
    ['0002-05-04', true],
    ['2026-02-29', false],
    ['2026-13-40', false],
    ['2026-3-9', false],
    [null, false],
  ])('isDateString(%s) is %s', (value, expected) => {
    expect(isDateString(value)).toBe(expected);
  });

  it.each([
    ['00:00', true],
    ['23:59', true],
    ['24:00', false],
    ['9:30', false],
  ])('isTimeString(%s) is %s', (value, expected) => {
    expect(isTimeString(value)).toBe(expected);
  });
});

describe.each([
  ['date-fns', new AdapterDateFns()],
  ['dayjs', new AdapterDayjs()],
])('conversion under %s', (_name, adapter) => {
  it('round-trips a date string without moving the day', () => {
    expect(dateToString(adapter, dateFromString(adapter, '2026-03-09'))).toBe('2026-03-09');
    expect(dateToString(adapter, dateFromString(adapter, '2026-12-31'))).toBe('2026-12-31');
  });

  it('reads a day that does not exist as null', () => {
    expect(dateFromString(adapter, '2026-02-30')).toBeNull();
    expect(dateFromString(adapter, 'garbage')).toBeNull();
  });

  it('round-trips a time string', () => {
    expect(timeToString(adapter, timeFromString(adapter, '07:05'))).toBe('07:05');
  });

  it('writes an invalid date as null', () => {
    expect(dateToString(adapter, adapter.date('not a date'))).toBeNull();
  });
});
