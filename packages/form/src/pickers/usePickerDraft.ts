import {usePickerAdapter} from '@mui/x-date-pickers/hooks';
import type {MuiPickersAdapter, PickerValidDate} from '@mui/x-date-pickers/models';
import {useStore} from '@tanstack/react-form';
import {useState} from 'react';

import {useFieldContext} from '../context.js';

type FromString = (adapter: MuiPickersAdapter, value: string | null) => PickerValidDate | null;
type ToString = (adapter: MuiPickersAdapter, date: PickerValidDate | null) => string | null;

/**
 * The picker's own value, kept beside the form's string. A half-typed date is an invalid
 * adapter date with no string form; the draft keeps it on screen while the form holds null.
 * A date the picker rejects (outside minDate or maxDate, or before 1900 while the year is
 * still being typed) is kept on screen the same way, and the form holds null.
 * When the form value changes from outside, or a reset untouches the field, the draft is
 * rebuilt from the value.
 *
 * A rejected draft can become valid with no edit, when a prop the picker validates against
 * changes (a wider minDate or maxDate, or the other end of a range). The picker then fires
 * only `onError(null)`, so `settle` stores the draft from there. It stores only the date the
 * user entered and the picker rejected, never a draft left over from before a rebuild.
 */
export function usePickerDraft(
  value: string | null,
  fromString: FromString,
  toString: ToString,
  onChange: (value: string | null) => void,
) {
  const adapter = usePickerAdapter();
  const field = useFieldContext<unknown>();
  const isTouched = useStore(field.store, (state) => state.meta.isTouched);
  const [draft, setDraft] = useState(() => fromString(adapter, value));
  const [shownValue, setShownValue] = useState(value);
  // The string of the date the user entered and the picker rejected, the only draft `settle` may store.
  const [rejected, setRejected] = useState<string | null>(null);
  const [wasTouched, setWasTouched] = useState(isTouched);
  if (value !== shownValue || (wasTouched && !isTouched)) {
    setShownValue(value);
    setDraft(fromString(adapter, value));
    setRejected(null);
  }
  if (isTouched !== wasTouched) setWasTouched(isTouched);

  const change = (date: PickerValidDate | null, context: {validationError: unknown}) => {
    const accepted = context.validationError === null;
    const next = accepted ? toString(adapter, date) : null;
    setDraft(date);
    setShownValue(next);
    setRejected(accepted ? null : toString(adapter, date));
    onChange(next);
  };

  const settle = (error: unknown) => {
    if (error !== null || rejected === null) return;
    const next = toString(adapter, draft);
    /* v8 ignore start: never true, `change` sets draft and `rejected` together and leaves the value null */
    if (next !== rejected || next === value) return;
    /* v8 ignore stop */
    setRejected(null);
    setShownValue(next);
    onChange(next);
  };

  return {draft, change, settle};
}
