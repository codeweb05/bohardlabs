# @vt-labs/form

MUI fields for [TanStack Form](https://tanstack.com/form), for admin and product forms in
apps on React 19 and MUI 9. Every field shows the same label, helper and error layout, reads
the same value shape, and wires the same aria attributes. Date, phone and address fields sit
behind their own entry points, so a sign-in form ships none of them.

> **Status: prerelease (`0.1.0-next`).** Install it with `@vt-labs/form@next`. The API may
> change before 0.1.0.

## Install

The package has no `dependencies`; everything it uses is a peer, so your app's copy of React,
MUI and TanStack Form is the only copy in the bundle.

```sh
pnpm add @vt-labs/form@next @tanstack/react-form @mui/material @mui/icons-material @emotion/react @emotion/styled
pnpm add @mui/x-date-pickers date-fns   # for @vt-labs/form/pickers (or dayjs)
pnpm add mui-tel-input                  # for @vt-labs/form/phone
```

`@vt-labs/form/maps` needs no extra package. You load Google's Places library yourself.

| Entry                   | Holds                                                                | Extra peers              |
| ----------------------- | -------------------------------------------------------------------- | ------------------------ |
| `@vt-labs/form`         | every light field, the form components, `createAppForm`, `lazyField` | none                     |
| `@vt-labs/form/pickers` | `DateField`, `TimePickerField`, `DateRangeField`                     | `@mui/x-date-pickers` ^9 |
| `@vt-labs/form/phone`   | `PhoneField`                                                         | `mui-tel-input` ^11      |
| `@vt-labs/form/maps`    | `LocationSearchField`, `AddressField`, `createGooglePlacesProvider`  | none                     |

## A form

Build your form hook once per app, at module level, and register only the fields that app
uses. Every registered component is in the bundle.

```tsx
import Stack from '@mui/material/Stack';
import {applyServerErrors, createAppForm, FormError, PasswordField, SubmitButton, TextField} from '@vt-labs/form';
import {z} from 'zod';

const {useAppForm} = createAppForm({
  fieldComponents: {TextField, PasswordField},
  formComponents: {SubmitButton, FormError},
});

const signInSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

type Credentials = z.infer<typeof signInSchema>;

export function SignIn({signIn}: {readonly signIn: (credentials: Credentials) => Promise<void>}) {
  const form = useAppForm({
    defaultValues: {email: '', password: ''},
    validators: {onSubmit: signInSchema},
    onSubmit: async ({value, formApi}) => {
      try {
        await signIn(value);
      } catch {
        applyServerErrors(formApi, {form: 'That email and password do not match.'});
      }
    },
  });

  return (
    <Stack
      component="form"
      spacing={1}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="email">
        {(field) => <field.TextField label="Email" type="email" autoComplete="email" required />}
      </form.AppField>
      <form.AppField name="password">{(field) => <field.PasswordField label="Password" required />}</form.AppField>
      <form.AppForm>
        <form.FormError />
        <form.SubmitButton submittingLabel="Signing in…">Sign in</form.SubmitButton>
      </form.AppForm>
    </Stack>
  );
}
```

A failed submit focuses the first invalid field. Pass your own `onSubmitInvalid` to replace
that. `SubmitButton` is never disabled for an invalid form: pressing it is how the user gets
every error shown.

An error shows once the field is touched. Only the first one shows.

## Value shapes

A field reads and writes one shape. An empty single choice is `null`, never `''`.

| Field                                    | Form value                                       |
| ---------------------------------------- | ------------------------------------------------ |
| `TextField`, `TextArea`, `PasswordField` | `string`                                         |
| `NumberField`                            | `number \| null`                                 |
| `CheckboxField`, `SwitchField`           | `boolean`                                        |
| `SelectField`, `SearchableSelectField`   | `V \| null` (an option's `value`)                |
| `RadioGroupField`                        | `V \| null`                                      |
| `MultiSelectField`                       | `V[]`                                            |
| `AsyncAutocompleteField`                 | the option `T \| null`, or `T[]` with `multiple` |
| `DurationField`                          | minutes, `number \| null`                        |
| `DateField` (`/pickers`)                 | `'YYYY-MM-DD' \| null`                           |
| `TimePickerField` (`/pickers`)           | `'HH:mm' \| null`                                |
| `DateRangeField` (`/pickers`)            | `{start: string \| null; end: string \| null}`   |
| `PhoneField` (`/phone`)                  | E.164 `string \| null` (`'+4930123456'`)         |
| `LocationSearchField` (`/maps`)          | `Place \| null` (`{id, label, lat, lng}`)        |
| `AddressField` (`/maps`)                 | `Address`; start from `EMPTY_ADDRESS`            |

In development, a field that finds another shape in the form warns once in the console and
names the field. `AsyncAutocompleteField` is the exception: its option type is yours.

## Heavy fields

`createAppForm` needs a component for every field up front. `lazyField` hands it a small stub,
and the real module loads the first time the field renders:

```tsx
import {createAppForm, lazyField, SubmitButton, TextField} from '@vt-labs/form';

const DateField = lazyField(() => import('@vt-labs/form/pickers').then((m) => m.DateField));
const PhoneField = lazyField(() => import('@vt-labs/form/phone').then((m) => m.PhoneField));

export const {useAppForm} = createAppForm({
  fieldComponents: {TextField, DateField, PhoneField},
  formComponents: {SubmitButton},
});
```

Call `lazyField` at module level. Inside a component it makes a new lazy component on every
render, and the field remounts each time. A second argument sets the Suspense fallback
(nothing by default).

The pickers bring no date library. Mount `LocalizationProvider` once, with the adapter your
app already uses:

```tsx
import {AdapterDateFns} from '@mui/x-date-pickers/AdapterDateFns';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import type {ReactNode} from 'react';

export function Providers({children}: {readonly children: ReactNode}) {
  return <LocalizationProvider dateAdapter={AdapterDateFns}>{children}</LocalizationProvider>;
}
```

The form value stays a plain string whatever the adapter.

## Phone validation

`PhoneField` stores E.164, or `null` when the number is empty. It does not check that the
number exists. For that, refine the schema:

```ts
import {matchIsValidTel} from 'mui-tel-input';
import {z} from 'zod';

export const contactSchema = z.object({
  phone: z
    .string()
    .nullable()
    .refine((value) => value === null || matchIsValidTel(value), 'Enter a valid number'),
});
```

`matchIsValidTel` loads libphonenumber's metadata into whatever chunk the schema lives in. If
that schema sits in your main bundle, so does the metadata.

Flags load from flagcdn.com by default. Pass `getFlagElement` to serve them yourself, for
example under a strict CSP or to avoid the third-party request. Country names follow
`langOfCountryName`:

```tsx
import {PhoneField} from '@vt-labs/form/phone';

<PhoneField
  label="Phone"
  langOfCountryName="de"
  getFlagElement={(isoCode) => <span className={`flag flag-${isoCode.toLowerCase()}`} />}
/>;
```

## Maps

`LocationSearchField` stores a point, `AddressField` stores an address, and both search
through a `PlacesProvider`. `createGooglePlacesProvider` is one, on the Places API (New).
Load the Places library yourself (the package ships no script loader) and create the
provider once, at module level or in `useMemo`:

```tsx
import Stack from '@mui/material/Stack';
import {createAppForm, SubmitButton} from '@vt-labs/form';
import {AddressField, createGooglePlacesProvider, EMPTY_ADDRESS, LocationSearchField} from '@vt-labs/form/maps';
import type {Place} from '@vt-labs/form/maps';

const {useAppForm} = createAppForm({
  fieldComponents: {LocationSearchField, AddressField},
  formComponents: {SubmitButton},
});

// Once per page load. This module needs the Maps JavaScript API bootstrap on the page.
const places = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary;
const provider = createGooglePlacesProvider(places, {includedRegionCodes: ['de', 'at']});

export function PickupForm() {
  const form = useAppForm({defaultValues: {pickup: null as Place | null, billing: EMPTY_ADDRESS}});

  return (
    <Stack spacing={2}>
      <form.AppField name="pickup">
        {(field) => <field.LocationSearchField label="Pickup point" provider={provider} />}
      </form.AppField>
      <form.AppField name="billing">
        {(field) => <field.AddressField label="Billing address" provider={provider} required />}
      </form.AppField>
    </Stack>
  );
}
```

Importing the provider or `EMPTY_ADDRESS` from `@vt-labs/form/maps` loads that entry, so the
fields are imported directly here. `lazyField` would save nothing. It keeps the maps code out of
the initial load only when that load imports nothing from `@vt-labs/form/maps` statically, for
example when the form above is itself a route loaded with `import()`.

Google bills autocomplete by session: the keystrokes of one search and the pick that ends it
are one charge. A new provider on every render starts a new session each time and drops the
predictions a pick is resolved through, so never create one in a render body without
`useMemo`.

`PlacesProvider` is the seam. Implement its three methods (`newSession`, `suggest`,
`resolve`) to use another geocoder, or to test a form without a network.

## Translation

Field text (labels, placeholders, descriptions) is always a prop. The words the package puts
on screen itself come from `FormConfigProvider`, and so does the sentence under an invalid
field:

```tsx
import {FormConfigProvider} from '@vt-labs/form';
import type {FormatError, FormLabels} from '@vt-labs/form';
import type {ReactNode} from 'react';

const labels: Partial<FormLabels> = {showPassword: 'Passwort anzeigen', hidePassword: 'Passwort verbergen'};
const messages: Record<string, string> = {'Enter a valid email address': 'Gib eine gültige E-Mail-Adresse ein'};
const formatError: FormatError = (issue) => messages[issue.message] ?? issue.message;

export function FormTranslations({children}: {readonly children: ReactNode}) {
  return (
    <FormConfigProvider labels={labels} formatError={formatError}>
      {children}
    </FormConfigProvider>
  );
}
```

`formatError` receives a Standard Schema issue. A plain string error from a hand-written
validator arrives as `{message}`. Keep `labels` and `formatError` stable (module level or
`useMemo`) so the provider does not rebuild its value on every render.

Every key of `DEFAULT_FORM_LABELS`, with its English default:

| Key                 | Default                      | Where                                         |
| ------------------- | ---------------------------- | --------------------------------------------- |
| `showPassword`      | Show password                | `PasswordField` toggle, password hidden       |
| `hidePassword`      | Hide password                | `PasswordField` toggle, password visible      |
| `moreInfo`          | More information             | the info button beside a label with `tooltip` |
| `hours`             | Hours                        | `DurationField`                               |
| `minutes`           | Minutes                      | `DurationField`                               |
| `cancel`            | Cancel                       | `CancelButton` with no children               |
| `noOptions`         | No options                   | autocomplete fields                           |
| `loading`           | Loading…                     | autocomplete fields                           |
| `loadFailed`        | Could not load options       | autocomplete fields                           |
| `clear`             | Clear                        | autocomplete fields                           |
| `open`              | Open                         | autocomplete fields                           |
| `close`             | Close                        | autocomplete fields                           |
| `rangeStart`        | Start                        | `DateRangeField`                              |
| `rangeEnd`          | End                          | `DateRangeField`                              |
| `selectCountry`     | Select country               | `PhoneField` country button                   |
| `placeLookupFailed` | Could not look up that place | maps fields, when a pick cannot be resolved   |
| `searchAddress`     | Search for an address        | `AddressField` search box                     |
| `addressLine1`      | Address line 1               | `AddressField`                                |
| `addressLine2`      | Address line 2               | `AddressField`                                |
| `city`              | City                         | `AddressField`                                |
| `region`            | State or region              | `AddressField`                                |
| `postalCode`        | Postal code                  | `AddressField`                                |
| `country`           | Country code                 | `AddressField`                                |

## Server errors

Turning a response body into `{fields, form}` is your job; the package knows no response
format. Then:

```ts
import {applyServerErrors} from '@vt-labs/form';
import type {AnyFormApi} from '@tanstack/react-form';

export function showSaveError(form: AnyFormApi) {
  applyServerErrors(form, {
    fields: {email: 'Already invited', 'address.zip': 'Unknown postal code'},
    form: 'Nothing was saved.',
  });
}
```

- A path with a mounted field shows its message under that field, touched or not.
- A path with no mounted field joins the form-level message, so it still reaches the user.
  `FormError` shows that message.
- The message stays until the user edits that field. What else happens depends on where
  the field's validation lives:
  - A field validated only by the form's `validators`, as in the quick start, or not at
    all: the message blocks the submit. Clicking Submit again does nothing until the user
    edits the field.
  - A field with its own `validators`: a blur or the next submit clears the message, and
    that submit goes through with the same value.

## Recipe: a select whose options come from a query

`SelectField` takes a plain `options` array, so any data hook can feed it. With TanStack
Query, disable the field and say so in `description` while the options load or fail:

```tsx
import {useQuery} from '@tanstack/react-query';
import {SelectField} from '@vt-labs/form';
import type {Option} from '@vt-labs/form';

declare function fetchTeams(): Promise<{id: string; name: string}[]>;

export function TeamSelect() {
  const teams = useQuery({
    queryKey: ['teams'],
    queryFn: fetchTeams,
    select: (rows): Option<string>[] => rows.map((row) => ({value: row.id, label: row.name})),
  });

  let description: string | undefined;
  if (teams.isPending) description = 'Loading teams…';
  else if (teams.isError) description = 'Could not load teams. Reload to try again.';

  return (
    <SelectField
      label="Team"
      options={teams.data ?? []}
      placeholder="Pick a team"
      disabled={teams.isPending || teams.isError}
      description={description}
    />
  );
}
```

Render it inside `form.AppField` as you would any field (`{() => <TeamSelect />}`). An edit
form's saved value survives the wait: the select shows it once its option arrives. A
validation error replaces `description` while it shows. The package does not depend on
TanStack Query; the story "Form/Recipes/Select fed by a query" runs the same component on a
fake hook.

For a list too long to load at once, use `AsyncAutocompleteField`, which searches as the user
types and aborts the request a newer query replaces.

## Your own field

`useFieldBinding` and `FieldShell` are what the built-in fields use. A field built on them gets
the same ids, error rule, server-error clearing and layout:

```tsx
import MuiTextField from '@mui/material/TextField';
import {FieldShell, useFieldBinding} from '@vt-labs/form';
import type {CommonFieldProps} from '@vt-labs/form';

export function SlugField({label, description, required, disabled}: CommonFieldProps) {
  const binding = useFieldBinding<string>({required});
  return (
    <FieldShell binding={binding} label={label} description={description} required={required} disabled={disabled}>
      <MuiTextField
        id={binding.inputId}
        value={binding.value}
        onChange={(event) => binding.setValue(event.target.value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-'))}
        onBlur={binding.onBlur}
        error={binding.error !== null}
        disabled={disabled}
        fullWidth
        slotProps={{htmlInput: binding.inputProps}}
      />
    </FieldShell>
  );
}
```

Register it in `createAppForm` beside the built-in ones. `FieldShell`'s `as` prop takes
`'fieldset'` for a group of inputs and `'bare'` for a control that renders its own label.
