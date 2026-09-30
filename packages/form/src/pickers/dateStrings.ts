import type {MuiPickersAdapter, PickerValidDate} from '@mui/x-date-pickers/models';

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{2}):(\d{2})$/;

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

function dateParts(value: unknown): [number, number, number] | null {
  if (typeof value !== 'string') return null;
  const match = DATE.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // A UTC date is used only to check the calendar (is there a 30 February?), never shown.
  // `setUTCFullYear` rather than `Date.UTC`, which reads years 0 to 99 as 1900 to 1999: a
  // picker reports year 0002 while the user is still typing 2026.
  const check = new Date(0);
  check.setUTCFullYear(year, month - 1, day);
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day
    ? [year, month, day]
    : null;
}

function timeParts(value: unknown): [number, number] | null {
  if (typeof value !== 'string') return null;
  const match = TIME.exec(value);
  if (!match) return null;
  const [hours, minutes] = [Number(match[1]), Number(match[2])];
  return hours < 24 && minutes < 60 ? [hours, minutes] : null;
}

export function isDateString(value: unknown): value is string {
  return dateParts(value) !== null;
}

export function isTimeString(value: unknown): value is string {
  return timeParts(value) !== null;
}

/**
 * Builds the adapter's date for a calendar day, at local midnight. Setting the parts one by
 * one avoids `adapter.date(iso)`, which date-fns reads as UTC and so shows as the day before
 * anywhere west of Greenwich.
 */
export function dateFromString(adapter: MuiPickersAdapter, value: string | null): PickerValidDate | null {
  const parts = dateParts(value);
  if (!parts) return null;
  const [year, month, day] = parts;
  const start = adapter.startOfYear(adapter.setYear(adapter.date(), year));
  return adapter.setDate(adapter.setMonth(start, month - 1), day);
}

export function dateToString(adapter: MuiPickersAdapter, date: PickerValidDate | null): string | null {
  if (date === null || !adapter.isValid(date)) return null;
  return `${pad(adapter.getYear(date), 4)}-${pad(adapter.getMonth(date) + 1)}-${pad(adapter.getDate(date))}`;
}

/**
 * Builds the adapter's date for a time of day. The day is fixed, 1 January 2000, because a
 * clock change on the current day skips an hour: 02:30 would come back as 03:30.
 */
export function timeFromString(adapter: MuiPickersAdapter, value: string | null): PickerValidDate | null {
  const parts = timeParts(value);
  if (!parts) return null;
  const day = adapter.startOfYear(adapter.setYear(adapter.date(), 2000));
  return adapter.setMinutes(adapter.setHours(day, parts[0]), parts[1]);
}

export function timeToString(adapter: MuiPickersAdapter, date: PickerValidDate | null): string | null {
  if (date === null || !adapter.isValid(date)) return null;
  return `${pad(adapter.getHours(date))}:${pad(adapter.getMinutes(date))}`;
}
