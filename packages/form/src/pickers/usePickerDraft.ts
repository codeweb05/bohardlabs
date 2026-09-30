import {usePickerAdapter} from '@mui/x-date-pickers/hooks';
import type {MuiPickersAdapter, PickerValidDate} from '@mui/x-date-pickers/models';
import {useState} from 'react';

type FromString = (adapter: MuiPickersAdapter, value: string | null) => PickerValidDate | null;
type ToString = (adapter: MuiPickersAdapter, date: PickerValidDate | null) => string | null;

/**
 * The picker's own value, kept beside the form's string. A half-typed date is an invalid
 * adapter date with no string form; the draft keeps it on screen while the form holds null.
 * A date the picker rejects (outside minDate or maxDate, or before 1900 while the year is
 * still being typed) is kept on screen the same way, and the form holds null.
 * When the form value changes from outside, the draft is rebuilt from it.
 */
export function usePickerDraft(
  value: string | null,
  fromString: FromString,
  toString: ToString,
  onChange: (value: string | null) => void,
) {
  const adapter = usePickerAdapter();
  const [draft, setDraft] = useState(() => fromString(adapter, value));
  const [shownValue, setShownValue] = useState(value);
  if (value !== shownValue) {
    setShownValue(value);
    setDraft(fromString(adapter, value));
  }

  const change = (date: PickerValidDate | null, context: {validationError: unknown}) => {
    const next = context.validationError === null ? toString(adapter, date) : null;
    setDraft(date);
    setShownValue(next);
    onChange(next);
  };

  return {draft, change};
}
