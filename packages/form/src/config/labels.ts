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
  /** Under LocationSearchField or AddressField when the provider could not resolve a pick. */
  placeLookupFailed: string;
  /** AddressField's search box and parts. */
  searchAddress: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  /** NumberField's helper line when it has `min` and `max` and no `description`. */
  numberRange: (min: number, max: number) => string;
  /** NumberField's helper line when it has only `min`. */
  numberMin: (min: number) => string;
  /** NumberField's helper line when it has only `max`. */
  numberMax: (max: number) => string;
  /** IntegerListField's message for an entry that is not a whole number. */
  integerListInvalid: (entry: string) => string;
  /** IntegerListField's message for an entry already in the list. */
  integerListDuplicate: (entry: string) => string;
  /** IntegerListField's message for an entry outside `min` and `max`. */
  integerListOutOfRange: (entry: string, min: number | undefined, max: number | undefined) => string;
  /** The accessible name of an IntegerListField chip, which removes the entry when pressed. */
  removeEntry: (entry: string) => string;
  /** FileField's button while nothing is chosen. */
  chooseFile: string;
  /** Beside FileField's button, telling the user the area takes a drop. */
  dropFile: string;
  /** FileField's button that swaps the chosen file for another. */
  replaceFile: string;
  /** The accessible name of FileField's remove button for one file. */
  removeFile: (name: string) => string;
  /** FileField's photo button while nothing is chosen. */
  choosePhoto: string;
  /** The accessible names of the buttons over FileField's photo preview. */
  editPhoto: string;
  replacePhoto: string;
  removePhoto: string;
  /** A file's size as FileField shows it, such as "1.2 MB". */
  fileSize: (bytes: number) => string;
  /** FileField's message for a file over `maxBytes`. `size` and `limit` come from `fileSize`. */
  fileTooLarge: (name: string, size: string, limit: string) => string;
  /** FileField's message for a file `accept` does not allow. */
  fileWrongType: (name: string) => string;
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
  placeLookupFailed: 'Could not look up that place',
  searchAddress: 'Search for an address',
  addressLine1: 'Address line 1',
  addressLine2: 'Address line 2',
  city: 'City',
  region: 'State or region',
  postalCode: 'Postal code',
  country: 'Country code',
  numberRange: (min, max) => `Between ${min} and ${max}`,
  numberMin: (min) => `At least ${min}`,
  numberMax: (max) => `At most ${max}`,
  integerListInvalid: (entry) => `${entry} is not a whole number`,
  integerListDuplicate: (entry) => `${entry} is already in the list`,
  integerListOutOfRange: (entry, min, max) => {
    if (min !== undefined && max !== undefined) return `${entry} is not between ${min} and ${max}`;
    if (min !== undefined) return `${entry} is below ${min}`;
    return `${entry} is above ${max}`;
  },
  removeEntry: (entry) => `Remove ${entry}`,
  chooseFile: 'Choose file',
  dropFile: 'or drop it here',
  replaceFile: 'Replace',
  removeFile: (name) => `Remove ${name}`,
  choosePhoto: 'Add photo',
  editPhoto: 'Edit photo',
  replacePhoto: 'Replace photo',
  removePhoto: 'Remove photo',
  fileSize: (bytes) => {
    if (bytes < 1000) return `${bytes} B`;
    const round = (amount: number) => Number(amount.toFixed(amount < 10 ? 1 : 0));
    if (bytes < 1e6) return `${round(bytes / 1e3)} KB`;
    if (bytes < 1e9) return `${round(bytes / 1e6)} MB`;
    return `${round(bytes / 1e9)} GB`;
  },
  fileTooLarge: (name, size, limit) => `“${name}” is ${size}. The limit is ${limit}.`,
  fileWrongType: (name) => `“${name}” is not a file type this field accepts.`,
};
