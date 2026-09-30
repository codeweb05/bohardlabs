import {useStore} from '@tanstack/react-form';
import {MuiTelInput} from 'mui-tel-input';
import type {MuiTelInputCountry, MuiTelInputProps} from 'mui-tel-input';
import {useState} from 'react';

import {useFormConfig} from '../config/FormConfigContext.js';
import {useFieldContext} from '../context.js';
import {FieldShell} from '../core/FieldShell.js';
import type {CommonFieldProps} from '../core/types.js';
import {useFieldBinding} from '../core/useFieldBinding.js';
import type {ValueExpectation} from '../core/valueChecks.js';

export interface PhoneFieldProps extends CommonFieldProps {
  /** The country shown before the user picks one. Without it the input starts empty. */
  readonly defaultCountry?: MuiTelInputCountry;
  /** Listed first in the country menu. */
  readonly preferredCountries?: readonly MuiTelInputCountry[];
  readonly placeholder?: string;
  /** Language the country names in the menu are shown in, e.g. `'de'`. Defaults to English. */
  readonly langOfCountryName?: MuiTelInputProps['langOfCountryName'];
  /** Renders a flag yourself, e.g. to avoid the default flagcdn.com request under a strict CSP. */
  readonly getFlagElement?: MuiTelInputProps['getFlagElement'];
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
  langOfCountryName,
  getFlagElement,
}: Readonly<PhoneFieldProps>) {
  const binding = useFieldBinding<string | null>({required, expect: NULLABLE_E164});
  const {labels} = useFormConfig();
  const value = typeof binding.value === 'string' ? binding.value : null;

  const field = useFieldContext<unknown>();
  const isTouched = useStore(field.store, (state) => state.meta.isTouched);

  // What the user typed, formatted. Rebuilt from the form value when that changes from
  // outside (an edit record arriving), or when a reset untouches the field.
  const [draft, setDraft] = useState(value ?? '');
  const [shownValue, setShownValue] = useState(value);
  const [wasTouched, setWasTouched] = useState(isTouched);
  if (value !== shownValue || (wasTouched && !isTouched)) {
    setShownValue(value);
    setDraft(value ?? '');
  }
  if (isTouched !== wasTouched) setWasTouched(isTouched);

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
        langOfCountryName={langOfCountryName}
        getFlagElement={getFlagElement}
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
