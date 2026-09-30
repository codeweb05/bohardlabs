import {MuiTelInput} from 'mui-tel-input';
import type {MuiTelInputCountry} from 'mui-tel-input';
import {useState} from 'react';

import {useFormConfig} from '../config/FormConfigContext';
import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import type {ValueExpectation} from '../core/valueChecks';

export interface PhoneFieldProps extends CommonFieldProps {
  /** The country shown before the user picks one. Without it the input starts empty. */
  readonly defaultCountry?: MuiTelInputCountry;
  /** Listed first in the country menu. */
  readonly preferredCountries?: readonly MuiTelInputCountry[];
  readonly placeholder?: string;
}

const NULLABLE_E164: ValueExpectation = {
  test: (value) => value === null || (typeof value === 'string' && /^\+\d{1,15}$/.test(value)),
  description: "an E.164 string ('+4930123456') or null",
};

/** A phone number with a country picker, stored as E.164. */
export function PhoneField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  defaultCountry,
  preferredCountries,
  placeholder,
}: Readonly<PhoneFieldProps>) {
  const binding = useFieldBinding<string | null>({required, expect: NULLABLE_E164});
  const {labels} = useFormConfig();
  const value = typeof binding.value === 'string' ? binding.value : null;

  // What the user typed, formatted. Rebuilt from the form value when that changes from
  // outside (a reset, an edit record arriving).
  const [draft, setDraft] = useState(value ?? '');
  const [shownValue, setShownValue] = useState(value);
  if (value !== shownValue) {
    setShownValue(value);
    setDraft(value ?? '');
  }

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <MuiTelInput
        id={binding.inputId}
        value={draft}
        onChange={(text, info) => {
          // `info.numberValue` holds the calling code alone ('+49') once a country is
          // chosen but before any national digits are typed; `info.nationalNumber` is
          // the part that distinguishes "just the calling code" from "no number yet".
          const next = info.nationalNumber ? info.numberValue : null;
          setDraft(text);
          setShownValue(next);
          binding.setValue(next);
        }}
        onBlur={binding.onBlur}
        defaultCountry={defaultCountry}
        preferredCountries={preferredCountries ? [...preferredCountries] : undefined}
        placeholder={placeholder}
        error={binding.error !== null}
        disabled={disabled}
        autoFocus={autoFocus}
        fullWidth
        FlagIconButtonProps={{'aria-label': labels.selectCountry}}
        slotProps={{htmlInput: binding.inputProps}}
      />
    </FieldShell>
  );
}
