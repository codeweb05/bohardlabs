/**
 * Package chrome a consumer never passes per field. Field labels, placeholders and
 * descriptions are props; these are the words the package itself puts on screen.
 */
export interface FormLabels {
  /** PasswordField's toggle while the password is hidden. */
  showPassword: string;
  /** PasswordField's toggle while the password is visible. */
  hidePassword: string;
  /** The info button beside a label that has a tooltip. */
  moreInfo: string;
  /** DurationField's two selects. */
  hours: string;
  minutes: string;
  /** CancelButton when it has no children. */
  cancel: string;
  /** Autocomplete-based fields. */
  noOptions: string;
  loading: string;
  loadFailed: string;
  clear: string;
  open: string;
  close: string;
  /** DateRangeField's two pickers. */
  rangeStart: string;
  rangeEnd: string;
  /** PhoneField's country button. */
  selectCountry: string;
  /** AddressField's search box and parts. */
  searchAddress: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export const DEFAULT_FORM_LABELS: FormLabels = {
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  moreInfo: 'More information',
  hours: 'Hours',
  minutes: 'Minutes',
  cancel: 'Cancel',
  noOptions: 'No options',
  loading: 'Loading…',
  loadFailed: 'Could not load options',
  clear: 'Clear',
  open: 'Open',
  close: 'Close',
  rangeStart: 'Start',
  rangeEnd: 'End',
  selectCountry: 'Select country',
  searchAddress: 'Search for an address',
  addressLine1: 'Address line 1',
  addressLine2: 'Address line 2',
  city: 'City',
  region: 'State or region',
  postalCode: 'Postal code',
  country: 'Country code',
};
