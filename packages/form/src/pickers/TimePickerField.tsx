import {TimePicker} from '@mui/x-date-pickers/TimePicker';

import {LabelledByShell} from '../core/LabelledByShell.js';
import type {CommonFieldProps} from '../core/types.js';
import {useFieldBinding} from '../core/useFieldBinding.js';
import type {ValueExpectation} from '../core/valueChecks.js';
import {isTimeString, timeFromString, timeToString} from './dateStrings.js';
import {pickerSlotProps} from './pickerSlotProps.js';
import {usePickerDraft} from './usePickerDraft.js';

export interface TimePickerFieldProps extends CommonFieldProps {
  /** 12-hour clock. Defaults to the adapter locale's choice. */
  readonly ampm?: boolean;
  readonly minutesStep?: number;
}

const NULLABLE_TIME_STRING: ValueExpectation = {
  test: (value) => value === null || isTimeString(value),
  description: "an 'HH:mm' string or null",
};

/** A time of day, stored as `'HH:mm'`. Laid out like `DateField`; see its comment. */
export function TimePickerField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  ampm,
  minutesStep,
}: Readonly<TimePickerFieldProps>) {
  const binding = useFieldBinding<string | null>({required, expect: NULLABLE_TIME_STRING});
  const {draft, change} = usePickerDraft(binding.value ?? null, timeFromString, timeToString, binding.setValue);

  return (
    <LabelledByShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <TimePicker
        value={draft}
        onChange={change}
        onClose={binding.onBlur}
        disabled={disabled}
        autoFocus={autoFocus}
        ampm={ampm}
        minutesStep={minutesStep}
        slotProps={pickerSlotProps(binding, binding.labelId)}
      />
    </LabelledByShell>
  );
}
