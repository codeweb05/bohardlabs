# `@vt-labs/form` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@vt-labs/form`, a set of MUI fields for TanStack Form. The root entry holds the light fields; date pickers, phone input and Google Places each sit behind their own subpath, so a sign-in form ships none of them.

**Architecture:** One package with four entries (`.`, `/pickers`, `/phone`, `/maps`) built by one Vite multi-entry build with `preserveModules`. Every field reads its TanStack field through one package-owned context (`createFormHookContexts` called once) and renders through one internal hook, `useFieldBinding`, plus one layout, `FieldShell`. Consumers build their form hook with `createAppForm` and register heavy fields through `lazyField(() => import('@vt-labs/form/pickers')...)`.

**Tech Stack:** React 19, TanStack Form 1.33, MUI 9, MUI X Date Pickers 9, mui-tel-input 11, Vite 8 (rolldown), Vitest 4 (jsdom), Storybook 10 with the Vitest addon, size-limit, publint, attw.

**Spec:** [`docs/superpowers/specs/2026-09-29-form-package-design.md`](../../specs/2026-09-29-form-package-design.md). Read it before starting; this plan argues from it. The spec's "Amendments while planning" section lists the places where this plan corrects it after checking the real APIs.

## Status

Updated as each task lands. "Done" means reviewed, fixed and committed on `main`.

| Task | What                                         | Status  | Commits          |
| ---- | -------------------------------------------- | ------- | ---------------- |
| 1    | Scaffold, config provider, `createAppForm`   | done    | 84b36a2          |
| 2    | Field contract, `TextField`, `TextArea`      | done    | 18aade7, 21a524a |
| 3    | `PasswordField`, `NumberField`               | done    | 18c8b9f, bcbcae8 |
| 4    | Server errors, form buttons, invalid focus   | done    | 363e69c          |
| 5    | `CheckboxField`, `SwitchField`               | done    | d53edc4          |
| 6    | `SelectField`, `RadioGroupField`             | done    | d66380e, ef31bc7 |
| 7    | `SearchableSelectField`, `MultiSelectField`  | working |                  |
| 8    | `AsyncAutocompleteField`                     | to do   |                  |
| 9    | `DurationField`, `lazyField`                 | to do   |                  |
| 10   | `/pickers` (re-planned for x-date-pickers 9) | to do   |                  |
| 11   | `/phone`                                     | to do   |                  |
| 12   | `/maps`                                      | to do   |                  |
| 13   | Prove the leanness                           | to do   |                  |
| 14   | Document and close                           | to do   |                  |
| end  | Final whole-branch review and fixes          | to do   |                  |

Two Task 4 test gaps (a consumer `onSubmitInvalid` replacing the default; cancel on a dirty
form with no `confirm`) and one Task 6 edge case (an `Option` whose value is `''` reads as
empty in `SelectField`) are held for the final review's fix round.

## Global Constraints

- Package name `@vt-labs/form`, `"private": true`, version `0.0.0`. Flipping `private` is a separate decision.
- Peers: `react` and `react-dom` `^19.0.0`; `@mui/material` `^9.0.0`; `@emotion/react` and `@emotion/styled` `^11.14.0`; `@tanstack/react-form` `^1.33.0`. Optional peers: `@mui/x-date-pickers` `^9.0.0` and `mui-tel-input` `^11.0.0`. There is no `@types/google.maps` peer and no `@mui/icons-material` peer.
- Every peer is listed again in `devDependencies` as `catalog:`. A peer range is written out in full, never `catalog:`.
- The root entry (`src/index.ts`) never reaches `@mui/x-date-pickers`, `mui-tel-input` or `mui-tel-input`'s `libphonenumber-js`. `/pickers`, `/phone` and `/maps` never reach each other's peers.
- Deep MUI imports only (`@mui/material/TextField`), never `from '@mui/material'`. Icons are inline `SvgIcon` paths.
- No date library imported by any `src/` file outside tests. No Google script loader.
- `"sideEffects": false`. No module does work at import time beyond declaring functions, constants and components.
- No `any`, `@ts-ignore`, `@ts-expect-error` or `as unknown as` in `src/`. The single `@ts-expect-error` allowed is in a type test that asserts a compile error, and it says so.
- No hardcoded user-facing string inside a component. Field text comes from props; package chrome comes from `FormLabels` through `FormConfigProvider`.
- No hardcoded colour. Theme tokens only.
- Form values: text `string`; `NumberField` `number | null`; checkbox and switch `boolean`; single choice `V | null` (never `''`); multi choice `V[]`; `DurationField` minutes as `number | null`; `DateField` `'YYYY-MM-DD' | null`; `TimePickerField` `'HH:mm' | null`; `DateRangeField` `{start: string | null; end: string | null}`; `PhoneField` E.164 `string | null`; `LocationSearchField` `Place | null`; `AddressField` `Address`.
- Ids come from `useId()`, never the field name.
- An error shows when the field is touched and has one; only the first error shows, through `formatError`.
- Human-readable text (README, comments, story docs, changeset): no em-dashes, no filler.
- Git: do not run any writing git command. Each task ends with a handoff step that lists the files and a suggested commit message for the user.

## Review Focus

1. **A server error on a field the screen does not render.** A backend returns `{fields: {'address.zip': '...'}}` and no field is mounted at that path. Expected: the message still reaches the user. `applyServerErrors` appends it to the form-level error. Test in Task 4.
2. **A consumer resets the form or loads an edit record after mount.** `NumberField`, `PhoneField` and the pickers keep a local draft of what the user typed. Expected: an external value change replaces the draft instead of being ignored. Tests in Tasks 3, 10 and 11.
3. **Typing faster than the server answers.** `AsyncAutocompleteField` fires a request for "ab" and then "abc"; "ab" resolves last. Expected: only "abc"'s options show and the "ab" request's signal is aborted. Test in Task 8.
4. **Two forms on one page with the same field name.** Expected: no duplicate DOM ids, and an invalid submit in form B focuses form B's field, not form A's. Tests in Tasks 2 and 4.
5. **A picker value that is not a valid date string** (`'2026-13-40'` from a bad API record, or a half-typed date). Expected: the picker renders empty rather than throwing, a dev warning names the field, and a half-typed date keeps what the user typed. Test in Task 10.

## File map

```
packages/form/
├── package.json                  exports: . /pickers /phone /maps
├── tsconfig.json                 typecheck (src + configs)
├── tsconfig.build.json           declarations only
├── vite.config.ts                one build, four entries, preserveModules; jsdom tests
├── README.md
├── scripts/
│   ├── check-graph.mjs           walks dist/ imports per entry
│   └── check-fixture.mjs         builds fixtures/consumer, inspects chunks
├── fixtures/consumer/            a Vite app with a sign-in form and a lazy DateField
└── src/
    ├── index.ts  pickers.ts  phone.ts  maps.ts      the four entries
    ├── index.test.ts                                surface lock for all four
    ├── context.ts                                   the one createFormHookContexts() call
    ├── createAppForm.ts  focusFirstInvalid.ts  lazyField.tsx  serverErrors.ts
    ├── config/labels.ts  config/FormConfigContext.tsx
    ├── core/            types.ts  issues.ts  valueChecks.ts  useFieldBinding.ts
    │                    FieldShell.tsx  InfoTooltip.tsx  icons.tsx  autocompleteText.ts
    ├── fields/          one file per root field, plus useAsyncOptions.ts
    ├── form/            SubmitButton.tsx  CancelButton.tsx  FormError.tsx
    ├── pickers/         dateStrings.ts  DateField.tsx  TimePickerField.tsx  DateRangeField.tsx
    ├── phone/           PhoneField.tsx
    ├── maps/            types.ts  googlePlaces.ts  usePlacesSession.ts
    │                    LocationSearchField.tsx  AddressField.tsx
    ├── stories/         one *.stories.tsx per field group
    └── test/            setup.ts  FieldHarness.tsx  fakePlaces.ts
```

Tests sit next to the file they test (`fields/TextField.test.tsx`).

---

### Task 1: Scaffold the package, the config provider and `createAppForm`

**Files:**

- Create: `packages/form/package.json`, `packages/form/tsconfig.json`, `packages/form/tsconfig.build.json`, `packages/form/vite.config.ts`, `packages/form/LICENSE` (copy of the root `LICENSE`)
- Create: `packages/form/src/index.ts`, `src/pickers.ts`, `src/phone.ts`, `src/maps.ts`
- Create: `packages/form/src/context.ts`, `src/createAppForm.ts`, `src/config/labels.ts`, `src/config/FormConfigContext.tsx`, `src/test/setup.ts`
- Test: `packages/form/src/index.test.ts`, `src/config/FormConfigContext.test.tsx`, `src/createAppForm.test.tsx`
- Modify: `pnpm-workspace.yaml` (catalog)

**Interfaces:**

- Produces: `fieldContext`, `formContext`, `useFieldContext`, `useFormContext` from `src/context.ts`.
- Produces: `createAppForm({fieldComponents, formComponents})` returning `{useAppForm, withForm, withFieldGroup, useTypedAppFormContext}` (whatever `createFormHook` returns, with `useAppForm` wrapped).
- Produces: `FormLabels`, `DEFAULT_FORM_LABELS` from `src/config/labels.ts`; `FormConfigProvider`, `useFormConfig(): {labels: FormLabels; formatError: FormatError}`, `type FormatError = (issue: StandardSchemaV1Issue) => string` from `src/config/FormConfigContext.tsx`.

- [ ] **Step 1: Add the new shared versions to the catalog**

In `pnpm-workspace.yaml`, add these lines to the `catalog:` block, after `'@tanstack/react-virtual'`:

```yaml
'@tanstack/react-form': ^1.33.5
mui-tel-input: ^11.0.0
date-fns: ^4.4.0
zod: ^4.6.5
'@types/google.maps': ^3.66.4
```

- [ ] **Step 2: Write the package manifest and configs**

`packages/form/package.json`:

```json
{
  "name": "@vt-labs/form",
  "version": "0.0.0",
  "private": true,
  "description": "MUI fields for TanStack Form, with date, phone and address fields behind their own entry points",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "files": ["dist", "CHANGELOG.md", "LICENSE"],
  "exports": {
    ".": {"types": "./dist/index.d.ts", "default": "./dist/index.js"},
    "./pickers": {"types": "./dist/pickers.d.ts", "default": "./dist/pickers.js"},
    "./phone": {"types": "./dist/phone.d.ts", "default": "./dist/phone.js"},
    "./maps": {"types": "./dist/maps.d.ts", "default": "./dist/maps.js"},
    "./package.json": "./package.json"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "publishConfig": {"access": "public"},
  "scripts": {
    "build": "vite build && tsc -p tsconfig.build.json",
    "dev": "vite build --watch",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "clean": "rm -rf dist *.tsbuildinfo"
  },
  "peerDependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.0",
    "@mui/material": "^9.0.0",
    "@mui/x-date-pickers": "^9.0.0",
    "@tanstack/react-form": "^1.33.0",
    "mui-tel-input": "^11.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "peerDependenciesMeta": {
    "@mui/x-date-pickers": {"optional": true},
    "mui-tel-input": {"optional": true}
  },
  "devDependencies": {
    "@emotion/react": "catalog:",
    "@emotion/styled": "catalog:",
    "@mui/material": "catalog:",
    "@mui/x-date-pickers": "catalog:",
    "@storybook/react-vite": "^10.5.10",
    "@tanstack/react-form": "catalog:",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.6",
    "@types/google.maps": "catalog:",
    "@types/node": "^26.4.0",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "date-fns": "catalog:",
    "dayjs": "catalog:",
    "jsdom": "^30.0.1",
    "mui-tel-input": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:",
    "storybook": "^10.5.10",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vitest": "catalog:",
    "zod": "catalog:"
  }
}
```

`packages/form/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "types": ["vitest/globals", "@testing-library/jest-dom", "node"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`packages/form/tsconfig.build.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": false,
    "emitDeclarationOnly": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": [
    "src/**/*.test.ts",
    "src/**/*.test.tsx",
    "src/**/*.typetest.ts",
    "src/**/*.stories.tsx",
    "src/stories",
    "src/test"
  ]
}
```

`packages/form/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
    emptyOutDir: true,
    lib: {
      // One entry per optional peer (decision 0009). They share one build so an internal
      // module used by two entries is emitted once and imported by both.
      entry: {index: 'src/index.ts', pickers: 'src/pickers.ts', phone: 'src/phone.ts', maps: 'src/maps.ts'},
      formats: ['es'],
    },
    rolldownOptions: {
      // Every bare specifier is a peer or an optional peer. Nothing from node_modules
      // belongs in the output.
      external: (id) => !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0'),
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    testTimeout: 15000,
    hookTimeout: 15000,
    pool: 'forks',
    maxWorkers: process.env.VITEST_MAX_WORKERS ? Number(process.env.VITEST_MAX_WORKERS) : '50%',
    maxConcurrency: 5,
  },
});
```

The datatable runs the React Compiler because its render counts depend on it. Nothing here does, so the plain plugin is enough.

- [ ] **Step 3: Install**

Run: `pnpm install`
Expected: completes, and `packages/form/node_modules/@tanstack/react-form` exists. If pnpm refuses a version as younger than `minimumReleaseAge`, add `'<name>@<version>'` to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` the way the existing entries are written, and rerun.

- [ ] **Step 4: Write the test setup**

`packages/form/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import {cleanup} from '@testing-library/react';
import {afterEach, vi} from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom has no `matchMedia`. MUI X pickers ask `(pointer: fine)` to choose between the
// desktop and mobile variant; answering yes gives the desktop popper, which closes on
// selection and needs no OK button.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('pointer: fine'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class MockResizeObserver implements ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
globalThis.ResizeObserver = MockResizeObserver;
```

- [ ] **Step 5: Write the failing tests**

`packages/form/src/index.test.ts`:

```ts
/**
 * The entry points are the contract a consumer codes against, so each list is pinned: a
 * rename or an accidentally dropped export fails here instead of in someone else's build.
 * Types are erased at runtime and are covered by `pnpm typecheck` instead.
 */
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

import {describe, expect, it} from 'vitest';

import * as root from './index';
import * as maps from './maps';
import * as phone from './phone';
import * as pickers from './pickers';

const ROOT_API = ['DEFAULT_FORM_LABELS', 'FormConfigProvider', 'createAppForm', 'useFieldContext', 'useFormContext'];
const PICKERS_API: string[] = [];
const PHONE_API: string[] = [];
const MAPS_API: string[] = [];

describe('public surface', () => {
  it.each([
    ['@vt-labs/form', root, ROOT_API],
    ['@vt-labs/form/pickers', pickers, PICKERS_API],
    ['@vt-labs/form/phone', phone, PHONE_API],
    ['@vt-labs/form/maps', maps, MAPS_API],
  ])('%s exports exactly the pinned list', (_name, module, expected) => {
    expect(Object.keys(module).sort()).toEqual([...expected].sort());
  });
});

describe('form contexts', () => {
  // A second createFormHookContexts() call makes a second pair of contexts. A field
  // reading one while the form provides the other throws at render, so the package owns
  // exactly one pair and every field reads it.
  it('are created exactly once across the package source', () => {
    const srcDir = fileURLToPath(new URL('.', import.meta.url));
    const sources = walk(srcDir).filter(
      (file) => /\.tsx?$/.test(file) && !/\.(test|stories|typetest)\.tsx?$/.test(file),
    );
    const calls = sources.flatMap((file) => readFileSync(file, 'utf8').match(/createFormHookContexts\(\)/g) ?? []);
    expect(calls).toHaveLength(1);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
```

`packages/form/src/config/FormConfigContext.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';

import {DEFAULT_FORM_LABELS} from './labels';
import {FormConfigProvider, useFormConfig} from './FormConfigContext';

function Probe() {
  const {labels, formatError} = useFormConfig();
  return (
    <p>
      {labels.cancel}|{labels.showPassword}|{formatError({message: 'raw'})}
    </p>
  );
}

describe('FormConfigProvider', () => {
  it('gives English defaults outside a provider', () => {
    render(<Probe />);
    expect(
      screen.getByText(`${DEFAULT_FORM_LABELS.cancel}|${DEFAULT_FORM_LABELS.showPassword}|raw`),
    ).toBeInTheDocument();
  });

  it('merges partial labels over the defaults and uses the given formatError', () => {
    render(
      <FormConfigProvider labels={{cancel: 'Abbrechen'}} formatError={(issue) => `!${issue.message}`}>
        <Probe />
      </FormConfigProvider>,
    );
    expect(screen.getByText(`Abbrechen|${DEFAULT_FORM_LABELS.showPassword}|!raw`)).toBeInTheDocument();
  });
});
```

`packages/form/src/createAppForm.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';

import {useFieldContext} from './context';
import {createAppForm} from './createAppForm';

function EchoField({label}: {readonly label: string}) {
  const field = useFieldContext<string>();
  return <p>{`${label}: ${field.state.value}`}</p>;
}

const {useAppForm} = createAppForm({fieldComponents: {EchoField}, formComponents: {}});

function SignIn() {
  const form = useAppForm({defaultValues: {email: 'a@b.co'}});
  return <form.AppField name="email">{(field) => <field.EchoField label="Email" />}</form.AppField>;
}

function Unregistered() {
  const form = useAppForm({defaultValues: {email: 'x@y.co'}});
  return <form.AppField name="email">{() => <EchoField label="Plain" />}</form.AppField>;
}

describe('createAppForm', () => {
  it('renders a registered field through the package context', () => {
    render(<SignIn />);
    expect(screen.getByText('Email: a@b.co')).toBeInTheDocument();
  });

  it('lets an unregistered field render as a plain child of AppField', () => {
    render(<Unregistered />);
    expect(screen.getByText('Plain: x@y.co')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the tests to see them fail**

Run: `pnpm vitest run --project @vt-labs/form`
Expected: FAIL. `./index`, `./config/labels` and `./createAppForm` cannot be resolved.

- [ ] **Step 7: Write the implementation**

`packages/form/src/context.ts`:

```ts
import {createFormHookContexts} from '@tanstack/react-form';

/**
 * The package's only pair of form contexts. `createAppForm` hands them to
 * `createFormHook`, and every field reads them, so a consumer never creates a second pair.
 */
export const {fieldContext, formContext, useFieldContext, useFormContext} = createFormHookContexts();
```

`packages/form/src/config/labels.ts`:

```ts
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
```

`packages/form/src/config/FormConfigContext.tsx`:

```tsx
import type {StandardSchemaV1Issue} from '@tanstack/react-form';
import {createContext, useContext, useMemo} from 'react';
import type {ReactNode} from 'react';

import {DEFAULT_FORM_LABELS} from './labels';
import type {FormLabels} from './labels';

/**
 * Turns a validation issue into the sentence shown under a field. A plain string error is
 * handed over as `{message}`, so one function covers schema issues and hand-written
 * validators alike.
 */
export type FormatError = (issue: StandardSchemaV1Issue) => string;

interface FormConfig {
  readonly labels: FormLabels;
  readonly formatError: FormatError;
}

const defaultFormatError: FormatError = (issue) => issue.message;

/** The defaults are the context default, so a field outside any provider still reads real strings. */
const FormConfigContext = createContext<FormConfig>({labels: DEFAULT_FORM_LABELS, formatError: defaultFormatError});

interface FormConfigProviderProps {
  readonly labels?: Partial<FormLabels>;
  readonly formatError?: FormatError;
  readonly children: ReactNode;
}

export function FormConfigProvider({labels, formatError, children}: Readonly<FormConfigProviderProps>) {
  const value = useMemo<FormConfig>(
    () => ({
      labels: labels ? {...DEFAULT_FORM_LABELS, ...labels} : DEFAULT_FORM_LABELS,
      formatError: formatError ?? defaultFormatError,
    }),
    [labels, formatError],
  );

  return <FormConfigContext.Provider value={value}>{children}</FormConfigContext.Provider>;
}

export function useFormConfig(): FormConfig {
  return useContext(FormConfigContext);
}
```

`packages/form/src/createAppForm.ts`:

```ts
import {createFormHook} from '@tanstack/react-form';

import {fieldContext, formContext} from './context';

/** What `createFormHook` accepts as a component map, taken from its own signature. */
type ComponentMap = Parameters<typeof createFormHook>[0]['fieldComponents'];

/**
 * Builds the consumer's form hook on the package's contexts. Call it once per app, at
 * module level, and register only the fields that app uses: every registered component
 * is in the bundle, so heavy fields go in through `lazyField`.
 */
export function createAppForm<
  const TFieldComponents extends ComponentMap,
  const TFormComponents extends ComponentMap,
>(options: {readonly fieldComponents: TFieldComponents; readonly formComponents: TFormComponents}) {
  return createFormHook({
    fieldComponents: options.fieldComponents,
    formComponents: options.formComponents,
    fieldContext,
    formContext,
  });
}
```

`packages/form/src/index.ts`:

```ts
export {DEFAULT_FORM_LABELS} from './config/labels';
export type {FormLabels} from './config/labels';
export {FormConfigProvider} from './config/FormConfigContext';
export type {FormatError} from './config/FormConfigContext';
export {useFieldContext, useFormContext} from './context';
export {createAppForm} from './createAppForm';
```

`packages/form/src/pickers.ts`, `src/phone.ts` and `src/maps.ts` each start as:

```ts
// Filled in by its own task. The entry exists now so the build and the exports map
// cover all four from the start.
export {};
```

- [ ] **Step 8: Run the tests to see them pass**

Run: `pnpm vitest run --project @vt-labs/form`
Expected: PASS, 6 tests.

- [ ] **Step 9: Typecheck and build**

Run: `pnpm --filter @vt-labs/form typecheck && pnpm --filter @vt-labs/form build && ls packages/form/dist`
Expected: no type errors; `dist/` has `index.js`, `pickers.js`, `phone.js`, `maps.js` and a `.d.ts` beside each.

- [ ] **Step 10: Handoff**

Do not run git. Tell the user the files touched in this task and suggest:
`feat(form): scaffold @vt-labs/form with config provider and createAppForm`

---

### Task 2: The field contract (`useFieldBinding`, `FieldShell`) and `TextField`

**Files:**

- Create: `src/core/types.ts`, `src/core/issues.ts`, `src/core/valueChecks.ts`, `src/core/useFieldBinding.ts`, `src/core/FieldShell.tsx`, `src/core/InfoTooltip.tsx`, `src/core/icons.tsx`
- Create: `src/fields/TextField.tsx`, `src/fields/TextArea.tsx`
- Create: `src/test/FieldHarness.tsx`, `src/stories/TextFields.stories.tsx`
- Test: `src/core/issues.test.ts`, `src/fields/TextField.test.tsx`
- Modify: `src/index.ts`, `src/index.test.ts`

**Interfaces:**

- Consumes: `useFieldContext`, `useFormConfig` from Task 1.
- Produces, in `src/core/types.ts`:
  ```ts
  interface CommonFieldProps {
    label: string;
    description?: string;
    required?: boolean;
    tooltip?: string;
    disabled?: boolean;
    autoFocus?: boolean;
  }
  interface Option<V extends string | number> {
    value: V;
    label: string;
    disabled?: boolean;
    description?: string;
  }
  ```
- Produces, in `src/core/issues.ts`: `firstIssue(errors: readonly unknown[]): StandardSchemaV1Issue | null`.
- Produces, in `src/core/valueChecks.ts`: `interface ValueExpectation {test(value: unknown): boolean; description: string}` and the constants `STRING`, `BOOLEAN`, `NULLABLE_NUMBER`, `NULLABLE_SCALAR`, `SCALAR_ARRAY`.
- Produces, in `src/core/useFieldBinding.ts`:
  ```ts
  interface FieldBinding<T> {
    name: string;
    formId: string;
    inputId: string;
    labelId: string;
    helperId: string;
    value: T;
    error: string | null;
    setValue(value: T): void;
    onBlur(): void;
    inputProps: {
      'aria-describedby': string;
      'aria-invalid': boolean;
      'aria-required': boolean | undefined;
      'data-form-id': string;
    };
  }
  function useFieldBinding<T>(options?: {required?: boolean; expect?: ValueExpectation}): FieldBinding<T>;
  ```
  `setValue` also clears the field's server error; Task 4 fills that in through `clearServerError`.
- Produces, in `src/core/FieldShell.tsx`: `FieldShell({binding, label, description, required, tooltip, disabled, as = 'label', children})`, where `as` is `'label' | 'fieldset' | 'bare'`.
- Produces, in `src/test/FieldHarness.tsx`: `FieldHarness({defaultValue, validate?, onSubmit?, formRef?, children})`. It renders one field named `value`, a "Submit" button, and an `<output aria-label="Submitted value">`.

- [ ] **Step 1: Write the failing tests**

`packages/form/src/core/issues.test.ts`:

```ts
import {firstIssue} from './issues';

describe('firstIssue', () => {
  it('wraps a string error as an issue', () => {
    expect(firstIssue(['Required'])).toEqual({message: 'Required'});
  });

  it('returns the first issue object, skipping empty and unknown entries', () => {
    const issue = {message: 'Too short', path: ['name']};
    expect(firstIssue([undefined, '', {code: 'x'}, issue, 'later'])).toBe(issue);
  });

  it('looks one level into arrays, which is how schema validators report', () => {
    expect(firstIssue([[{message: 'Invalid email'}]])).toEqual({message: 'Invalid email'});
  });

  it('returns null when nothing is an error', () => {
    expect(firstIssue([undefined, null, ''])).toBeNull();
  });
});
```

`packages/form/src/fields/TextField.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {FormConfigProvider} from '../config/FormConfigContext';
import {FieldHarness} from '../test/FieldHarness';
import {TextArea} from './TextArea';
import {TextField} from './TextField';

const required = (value: unknown) => (value ? undefined : 'Required');

describe('TextField', () => {
  it('labels the input with a real label element and reports the value on submit', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue="">
        <TextField label="Email" type="email" />
      </FieldHarness>,
    );

    await user.type(screen.getByLabelText('Email'), 'a@b.co');
    await user.click(screen.getByRole('button', {name: 'Submit'}));

    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('"a@b.co"');
  });

  it('marks required with aria-required and a hidden asterisk', () => {
    render(
      <FieldHarness defaultValue="">
        <TextField label="Email" required />
      </FieldHarness>,
    );
    const input = screen.getByLabelText(/Email/);
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the description until an error replaces it, and wires aria-describedby to it', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue="" validate={required}>
        <TextField label="Name" description="As on your ID" />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAccessibleDescription('As on your ID');
    expect(input).toHaveAttribute('aria-invalid', 'false');

    await user.click(input);
    await user.tab();

    expect(input).toHaveAccessibleDescription('Required');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows no error before the field is touched', () => {
    render(
      <FieldHarness defaultValue="" validate={required}>
        <TextField label="Name" />
      </FieldHarness>,
    );
    expect(screen.queryByText('Required')).not.toBeInTheDocument();
  });

  it('passes the error through formatError', async () => {
    const user = userEvent.setup();
    render(
      <FormConfigProvider formatError={(issue) => `Sorry: ${issue.message}`}>
        <FieldHarness defaultValue="" validate={required}>
          <TextField label="Name" />
        </FieldHarness>
      </FormConfigProvider>,
    );
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(await screen.findByText('Sorry: Required')).toBeInTheDocument();
  });

  it('gives two fields with the same name different ids', () => {
    render(
      <>
        <FieldHarness defaultValue="">
          <TextField label="First" />
        </FieldHarness>
        <FieldHarness defaultValue="">
          <TextField label="Second" />
        </FieldHarness>
      </>,
    );
    expect(screen.getByLabelText('First').id).not.toBe(screen.getByLabelText('Second').id);
  });

  it('puts the tooltip behind a focusable button with an accessible name', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue="">
        <TextField label="Slug" tooltip="Used in the URL" />
      </FieldHarness>,
    );
    await user.tab();
    expect(screen.getByRole('button', {name: 'More information'})).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Used in the URL');
  });

  it('warns once in development when the value is not a string', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <FieldHarness defaultValue={42}>
        <TextField label="Name" />
      </FieldHarness>,
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('"value"');
  });
});

describe('TextArea', () => {
  it('renders a multiline textbox with at least three rows', () => {
    render(
      <FieldHarness defaultValue="">
        <TextArea label="Notes" />
      </FieldHarness>,
    );
    const box = screen.getByLabelText('Notes');
    expect(box.tagName).toBe('TEXTAREA');
    expect(box).toHaveAttribute('rows', '3');
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm vitest run --project @vt-labs/form src/core src/fields`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write the core**

`packages/form/src/core/types.ts`:

```ts
/** Props every field takes. Anything a user reads is a prop, so a consumer can translate it. */
export interface CommonFieldProps {
  /** Shown above the input and used as its accessible name. */
  readonly label: string;
  /** Helper text under the input. An error replaces it while one shows. */
  readonly description?: string;
  readonly required?: boolean;
  /** Extra context behind an info button beside the label. */
  readonly tooltip?: string;
  readonly disabled?: boolean;
  readonly autoFocus?: boolean;
}

/** One choice in a select, radio group or autocomplete. */
export interface Option<V extends string | number> {
  readonly value: V;
  readonly label: string;
  readonly disabled?: boolean;
  readonly description?: string;
}
```

`packages/form/src/core/issues.ts`:

```ts
import type {StandardSchemaV1Issue} from '@tanstack/react-form';

function isIssue(error: unknown): error is StandardSchemaV1Issue {
  return typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string';
}

/**
 * TanStack stores whatever a validator returned: a string from a hand-written check, an
 * issue object from a schema, sometimes an array of issues. This finds the first thing
 * that reads as an error and returns it as an issue.
 */
export function firstIssue(errors: readonly unknown[]): StandardSchemaV1Issue | null {
  for (const error of errors.flat()) {
    if (typeof error === 'string' && error !== '') return {message: error};
    if (isIssue(error)) return error;
  }
  return null;
}
```

`packages/form/src/core/valueChecks.ts`:

```ts
/**
 * TanStack Form cannot check that the component at a path matches the value type there,
 * so a field checks at runtime in development and warns once. Each constant is the check
 * and the words used in the warning.
 */
export interface ValueExpectation {
  readonly test: (value: unknown) => boolean;
  readonly description: string;
}

const isScalar = (value: unknown) => typeof value === 'string' || typeof value === 'number';

export const STRING: ValueExpectation = {test: (value) => typeof value === 'string', description: 'a string'};

export const BOOLEAN: ValueExpectation = {test: (value) => typeof value === 'boolean', description: 'a boolean'};

export const NULLABLE_NUMBER: ValueExpectation = {
  test: (value) => value === null || typeof value === 'number',
  description: 'a number or null',
};

export const NULLABLE_SCALAR: ValueExpectation = {
  test: (value) => value === null || isScalar(value),
  description: 'a string, a number or null',
};

export const SCALAR_ARRAY: ValueExpectation = {
  test: (value) => Array.isArray(value) && value.every(isScalar),
  description: 'an array of strings or numbers',
};

export function isDevelopment(): boolean {
  return typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
}

export function describeValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return `a ${typeof value}`;
}
```

`packages/form/src/core/useFieldBinding.ts`:

```ts
import {useStore} from '@tanstack/react-form';
import {useEffect, useId, useRef} from 'react';

import {useFormConfig} from '../config/FormConfigContext';
import {useFieldContext} from '../context';
import {clearServerError} from '../serverErrors';
import {firstIssue} from './issues';
import {describeValue, isDevelopment} from './valueChecks';
import type {ValueExpectation} from './valueChecks';

export interface FieldBinding<T> {
  readonly name: string;
  readonly formId: string;
  readonly inputId: string;
  readonly labelId: string;
  readonly helperId: string;
  readonly value: T;
  /** The formatted first error, or null while none should show. */
  readonly error: string | null;
  readonly setValue: (value: T) => void;
  readonly onBlur: () => void;
  /** Spread onto the element that takes focus. */
  readonly inputProps: {
    readonly 'aria-describedby': string;
    readonly 'aria-invalid': boolean;
    readonly 'aria-required': boolean | undefined;
    readonly 'data-form-id': string;
  };
}

interface FieldBindingOptions {
  readonly required?: boolean;
  readonly expect?: ValueExpectation;
}

/**
 * Everything a field needs from TanStack and the package, in one place: ids from `useId`,
 * the value, the error to show (touched and invalid, first error, through `formatError`),
 * and the aria wiring for the input. Exported so a consumer's own field follows the same
 * contract as the built-in ones.
 */
export function useFieldBinding<T>({required, expect}: FieldBindingOptions = {}): FieldBinding<T> {
  const field = useFieldContext<T>();
  const {formatError} = useFormConfig();
  const id = useId();
  const value = useStore(field.store, (state) => state.value);
  const isTouched = useStore(field.store, (state) => state.meta.isTouched);
  const errors = useStore(field.store, (state) => state.meta.errors);

  const issue = isTouched ? firstIssue(errors) : null;
  const error = issue ? formatError(issue) : null;
  const helperId = `${id}-helper`;

  useValueWarning(field.name, value, expect);

  return {
    name: field.name,
    formId: field.form.formId,
    inputId: `${id}-input`,
    labelId: `${id}-label`,
    helperId,
    value,
    error,
    setValue: (next) => {
      clearServerError(field);
      field.handleChange(next);
    },
    onBlur: field.handleBlur,
    inputProps: {
      'aria-describedby': helperId,
      'aria-invalid': error !== null,
      'aria-required': required || undefined,
      'data-form-id': field.form.formId,
    },
  };
}

function useValueWarning(name: string, value: unknown, expect: ValueExpectation | undefined) {
  const warned = useRef(false);
  useEffect(() => {
    if (!expect || warned.current || !isDevelopment() || expect.test(value)) return;
    warned.current = true;
    console.warn(
      `@vt-labs/form: field "${name}" holds ${describeValue(value)}, but the component rendered for it expects ${expect.description}.`,
    );
  }, [name, value, expect]);
}
```

`clearServerError` does not exist until Task 4. Create `packages/form/src/serverErrors.ts` now with only this function, and Task 4 adds `applyServerErrors` beside it:

```ts
import type {AnyFieldApi} from '@tanstack/react-form';

/**
 * A server error answers the value that was submitted, so it stops applying the moment
 * the user edits that field. TanStack does not clear it on its own, and while it stays
 * set the form cannot submit.
 */
export function clearServerError(field: AnyFieldApi): void {
  if (field.state.meta.errorMap.onServer === undefined) return;
  field.setMeta((meta) => ({...meta, errorMap: {...meta.errorMap, onServer: undefined}}));
}
```

`packages/form/src/core/icons.tsx`:

```tsx
import SvgIcon from '@mui/material/SvgIcon';
import type {SvgIconProps} from '@mui/material/SvgIcon';

// Paths from Material Icons (Apache 2.0), inlined so the package does not need
// `@mui/icons-material` as a peer for three glyphs.

export function InfoIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8" />
    </SvgIcon>
  );
}

export function VisibilityIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5M12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5m0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3" />
    </SvgIcon>
  );
}

export function VisibilityOffIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7M2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2m4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3z" />
    </SvgIcon>
  );
}
```

`packages/form/src/core/InfoTooltip.tsx`:

```tsx
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import {InfoIcon} from './icons';

interface InfoTooltipProps {
  readonly title: string;
  /** The button's accessible name. */
  readonly label: string;
}

/** A real button, so keyboard and touch users reach the tooltip the same way a mouse does. */
export function InfoTooltip({title, label}: InfoTooltipProps) {
  return (
    <Tooltip title={title} describeChild enterTouchDelay={0}>
      <IconButton size="small" aria-label={label} sx={{p: 0.25, color: 'text.secondary'}}>
        <InfoIcon fontSize="inherit" />
      </IconButton>
    </Tooltip>
  );
}
```

`packages/form/src/core/FieldShell.tsx`:

```tsx
import Box from '@mui/material/Box';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import type {ReactNode} from 'react';

import {useFormConfig} from '../config/FormConfigContext';
import {InfoTooltip} from './InfoTooltip';
import type {CommonFieldProps} from './types';
import type {FieldBinding} from './useFieldBinding';

export interface FieldShellProps extends Omit<CommonFieldProps, 'autoFocus'> {
  readonly binding: Pick<FieldBinding<unknown>, 'inputId' | 'labelId' | 'helperId' | 'error'>;
  /**
   * `label`: a `<label for>` above one input. `fieldset`: a `<legend>` over a group of
   * inputs (radio buttons, the two duration selects). `bare`: the child renders its own
   * label (checkbox, switch) and the shell adds only the helper row.
   */
  readonly as?: 'label' | 'fieldset' | 'bare';
  readonly children: ReactNode;
}

/**
 * The layout every field shares: label above, input, one helper row below that is always
 * there so the form does not jump when an error appears.
 */
export function FieldShell({
  binding,
  label,
  description,
  required,
  tooltip,
  disabled,
  as = 'label',
  children,
}: FieldShellProps) {
  const {labels} = useFormConfig();
  const hasError = binding.error !== null;
  const info = tooltip ? <InfoTooltip title={tooltip} label={labels.moreInfo} /> : null;

  const helper = (
    <FormHelperText id={binding.helperId} error={hasError} sx={{mx: 0}}>
      {binding.error ?? description ?? '​'}
    </FormHelperText>
  );

  if (as === 'fieldset') {
    return (
      <Box component="fieldset" sx={{border: 0, m: 0, p: 0, minWidth: 0}}>
        <FormLabel
          id={binding.labelId}
          component="legend"
          required={required}
          disabled={disabled}
          error={hasError}
          sx={{mb: 0.5}}
        >
          {label}
          {info}
        </FormLabel>
        {children}
        {helper}
      </Box>
    );
  }

  if (as === 'bare') {
    return (
      <Box>
        <Box sx={{display: 'flex', alignItems: 'center'}}>
          {children}
          {info}
        </Box>
        {helper}
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5}}>
        <FormLabel
          id={binding.labelId}
          htmlFor={binding.inputId}
          required={required}
          disabled={disabled}
          error={hasError}
        >
          {label}
        </FormLabel>
        {info}
      </Box>
      {children}
      {helper}
    </Box>
  );
}
```

`'​'` is a zero-width space. It gives the empty helper row one line of height without putting text on screen.

- [ ] **Step 4: Write the fields and the harness**

`packages/form/src/fields/TextField.tsx`:

```tsx
import MuiTextField from '@mui/material/TextField';

import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import {STRING} from '../core/valueChecks';

export interface TextFieldProps extends CommonFieldProps {
  readonly type?: 'text' | 'email' | 'url' | 'tel' | 'search';
  readonly placeholder?: string;
  readonly autoComplete?: string;
  readonly maxLength?: number;
  readonly multiline?: boolean;
  readonly minRows?: number;
  readonly maxRows?: number;
}

export function TextField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  type = 'text',
  placeholder,
  autoComplete,
  maxLength,
  multiline,
  minRows,
  maxRows,
}: Readonly<TextFieldProps>) {
  const binding = useFieldBinding<string>({required, expect: STRING});

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <MuiTextField
        id={binding.inputId}
        value={binding.value ?? ''}
        onChange={(event) => binding.setValue(event.target.value)}
        onBlur={binding.onBlur}
        error={binding.error !== null}
        disabled={disabled}
        autoFocus={autoFocus}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        multiline={multiline}
        minRows={minRows}
        maxRows={maxRows}
        fullWidth
        slotProps={{htmlInput: {...binding.inputProps, maxLength}}}
      />
    </FieldShell>
  );
}
```

`packages/form/src/fields/TextArea.tsx`:

```tsx
import {TextField} from './TextField';
import type {TextFieldProps} from './TextField';

export type TextAreaProps = Omit<TextFieldProps, 'multiline' | 'type'>;

/** `TextField` with `multiline` on and three rows to start. */
export function TextArea({minRows = 3, ...props}: Readonly<TextAreaProps>) {
  return <TextField {...props} multiline minRows={minRows} />;
}
```

`packages/form/src/test/FieldHarness.tsx`:

```tsx
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import type {AnyFormApi} from '@tanstack/react-form';
import {useEffect, useState} from 'react';
import type {ReactNode, RefObject} from 'react';

import {createAppForm} from '../createAppForm';

const {useAppForm} = createAppForm({fieldComponents: {}, formComponents: {}});

export interface FieldHarnessProps {
  readonly defaultValue: unknown;
  /** Runs on blur and on submit. Return a message to fail. */
  readonly validate?: (value: unknown) => string | undefined;
  readonly onSubmit?: (value: unknown) => void;
  /** Receives the form API, for tests that call `applyServerErrors` or `reset`. */
  readonly formRef?: RefObject<AnyFormApi | null>;
  readonly children: ReactNode;
}

/**
 * One field named `value` in a real TanStack form, a submit button, and the last
 * submitted value printed as JSON. The tests and the stories both render through it, so a
 * story shows exactly what the tests assert.
 */
export function FieldHarness({defaultValue, validate, onSubmit, formRef, children}: FieldHarnessProps) {
  const [submitted, setSubmitted] = useState('');
  const form = useAppForm({
    defaultValues: {value: defaultValue},
    onSubmit: ({value}) => {
      setSubmitted(JSON.stringify(value.value));
      onSubmit?.(value.value);
    },
  });

  useEffect(() => {
    if (formRef) formRef.current = form;
  }, [form, formRef]);

  return (
    <Box
      component="form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      sx={{maxWidth: 420}}
    >
      <Stack spacing={1}>
        <form.AppField
          name="value"
          validators={{onBlur: ({value}) => validate?.(value), onSubmit: ({value}) => validate?.(value)}}
        >
          {() => children}
        </form.AppField>
        <Box>
          <Button type="submit" variant="contained">
            Submit
          </Button>
        </Box>
        <output aria-label="Submitted value">{submitted}</output>
      </Stack>
    </Box>
  );
}
```

`packages/form/src/stories/TextFields.stories.tsx`:

```tsx
import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, userEvent, within} from 'storybook/test';

import {TextArea} from '../fields/TextArea';
import {TextField} from '../fields/TextField';
import {FieldHarness} from '../test/FieldHarness';

const meta = {
  title: 'Form/Text fields',
  component: TextField,
  tags: ['autodocs'],
  args: {label: 'Email', description: 'We only use it to sign you in', required: true, tooltip: 'Your work address'},
  render: (args) => (
    <FieldHarness defaultValue="" validate={(value) => (value ? undefined : 'Enter your email')}>
      <TextField {...args} type="email" />
    </FieldHarness>
  ),
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Blur an empty required field and the description gives way to the error. */
export const Default: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText(/Email/);
    await userEvent.click(input);
    await userEvent.tab();
    await expect(input).toHaveAccessibleDescription('Enter your email');
    await userEvent.type(input, 'ada@example.com');
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('"ada@example.com"');
  },
};

/** `TextArea` is `TextField` with `multiline` and three rows to start. */
export const Area: Story = {
  render: () => (
    <FieldHarness defaultValue="">
      <TextArea label="Notes" />
    </FieldHarness>
  ),
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Notes'), 'Line one{enter}Line two');
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('"Line one\\nLine two"');
  },
};
```

- [ ] **Step 5: Export and pin**

Add to `src/index.ts`:

```ts
export {FieldShell} from './core/FieldShell';
export type {FieldShellProps} from './core/FieldShell';
export type {CommonFieldProps, Option} from './core/types';
export {useFieldBinding} from './core/useFieldBinding';
export type {FieldBinding} from './core/useFieldBinding';
export {TextArea} from './fields/TextArea';
export type {TextAreaProps} from './fields/TextArea';
export {TextField} from './fields/TextField';
export type {TextFieldProps} from './fields/TextField';
```

In `src/index.test.ts`, `ROOT_API` becomes:

```ts
const ROOT_API = [
  'DEFAULT_FORM_LABELS',
  'FieldShell',
  'FormConfigProvider',
  'TextArea',
  'TextField',
  'createAppForm',
  'useFieldBinding',
  'useFieldContext',
  'useFormContext',
];
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `pnpm vitest run --project @vt-labs/form`
Expected: PASS. If `toHaveAccessibleDescription` fails because MUI's `InputBase` writes its own `aria-describedby` over the one in `slotProps.htmlInput`, read the rendered attribute with `screen.debug()`. Then pass `aria-describedby` through `slotProps.input` instead; the test stays as written.

- [ ] **Step 7: Run the story**

Run: `pnpm vitest run --project storybook packages/form`
Expected: PASS for `Form/Text fields` (Default, Area) with no axe violations.

- [ ] **Step 8: Handoff**

Do not run git. Suggested message: `feat(form): add the field contract, TextField and TextArea`

---

### Task 3: `PasswordField` and `NumberField`

**Files:**

- Create: `src/fields/PasswordField.tsx`, `src/fields/NumberField.tsx`, `src/stories/PasswordAndNumber.stories.tsx`
- Test: `src/fields/PasswordField.test.tsx`, `src/fields/NumberField.test.tsx`
- Modify: `src/index.ts`, `src/index.test.ts`

**Interfaces:**

- Consumes: `useFieldBinding`, `FieldShell`, `CommonFieldProps`, `STRING`, `NULLABLE_NUMBER`, `VisibilityIcon`, `VisibilityOffIcon`, `useFormConfig`, `FieldHarness` (Tasks 1 and 2).
- Produces: `PasswordField(props: PasswordFieldProps)` with `autoComplete?: 'current-password' | 'new-password'` (default `'current-password'`) and `placeholder?`. `NumberField(props: NumberFieldProps)` with `decimalSeparator?: '.' | ','` (default `'.'`), `allowDecimals?: boolean` (default `true`) and `placeholder?`.

`NumberField` takes no `min`, `max` or `step`. They do nothing on a text input, and range rules belong to the schema, where the error message lives. It is a text input rather than `type="number"` because a number input accepts `e`, silently drops a comma under an English locale, and changes value on scroll.

- [ ] **Step 1: Write the failing tests**

`packages/form/src/fields/PasswordField.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {FormConfigProvider} from '../config/FormConfigContext';
import {FieldHarness} from '../test/FieldHarness';
import {PasswordField} from './PasswordField';

describe('PasswordField', () => {
  it('hides the value until the toggle is pressed, and the toggle names what it will do', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue="">
        <PasswordField label="Password" />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'current-password');

    await user.click(screen.getByRole('button', {name: 'Show password'}));
    expect(input).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', {name: 'Hide password'}));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('takes the toggle text from the labels', () => {
    render(
      <FormConfigProvider labels={{showPassword: 'Passwort anzeigen'}}>
        <FieldHarness defaultValue="">
          <PasswordField label="Passwort" />
        </FieldHarness>
      </FormConfigProvider>,
    );
    expect(screen.getByRole('button', {name: 'Passwort anzeigen'})).toBeInTheDocument();
  });

  it('submits what was typed', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue="">
        <PasswordField label="Password" autoComplete="new-password" />
      </FieldHarness>,
    );
    await user.type(screen.getByLabelText('Password'), 's3cret!');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('"s3cret!"');
  });
});
```

`packages/form/src/fields/NumberField.test.tsx`:

```tsx
import type {AnyFormApi} from '@tanstack/react-form';
import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createRef} from 'react';

import {FieldHarness} from '../test/FieldHarness';
import {NumberField} from './NumberField';

async function submitted(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', {name: 'Submit'}));
  return screen.getByLabelText('Submitted value').textContent;
}

describe('NumberField', () => {
  it('stores a number, and null when empty', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <NumberField label="Price" />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Price');
    expect(input).toHaveAttribute('inputmode', 'decimal');

    await user.type(input, '12.50');
    expect(await submitted(user)).toBe('12.5');

    await user.clear(input);
    expect(await submitted(user)).toBe('null');
  });

  it('reads and writes a comma when decimalSeparator is a comma', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={3.25}>
        <NumberField label="Price" decimalSeparator="," />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Price');
    expect(input).toHaveValue('3,25');

    await user.clear(input);
    await user.type(input, '7,5');
    expect(await submitted(user)).toBe('7.5');
  });

  it('keeps a half-typed number on screen', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <NumberField label="Price" />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Price');
    await user.type(input, '-');
    expect(input).toHaveValue('-');
    await user.type(input, '4.');
    expect(input).toHaveValue('-4.');
    expect(await submitted(user)).toBe('-4');
  });

  it('ignores keystrokes that cannot be part of a number', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <NumberField label="Quantity" allowDecimals={false} />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Quantity');
    await user.type(input, '1a2.e3');
    expect(input).toHaveValue('123');
  });

  it('shows a value set from outside, replacing what was typed', async () => {
    const user = userEvent.setup();
    const formRef = createRef<AnyFormApi>();
    render(
      <FieldHarness defaultValue={null} formRef={formRef}>
        <NumberField label="Price" />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Price');
    await user.type(input, '5.');

    act(() => formRef.current?.setFieldValue('value', 42));
    expect(input).toHaveValue('42');

    act(() => formRef.current?.reset());
    expect(input).toHaveValue('');
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm vitest run --project @vt-labs/form src/fields/PasswordField src/fields/NumberField`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write `PasswordField`**

`packages/form/src/fields/PasswordField.tsx`:

```tsx
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MuiTextField from '@mui/material/TextField';
import {useState} from 'react';

import {useFormConfig} from '../config/FormConfigContext';
import {FieldShell} from '../core/FieldShell';
import {VisibilityIcon, VisibilityOffIcon} from '../core/icons';
import type {CommonFieldProps} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import {STRING} from '../core/valueChecks';

export interface PasswordFieldProps extends CommonFieldProps {
  /** `new-password` on sign-up and reset screens, so the browser offers to generate one. */
  readonly autoComplete?: 'current-password' | 'new-password';
  readonly placeholder?: string;
}

export function PasswordField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  autoComplete = 'current-password',
  placeholder,
}: Readonly<PasswordFieldProps>) {
  const binding = useFieldBinding<string>({required, expect: STRING});
  const {labels} = useFormConfig();
  const [visible, setVisible] = useState(false);

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <MuiTextField
        id={binding.inputId}
        value={binding.value ?? ''}
        onChange={(event) => binding.setValue(event.target.value)}
        onBlur={binding.onBlur}
        error={binding.error !== null}
        disabled={disabled}
        autoFocus={autoFocus}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        fullWidth
        slotProps={{
          htmlInput: binding.inputProps,
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  edge="end"
                  disabled={disabled}
                  aria-label={visible ? labels.hidePassword : labels.showPassword}
                  onClick={() => setVisible((current) => !current)}
                >
                  {visible ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
    </FieldShell>
  );
}
```

- [ ] **Step 4: Write `NumberField`**

`packages/form/src/fields/NumberField.tsx`:

```tsx
import MuiTextField from '@mui/material/TextField';
import {useState} from 'react';

import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import {NULLABLE_NUMBER} from '../core/valueChecks';

export interface NumberFieldProps extends CommonFieldProps {
  /** The character the user types and sees. The form value is always a plain number. */
  readonly decimalSeparator?: '.' | ',';
  readonly allowDecimals?: boolean;
  readonly placeholder?: string;
}

function toText(value: number | null, separator: string): string {
  return value === null || !Number.isFinite(value) ? '' : String(value).replace('.', separator);
}

/** The value the text stands for, or null while it is empty or not yet a number (`-`, `.`). */
function toNumber(text: string, separator: string): number | null {
  const normalised = text.replace(separator, '.');
  if (normalised === '' || normalised === '-' || normalised === '.' || normalised === '-.') return null;
  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : null;
}

export function NumberField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  decimalSeparator = '.',
  allowDecimals = true,
  placeholder,
}: Readonly<NumberFieldProps>) {
  const binding = useFieldBinding<number | null>({required, expect: NULLABLE_NUMBER});
  const value = typeof binding.value === 'number' ? binding.value : null;

  // What the user typed, kept apart from the form value so `4.` and `-` survive a render.
  // When the form value changes from outside (reset, a loaded record), the text follows it.
  const [text, setText] = useState(() => toText(value, decimalSeparator));
  const [shownValue, setShownValue] = useState(value);
  if (value !== shownValue) {
    setShownValue(value);
    setText(toText(value, decimalSeparator));
  }

  const escaped = decimalSeparator === '.' ? '\\.' : ',';
  const accepted = new RegExp(allowDecimals ? `^-?\\d*(${escaped}\\d*)?$` : '^-?\\d*$');

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <MuiTextField
        id={binding.inputId}
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          if (!accepted.test(next)) return;
          const parsed = toNumber(next, decimalSeparator);
          setText(next);
          setShownValue(parsed);
          binding.setValue(parsed);
        }}
        onBlur={binding.onBlur}
        error={binding.error !== null}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        fullWidth
        slotProps={{htmlInput: {...binding.inputProps, inputMode: allowDecimals ? 'decimal' : 'numeric'}}}
      />
    </FieldShell>
  );
}
```

`user.type(input, '1a2.e3')` fires one change per key; a key that would make the text invalid is dropped by the `accepted` test, so the input ends at `123`.

- [ ] **Step 5: Export and pin**

Add to `src/index.ts`:

```ts
export {NumberField} from './fields/NumberField';
export type {NumberFieldProps} from './fields/NumberField';
export {PasswordField} from './fields/PasswordField';
export type {PasswordFieldProps} from './fields/PasswordField';
```

Add `'NumberField'` and `'PasswordField'` to `ROOT_API` in `src/index.test.ts`, keeping the list alphabetical.

- [ ] **Step 6: Write the story**

`packages/form/src/stories/PasswordAndNumber.stories.tsx`:

```tsx
import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, userEvent, within} from 'storybook/test';

import {NumberField} from '../fields/NumberField';
import {PasswordField} from '../fields/PasswordField';
import {FieldHarness} from '../test/FieldHarness';

const meta = {
  title: 'Form/Password and number',
  component: PasswordField,
  tags: ['autodocs'],
  args: {label: 'Password', required: true},
  render: (args) => (
    <FieldHarness defaultValue="">
      <PasswordField {...args} />
    </FieldHarness>
  ),
} satisfies Meta<typeof PasswordField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The toggle's name says what pressing it will do. */
export const Password: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText(/Password/);
    await userEvent.type(input, 'hunter2');
    await userEvent.click(canvas.getByRole('button', {name: 'Show password'}));
    await expect(input).toHaveAttribute('type', 'text');
  },
};

/** A comma separator on screen, a plain number in the form. */
export const Number: Story = {
  render: () => (
    <FieldHarness defaultValue={null}>
      <NumberField label="Price" decimalSeparator="," description="In euros" />
    </FieldHarness>
  ),
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Price'), '19,99');
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('19.99');
  },
};
```

- [ ] **Step 7: Run the tests and the stories**

Run: `pnpm vitest run --project @vt-labs/form && pnpm vitest run --project storybook packages/form`
Expected: PASS.

- [ ] **Step 8: Handoff**

Do not run git. Suggested message: `feat(form): add PasswordField and NumberField`

---

### Task 4: Server errors, form buttons, and focus on an invalid submit

**Files:**

- Modify: `src/serverErrors.ts` (add `applyServerErrors`), `src/createAppForm.ts` (wrap `useAppForm`)
- Create: `src/focusFirstInvalid.ts`, `src/form/SubmitButton.tsx`, `src/form/CancelButton.tsx`, `src/form/FormError.tsx`, `src/stories/FormActions.stories.tsx`
- Test: `src/serverErrors.test.tsx`, `src/focusFirstInvalid.test.tsx`, `src/form/formComponents.test.tsx`
- Modify: `src/index.ts`, `src/index.test.ts`

**Interfaces:**

- Consumes: `clearServerError` and `useFieldBinding` (Task 2), `firstIssue` (Task 2), `useFormContext` (Task 1).
- Produces:
  ```ts
  interface ServerErrors {fields?: Readonly<Record<string, string>>; form?: string}
  function applyServerErrors(form: AnyFormApi, errors: ServerErrors): void
  function focusFirstInvalid(form: AnyFormApi): void   // internal, not exported
  SubmitButton({children, submittingLabel?, variant?, fullWidth?})
  CancelButton({onCancel, confirm?, children?, variant?})
  FormError()
  ```
- `createAppForm`'s `useAppForm` now defaults `onSubmitInvalid` to `focusFirstInvalid`. A form that passes its own `onSubmitInvalid` replaces it.

What TanStack Form 1.33 does with the `onServer` slot, checked against form-core 1.33.5 before writing this task:

- A field's `onServer` error set through `setFieldMeta` is **not** cleared by TanStack on change, on blur, or when another field changes. While it is set, `canSubmit` is false and `handleSubmit` goes straight to `onSubmitInvalid`. That is why `useFieldBinding.setValue` clears it (Task 2).
- A form-level `onServer` error set through `setErrorMap` **is** cleared on any field change and on submit.
- `form.getFieldInfo(name).instance` is null when no field is mounted at `name`.

- [ ] **Step 1: Write the failing tests**

`packages/form/src/serverErrors.test.tsx`:

```tsx
import type {AnyFormApi} from '@tanstack/react-form';
import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createRef, useEffect} from 'react';
import type {RefObject} from 'react';

import {createAppForm} from './createAppForm';
import {TextField} from './fields/TextField';
import {FormError} from './form/FormError';
import {applyServerErrors} from './serverErrors';
import {FieldHarness} from './test/FieldHarness';

describe('applyServerErrors on a field', () => {
  function setup() {
    const user = userEvent.setup();
    const formRef = createRef<AnyFormApi>();
    const onSubmit = vi.fn();
    render(
      <FieldHarness defaultValue="ada@example.com" formRef={formRef} onSubmit={onSubmit}>
        <TextField label="Email" />
      </FieldHarness>,
    );
    act(() => applyServerErrors(formRef.current!, {fields: {value: 'Already invited'}}));
    return {user, onSubmit, input: screen.getByLabelText('Email')};
  }

  it('shows the message without the user touching the field', () => {
    const {input} = setup();
    expect(input).toHaveAccessibleDescription('Already invited');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('blocks a resubmit of the same value', async () => {
    const {user, onSubmit} = setup();
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears on the next edit, and the form submits again', async () => {
    const {user, onSubmit, input} = setup();
    await user.type(input, 'x');
    expect(screen.queryByText('Already invited')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(onSubmit).toHaveBeenCalledWith('ada@example.comx');
  });
});

const {useAppForm} = createAppForm({fieldComponents: {TextField}, formComponents: {FormError}});

function Profile({formRef}: {readonly formRef: RefObject<AnyFormApi | null>}) {
  const form = useAppForm({defaultValues: {name: 'Ada', address: {zip: ''}}});
  useEffect(() => {
    formRef.current = form;
  }, [form, formRef]);
  return (
    <form.AppForm>
      <form.AppField name="name">{(field) => <field.TextField label="Name" />}</form.AppField>
      <form.FormError />
    </form.AppForm>
  );
}

describe('applyServerErrors on the form', () => {
  it('shows the form message in FormError, and clears it on the next edit', async () => {
    const user = userEvent.setup();
    const formRef = createRef<AnyFormApi>();
    render(<Profile formRef={formRef} />);

    act(() => applyServerErrors(formRef.current!, {form: 'Could not save'}));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');

    await user.type(screen.getByLabelText('Name'), 'x');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps a message for a field that is not on screen by adding it to the form message', () => {
    const formRef = createRef<AnyFormApi>();
    render(<Profile formRef={formRef} />);

    act(() =>
      applyServerErrors(formRef.current!, {form: 'Could not save.', fields: {'address.zip': 'Unknown postcode.'}}),
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Could not save. Unknown postcode.');
  });
});
```

The non-null assertions (`formRef.current!`) are safe here: the harness sets the ref in an effect, and `render` flushes effects before it returns. If oxlint's `no-non-null-assertion` flags them, replace each with a local `const form = formRef.current; if (!form) throw new Error('form not mounted');`.

`packages/form/src/focusFirstInvalid.test.tsx`:

```tsx
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {TextField} from './fields/TextField';
import {FieldHarness} from './test/FieldHarness';

const required = (value: unknown) => (value ? undefined : 'Required');

describe('an invalid submit', () => {
  it('focuses the invalid field of the form that was submitted, not another form on the page', async () => {
    const user = userEvent.setup();
    render(
      <>
        <section aria-label="Form A">
          <FieldHarness defaultValue="" validate={required}>
            <TextField label="A name" />
          </FieldHarness>
        </section>
        <section aria-label="Form B">
          <FieldHarness defaultValue="" validate={required}>
            <TextField label="B name" />
          </FieldHarness>
        </section>
      </>,
    );

    // Make form A invalid and visible first, so a query that ignored the form id would pick it.
    await user.click(screen.getByLabelText('A name'));
    await user.tab();
    expect(screen.getByLabelText('A name')).toHaveAttribute('aria-invalid', 'true');

    const [, submitB] = screen.getAllByRole('button', {name: 'Submit'});
    await user.click(submitB!);

    await waitFor(() => expect(screen.getByLabelText('B name')).toHaveFocus());
  });
});
```

`packages/form/src/form/formComponents.test.tsx`:

```tsx
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {createAppForm} from '../createAppForm';
import {TextField} from '../fields/TextField';
import {CancelButton} from './CancelButton';
import {SubmitButton} from './SubmitButton';

const {useAppForm} = createAppForm({fieldComponents: {TextField}, formComponents: {SubmitButton, CancelButton}});

interface EditorProps {
  readonly onSubmit?: () => Promise<void>;
  readonly onCancel?: () => void;
  readonly confirm?: () => Promise<boolean>;
}

function Editor({onSubmit = async () => {}, onCancel = () => {}, confirm}: EditorProps) {
  const form = useAppForm({defaultValues: {name: ''}, onSubmit});
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="name">{(field) => <field.TextField label="Name" />}</form.AppField>
      <form.AppForm>
        <form.SubmitButton submittingLabel="Saving…">Save</form.SubmitButton>
        <form.CancelButton onCancel={onCancel} confirm={confirm} />
      </form.AppForm>
    </form>
  );
}

describe('SubmitButton', () => {
  it('stays enabled while the form is invalid', () => {
    render(<Editor />);
    expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();
  });

  it('is disabled and busy while submitting, then returns', async () => {
    const user = userEvent.setup();
    let finish = () => {};
    const onSubmit = () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      });
    render(<Editor onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', {name: 'Save'}));
    const busy = screen.getByRole('button', {name: 'Saving…'});
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');

    finish();
    expect(await screen.findByRole('button', {name: 'Save'})).toBeEnabled();
  });
});

describe('CancelButton', () => {
  it('cancels a pristine form without asking', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const confirm = vi.fn(async () => false);
    render(<Editor onCancel={onCancel} confirm={confirm} />);

    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(confirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('asks before throwing away edits, and respects a no', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const confirm = vi.fn(async () => false);
    render(<Editor onCancel={onCancel} confirm={confirm} />);

    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.click(screen.getByRole('button', {name: 'Cancel'}));

    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels a dirty form once the user confirms', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Editor onCancel={onCancel} confirm={async () => true} />);

    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.click(screen.getByRole('button', {name: 'Cancel'}));

    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm vitest run --project @vt-labs/form src/serverErrors src/focusFirstInvalid src/form`
Expected: FAIL. `applyServerErrors`, `FormError`, `SubmitButton` and `CancelButton` do not exist, and the focus test times out because nothing moves focus.

- [ ] **Step 3: Write `applyServerErrors`**

Append to `packages/form/src/serverErrors.ts`:

```ts
import type {AnyFormApi} from '@tanstack/react-form';

export interface ServerErrors {
  /** Messages keyed by TanStack field path (`email`, `items[0].name`). */
  readonly fields?: Readonly<Record<string, string>>;
  /** A message about the whole submission, shown by `FormError`. */
  readonly form?: string;
}

/**
 * Puts a backend's rejection on screen. Turning a response body into this shape is the
 * consumer's job; the package knows no response format.
 *
 * A message for a path with no mounted field is added to the form message instead of
 * being dropped, so the user always sees why the save failed.
 */
export function applyServerErrors(form: AnyFormApi, errors: ServerErrors): void {
  const unplaced: string[] = [];

  for (const [name, message] of Object.entries(errors.fields ?? {})) {
    if (!form.getFieldInfo(name).instance) {
      unplaced.push(message);
      continue;
    }
    // Touched, because an error only shows on a touched field and the user may never
    // have been in this one.
    form.setFieldMeta(name, (meta) => ({...meta, isTouched: true, errorMap: {...meta.errorMap, onServer: message}}));
  }

  const formMessage = [errors.form, ...unplaced].filter(Boolean).join(' ');
  form.setErrorMap({onServer: formMessage === '' ? undefined : formMessage});
}
```

Merge the two `import type` lines from `@tanstack/react-form` at the top of the file into one.

- [ ] **Step 4: Write `focusFirstInvalid` and wire it into `createAppForm`**

`packages/form/src/focusFirstInvalid.ts`:

```ts
import type {AnyFormApi} from '@tanstack/react-form';

const FOCUSABLE =
  'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Moves focus to the first field of this form that shows an error, so a keyboard or
 * screen reader user lands on the problem instead of on a submit button that did nothing.
 *
 * It waits a tick because the errors TanStack just set have not rendered yet. Fields mark
 * their input with `data-form-id`, which keeps a second form on the page out of it; the
 * comparison is done in JavaScript because `CSS.escape` is missing in some test DOMs and
 * `useId` output needs escaping in a selector.
 */
export function focusFirstInvalid(form: AnyFormApi): void {
  setTimeout(() => {
    const candidates = document.querySelectorAll<HTMLElement>('[aria-invalid="true"][data-form-id]');
    const invalid = Array.from(candidates).find((element) => element.dataset.formId === form.formId);
    if (!invalid) return;
    // A radio group marks its container; focus goes to its first radio.
    const target = invalid.matches(FOCUSABLE) ? invalid : invalid.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
  }, 0);
}
```

Replace `createAppForm` in `packages/form/src/createAppForm.ts`:

```ts
import {createFormHook} from '@tanstack/react-form';

import {fieldContext, formContext} from './context';
import {focusFirstInvalid} from './focusFirstInvalid';

/** What `createFormHook` accepts as a component map, taken from its own signature. */
type ComponentMap = Parameters<typeof createFormHook>[0]['fieldComponents'];

/**
 * Builds the consumer's form hook on the package's contexts. Call it once per app, at
 * module level, and register only the fields that app uses: every registered component
 * is in the bundle, so heavy fields go in through `lazyField`.
 *
 * The returned `useAppForm` focuses the first invalid field when a submit fails. A form
 * that passes its own `onSubmitInvalid` replaces that.
 */
export function createAppForm<
  const TFieldComponents extends ComponentMap,
  const TFormComponents extends ComponentMap,
>(options: {readonly fieldComponents: TFieldComponents; readonly formComponents: TFormComponents}) {
  const hook = createFormHook({
    fieldComponents: options.fieldComponents,
    formComponents: options.formComponents,
    fieldContext,
    formContext,
  });

  const useAppForm: typeof hook.useAppForm = (props) =>
    hook.useAppForm({onSubmitInvalid: ({formApi}) => focusFirstInvalid(formApi), ...props});

  return {...hook, useAppForm};
}
```

- [ ] **Step 5: Write the form components**

`packages/form/src/form/SubmitButton.tsx`:

```tsx
import Button from '@mui/material/Button';
import type {ButtonProps} from '@mui/material/Button';
import {useStore} from '@tanstack/react-form';
import type {ReactNode} from 'react';

import {useFormContext} from '../context';

export interface SubmitButtonProps {
  readonly children: ReactNode;
  /** Replaces the children while the submit runs. */
  readonly submittingLabel?: ReactNode;
  readonly variant?: ButtonProps['variant'];
  readonly fullWidth?: boolean;
}

/**
 * Never disabled for an invalid form: a disabled button tells nobody why, and pressing it
 * is how the user gets every error shown and focus moved to the first one.
 */
export function SubmitButton({
  children,
  submittingLabel,
  variant = 'contained',
  fullWidth,
}: Readonly<SubmitButtonProps>) {
  const form = useFormContext();
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <Button type="submit" variant={variant} fullWidth={fullWidth} disabled={isSubmitting} aria-busy={isSubmitting}>
      {isSubmitting && submittingLabel !== undefined ? submittingLabel : children}
    </Button>
  );
}
```

`packages/form/src/form/CancelButton.tsx`:

```tsx
import Button from '@mui/material/Button';
import type {ButtonProps} from '@mui/material/Button';
import {useStore} from '@tanstack/react-form';
import type {ReactNode} from 'react';

import {useFormConfig} from '../config/FormConfigContext';
import {useFormContext} from '../context';

export interface CancelButtonProps {
  /** Leave the screen, close the dialog. Called after `confirm` says yes, or at once on a pristine form. */
  readonly onCancel: () => void;
  /** Asked only when the form has edits. Bring your own dialog; the package renders none. */
  readonly confirm?: () => Promise<boolean>;
  /** Defaults to the `cancel` label. */
  readonly children?: ReactNode;
  readonly variant?: ButtonProps['variant'];
}

export function CancelButton({onCancel, confirm, children, variant = 'text'}: Readonly<CancelButtonProps>) {
  const form = useFormContext();
  const {labels} = useFormConfig();
  const isDirty = useStore(form.store, (state) => state.isDirty);

  const handleClick = async () => {
    if (isDirty && confirm && !(await confirm())) return;
    onCancel();
  };

  return (
    <Button type="button" variant={variant} onClick={() => void handleClick()}>
      {children ?? labels.cancel}
    </Button>
  );
}
```

`packages/form/src/form/FormError.tsx`:

```tsx
import Alert from '@mui/material/Alert';
import {useStore} from '@tanstack/react-form';

import {useFormConfig} from '../config/FormConfigContext';
import {useFormContext} from '../context';
import {firstIssue} from '../core/issues';

/** The form-level message from `applyServerErrors`, or nothing. */
export function FormError() {
  const form = useFormContext();
  const {formatError} = useFormConfig();
  const serverError = useStore(form.store, (state) => state.errorMap.onServer);
  const issue = firstIssue([serverError]);
  if (!issue) return null;

  return (
    <Alert severity="error" role="alert">
      {formatError(issue)}
    </Alert>
  );
}
```

- [ ] **Step 6: Export and pin**

Add to `src/index.ts`:

```ts
export {CancelButton} from './form/CancelButton';
export type {CancelButtonProps} from './form/CancelButton';
export {FormError} from './form/FormError';
export {SubmitButton} from './form/SubmitButton';
export type {SubmitButtonProps} from './form/SubmitButton';
export {applyServerErrors} from './serverErrors';
export type {ServerErrors} from './serverErrors';
```

Add `'CancelButton'`, `'FormError'`, `'SubmitButton'` and `'applyServerErrors'` to `ROOT_API`, alphabetical (upper case sorts before lower case, matching `Array.prototype.sort`).

- [ ] **Step 7: Run the tests to see them pass**

Run: `pnpm vitest run --project @vt-labs/form`
Expected: PASS. If `setErrorMap` or `getFieldInfo` rejects a plain `string` key under `AnyFormApi`, the fix is in the parameter type of `applyServerErrors`, never a cast: check what `AnyFormApi['getFieldInfo']` accepts with `tsc` and say which type you used in the handoff.

- [ ] **Step 8: Write the story**

`packages/form/src/stories/FormActions.stories.tsx`:

```tsx
import Stack from '@mui/material/Stack';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, fn, userEvent, waitFor, within} from 'storybook/test';

import {createAppForm} from '../createAppForm';
import {TextField} from '../fields/TextField';
import {CancelButton} from '../form/CancelButton';
import {FormError} from '../form/FormError';
import {SubmitButton} from '../form/SubmitButton';
import {applyServerErrors} from '../serverErrors';

const {useAppForm} = createAppForm({
  fieldComponents: {TextField},
  formComponents: {SubmitButton, CancelButton, FormError},
});

interface InviteProps {
  readonly onCancel: () => void;
}

/** Submitting shows the server's answer: one field error and one form error. */
function Invite({onCancel}: InviteProps) {
  const form = useAppForm({
    defaultValues: {email: ''},
    validators: {onSubmit: ({value}) => (value.email ? undefined : {fields: {email: 'Enter an email address'}})},
    onSubmit: async ({formApi}) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      applyServerErrors(formApi, {fields: {email: 'Already invited'}, form: 'Nothing was sent.'});
    },
  });

  return (
    <Stack
      component="form"
      spacing={1}
      noValidate
      sx={{maxWidth: 420}}
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="email">{(field) => <field.TextField label="Email" required />}</form.AppField>
      <form.AppForm>
        <form.FormError />
        <Stack direction="row" spacing={1}>
          <form.SubmitButton submittingLabel="Sending…">Send invite</form.SubmitButton>
          <form.CancelButton onCancel={onCancel} />
        </Stack>
      </form.AppForm>
    </Stack>
  );
}

const meta = {
  title: 'Form/Actions and server errors',
  component: Invite,
  args: {onCancel: fn()},
} satisfies Meta<typeof Invite>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An empty submit focuses the field; a filled one shows the server's two messages. */
export const Default: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {name: 'Send invite'}));
    await waitFor(() => expect(canvas.getByLabelText(/Email/)).toHaveFocus());

    await userEvent.type(canvas.getByLabelText(/Email/), 'ada@example.com');
    await userEvent.click(canvas.getByRole('button', {name: 'Send invite'}));
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Nothing was sent.');
    await expect(canvas.getByLabelText(/Email/)).toHaveAccessibleDescription('Already invited');
  },
};
```

- [ ] **Step 9: Run the stories**

Run: `pnpm vitest run --project storybook packages/form`
Expected: PASS.

- [ ] **Step 10: Handoff**

Do not run git. Suggested message: `feat(form): add server errors, form buttons and focus on invalid submit`

---

### Task 5: `CheckboxField` and `SwitchField`

**Files:**

- Create: `src/fields/ToggleField.tsx` (internal), `src/fields/CheckboxField.tsx`, `src/fields/SwitchField.tsx`, `src/stories/Toggles.stories.tsx`
- Test: `src/fields/ToggleField.test.tsx`
- Modify: `src/index.ts`, `src/index.test.ts`

**Interfaces:**

- Consumes: `useFieldBinding`, `FieldShell` with `as="bare"`, `BOOLEAN`, `FieldHarness`.
- Produces: `CheckboxField(props: ToggleFieldProps)`, `SwitchField(props: ToggleFieldProps)`, where `ToggleFieldProps = CommonFieldProps`.

The two differ only in the MUI control, so both are thin wrappers over one internal `ToggleField`. Two copies would trip jscpd.

- [ ] **Step 1: Write the failing tests**

`packages/form/src/fields/ToggleField.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {FieldHarness} from '../test/FieldHarness';
import {CheckboxField} from './CheckboxField';
import {SwitchField} from './SwitchField';

describe.each([
  ['CheckboxField', CheckboxField, 'checkbox'],
  ['SwitchField', SwitchField, 'switch'],
] as const)('%s', (_name, Field, role) => {
  it('toggles a boolean and labels the control with the field label', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={false}>
        <Field label="Send me updates" description="About once a month" />
      </FieldHarness>,
    );
    const control = screen.getByRole(role, {name: 'Send me updates'});
    expect(control).toHaveAccessibleDescription('About once a month');

    await user.click(control);
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('true');
  });

  it('shows an error after an invalid submit and marks the control invalid', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={false} validate={(value) => (value ? undefined : 'Accept the terms')}>
        <Field label="I accept the terms" required />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    const control = screen.getByRole(role, {name: /I accept the terms/});
    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control).toHaveAttribute('aria-required', 'true');
    expect(control).toHaveAccessibleDescription('Accept the terms');
  });

  it('warns in development when the value is not a boolean', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <FieldHarness defaultValue="yes">
        <Field label="Flag" />
      </FieldHarness>,
    );
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
```

If MUI's `Switch` input reports role `checkbox` rather than `switch` in jsdom, the fix is `role: 'switch'` on the input in `ToggleField`'s `slotProps.input` for the switch variant, not a change to the test.

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm vitest run --project @vt-labs/form src/fields/ToggleField`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write the fields**

`packages/form/src/fields/ToggleField.tsx`:

```tsx
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';

import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import {BOOLEAN} from '../core/valueChecks';

export type ToggleFieldProps = CommonFieldProps;

interface ToggleFieldInternalProps extends ToggleFieldProps {
  readonly control: 'checkbox' | 'switch';
}

/** The label sits beside the control, so the shell renders only the helper row. */
export function ToggleField({
  control,
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
}: ToggleFieldInternalProps) {
  const binding = useFieldBinding<boolean>({required, expect: BOOLEAN});
  const Control = control === 'checkbox' ? Checkbox : Switch;

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
      as="bare"
    >
      <FormControlLabel
        label={label}
        required={required}
        disabled={disabled}
        control={
          <Control
            checked={binding.value === true}
            onChange={(event) => binding.setValue(event.target.checked)}
            onBlur={binding.onBlur}
            autoFocus={autoFocus}
            slotProps={{
              input: {
                id: binding.inputId,
                ...binding.inputProps,
                ...(control === 'switch' ? {role: 'switch'} : {}),
              },
            }}
          />
        }
      />
    </FieldShell>
  );
}
```

`packages/form/src/fields/CheckboxField.tsx`:

```tsx
import {ToggleField} from './ToggleField';
import type {ToggleFieldProps} from './ToggleField';

export type CheckboxFieldProps = ToggleFieldProps;

export function CheckboxField(props: Readonly<CheckboxFieldProps>) {
  return <ToggleField {...props} control="checkbox" />;
}
```

`packages/form/src/fields/SwitchField.tsx`:

```tsx
import {ToggleField} from './ToggleField';
import type {ToggleFieldProps} from './ToggleField';

export type SwitchFieldProps = ToggleFieldProps;

/** For a setting that applies at once in the user's mind (notifications on or off). */
export function SwitchField(props: Readonly<SwitchFieldProps>) {
  return <ToggleField {...props} control="switch" />;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm vitest run --project @vt-labs/form src/fields/ToggleField`
Expected: PASS, 6 tests.

- [ ] **Step 5: Export, pin, and write the story**

Add to `src/index.ts`:

```ts
export {CheckboxField} from './fields/CheckboxField';
export type {CheckboxFieldProps} from './fields/CheckboxField';
export {SwitchField} from './fields/SwitchField';
export type {SwitchFieldProps} from './fields/SwitchField';
```

Add `'CheckboxField'` and `'SwitchField'` to `ROOT_API`. `ToggleField` stays internal.

`packages/form/src/stories/Toggles.stories.tsx`:

```tsx
import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, userEvent, within} from 'storybook/test';

import {CheckboxField} from '../fields/CheckboxField';
import {SwitchField} from '../fields/SwitchField';
import {FieldHarness} from '../test/FieldHarness';

const meta = {
  title: 'Form/Checkbox and switch',
  component: CheckboxField,
  tags: ['autodocs'],
  args: {label: 'I accept the terms', required: true, tooltip: 'You can read them at any time'},
  render: (args) => (
    <FieldHarness defaultValue={false} validate={(value) => (value ? undefined : 'Accept the terms to continue')}>
      <CheckboxField {...args} />
    </FieldHarness>
  ),
} satisfies Meta<typeof CheckboxField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Checkbox: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByRole('checkbox')).toHaveAccessibleDescription('Accept the terms to continue');
    await userEvent.click(canvas.getByRole('checkbox'));
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('true');
  },
};

export const Switch: Story = {
  render: () => (
    <FieldHarness defaultValue={true}>
      <SwitchField label="Email notifications" description="Sent when someone mentions you" />
    </FieldHarness>
  ),
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('switch', {name: 'Email notifications'}));
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('false');
  },
};
```

- [ ] **Step 6: Run everything for the package**

Run: `pnpm vitest run --project @vt-labs/form && pnpm vitest run --project storybook packages/form`
Expected: PASS.

- [ ] **Step 7: Handoff**

Do not run git. Suggested message: `feat(form): add CheckboxField and SwitchField`

---

### Task 6: `SelectField` and `RadioGroupField`

**Files:**

- Create: `src/fields/SelectField.tsx`, `src/fields/RadioGroupField.tsx`, `src/fields/optionLookup.ts`, `src/stories/Choices.stories.tsx`
- Test: `src/fields/SelectField.test.tsx`, `src/fields/RadioGroupField.test.tsx`
- Modify: `src/index.ts`, `src/index.test.ts`

**Interfaces:**

- Consumes: `useFieldBinding`, `FieldShell` (`as="label"` and `as="fieldset"`), `Option<V>`, `NULLABLE_SCALAR`, `FieldHarness`.
- Produces:
  ```ts
  function findOption<V extends string | number>(options: readonly Option<V>[], raw: unknown): Option<V> | undefined
  SelectField<V extends string | number>(props: SelectFieldProps<V>)
    // options, placeholder?, emptyLabel? (renders a first item that sets null)
  RadioGroupField<V extends string | number>(props: RadioGroupFieldProps<V>)
    // options, row?
  ```

DOM attributes turn every value into a string, so `findOption` matches on `String(option.value)` and hands back the option, which keeps a numeric value numeric in the form.

- [ ] **Step 1: Write the failing tests**

`packages/form/src/fields/SelectField.test.tsx`:

```tsx
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {FieldHarness} from '../test/FieldHarness';
import {SelectField} from './SelectField';

const ROLES = [
  {value: 1, label: 'Admin', description: 'Everything'},
  {value: 2, label: 'Editor'},
  {value: 3, label: 'Viewer', disabled: true},
] as const;

async function choose(user: ReturnType<typeof userEvent.setup>, name: RegExp, option: string) {
  await user.click(screen.getByRole('combobox', {name}));
  await user.click(within(screen.getByRole('listbox')).getByRole('option', {name: new RegExp(option)}));
}

describe('SelectField', () => {
  it('stores the option value with its type, and null before a choice', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <SelectField label="Role" options={ROLES} placeholder="Pick a role" />
      </FieldHarness>,
    );
    expect(screen.getByRole('combobox', {name: /Role/})).toHaveTextContent('Pick a role');

    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('null');

    await choose(user, /Role/, 'Editor');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent(/^2$/);
  });

  it('offers an empty item that sets null when emptyLabel is given', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={1}>
        <SelectField label="Role" options={ROLES} emptyLabel="No role" />
      </FieldHarness>,
    );
    await choose(user, /Role/, 'No role');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('null');
  });

  it('disables a disabled option and shows a description', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <SelectField label="Role" options={ROLES} />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('combobox', {name: /Role/}));
    expect(screen.getByRole('option', {name: /Viewer/})).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('option', {name: /Admin/})).toHaveTextContent('Everything');
  });

  it('wires the error to the combobox', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null} validate={(value) => (value === null ? 'Pick a role' : undefined)}>
        <SelectField label="Role" options={ROLES} required />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    const combobox = screen.getByRole('combobox', {name: /Role/});
    expect(combobox).toHaveAttribute('aria-invalid', 'true');
    expect(combobox).toHaveAttribute('aria-required', 'true');
    expect(combobox).toHaveAccessibleDescription('Pick a role');
  });
});
```

`packages/form/src/fields/RadioGroupField.test.tsx`:

```tsx
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {FieldHarness} from '../test/FieldHarness';
import {RadioGroupField} from './RadioGroupField';

const PLANS = [
  {value: 'free', label: 'Free'},
  {value: 'pro', label: 'Pro', description: 'Billed monthly'},
] as const;

describe('RadioGroupField', () => {
  it('is a group named by its legend, and stores the chosen value', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <RadioGroupField label="Plan" options={PLANS} />
      </FieldHarness>,
    );
    expect(screen.getByRole('group', {name: 'Plan'})).toBeInTheDocument();
    expect(screen.getByText('Billed monthly')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', {name: /Pro/}));
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('"pro"');
  });

  it('marks the radiogroup invalid, and an invalid submit focuses its first radio', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null} validate={(value) => (value === null ? 'Choose a plan' : undefined)}>
        <RadioGroupField label="Plan" options={PLANS} required />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('button', {name: 'Submit'}));

    const group = screen.getByRole('radiogroup');
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAccessibleDescription('Choose a plan');
    await waitFor(() => expect(screen.getByRole('radio', {name: 'Free'})).toHaveFocus());
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm vitest run --project @vt-labs/form src/fields/SelectField src/fields/RadioGroupField`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write the lookup and the fields**

`packages/form/src/fields/optionLookup.ts`:

```ts
import type {Option} from '../core/types';

/** Finds the option a DOM value stands for. The DOM stringifies; the option keeps the real type. */
export function findOption<V extends string | number>(
  options: readonly Option<V>[],
  raw: unknown,
): Option<V> | undefined {
  return options.find((option) => String(option.value) === String(raw));
}
```

`packages/form/src/fields/SelectField.tsx`:

```tsx
import Box from '@mui/material/Box';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';

import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps, Option} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import {NULLABLE_SCALAR} from '../core/valueChecks';
import {findOption} from './optionLookup';

export interface SelectFieldProps<V extends string | number> extends CommonFieldProps {
  readonly options: readonly Option<V>[];
  /** Shown while nothing is chosen. */
  readonly placeholder?: string;
  /** When set, the first item clears the choice back to null and reads this. */
  readonly emptyLabel?: string;
}

const EMPTY = '';

export function SelectField<V extends string | number>({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  options,
  placeholder,
  emptyLabel,
}: Readonly<SelectFieldProps<V>>) {
  const binding = useFieldBinding<V | null>({required, expect: NULLABLE_SCALAR});
  const selected = findOption(options, binding.value);

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <Select<string>
        labelId={binding.labelId}
        value={selected ? String(selected.value) : EMPTY}
        onChange={(event) => binding.setValue(findOption(options, event.target.value)?.value ?? null)}
        onBlur={binding.onBlur}
        error={binding.error !== null}
        disabled={disabled}
        autoFocus={autoFocus}
        fullWidth
        displayEmpty
        renderValue={() =>
          selected ? (
            selected.label
          ) : (
            <Box component="span" sx={{color: 'text.secondary'}}>
              {placeholder ?? '​'}
            </Box>
          )
        }
        SelectDisplayProps={{id: binding.inputId, ...binding.inputProps}}
      >
        {emptyLabel === undefined ? null : (
          <MenuItem value={EMPTY}>
            <em>{emptyLabel}</em>
          </MenuItem>
        )}
        {options.map((option) => (
          <MenuItem key={String(option.value)} value={String(option.value)} disabled={option.disabled}>
            <ListItemText primary={option.label} secondary={option.description} />
          </MenuItem>
        ))}
      </Select>
    </FieldShell>
  );
}
```

`SelectDisplayProps` is the element with `role="combobox"`, so the aria attributes and `data-form-id` go there, and `focusFirstInvalid` can focus it (it has `tabindex="0"`). If the combobox's accessible name in the test comes out as the label plus the selected text rather than matching `/Role/`, that is MUI joining `labelId` with the display id, and the regex already allows it.

`packages/form/src/fields/RadioGroupField.tsx`:

```tsx
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';

import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps, Option} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import {NULLABLE_SCALAR} from '../core/valueChecks';
import {findOption} from './optionLookup';

export interface RadioGroupFieldProps<V extends string | number> extends CommonFieldProps {
  readonly options: readonly Option<V>[];
  readonly row?: boolean;
}

export function RadioGroupField<V extends string | number>({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  options,
  row,
}: Readonly<RadioGroupFieldProps<V>>) {
  const binding = useFieldBinding<V | null>({required, expect: NULLABLE_SCALAR});
  const selected = findOption(options, binding.value);

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
      as="fieldset"
    >
      <RadioGroup
        row={row}
        value={selected ? String(selected.value) : null}
        onChange={(_event, raw) => binding.setValue(findOption(options, raw)?.value ?? null)}
        onBlur={binding.onBlur}
        aria-labelledby={binding.labelId}
        {...binding.inputProps}
      >
        {options.map((option, index) => (
          <FormControlLabel
            key={String(option.value)}
            value={String(option.value)}
            disabled={disabled || option.disabled}
            control={<Radio autoFocus={autoFocus && index === 0} />}
            label={
              option.description ? (
                <Box>
                  {option.label}
                  <Typography variant="body2" sx={{color: 'text.secondary'}}>
                    {option.description}
                  </Typography>
                </Box>
              ) : (
                option.label
              )
            }
          />
        ))}
      </RadioGroup>
    </FieldShell>
  );
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm vitest run --project @vt-labs/form src/fields/SelectField src/fields/RadioGroupField`
Expected: PASS.

- [ ] **Step 5: Export, pin, and write the story**

Add to `src/index.ts`:

```ts
export {RadioGroupField} from './fields/RadioGroupField';
export type {RadioGroupFieldProps} from './fields/RadioGroupField';
export {SelectField} from './fields/SelectField';
export type {SelectFieldProps} from './fields/SelectField';
```

Add `'RadioGroupField'` and `'SelectField'` to `ROOT_API`.

`packages/form/src/stories/Choices.stories.tsx`:

```tsx
import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, screen, userEvent, within} from 'storybook/test';

import {RadioGroupField} from '../fields/RadioGroupField';
import {SelectField} from '../fields/SelectField';
import {FieldHarness} from '../test/FieldHarness';

const ROLES = [
  {value: 'admin', label: 'Admin', description: 'Manages users and billing'},
  {value: 'editor', label: 'Editor'},
  {value: 'viewer', label: 'Viewer'},
];

const meta = {
  title: 'Form/Select and radio',
  component: SelectField<string>,
  tags: ['autodocs'],
  args: {label: 'Role', options: ROLES, placeholder: 'Pick a role', emptyLabel: 'No role'},
  render: (args) => (
    <FieldHarness defaultValue={null}>
      <SelectField {...args} />
    </FieldHarness>
  ),
} satisfies Meta<typeof SelectField<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Select: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('combobox', {name: /Role/}));
    // The menu is portalled to the body, outside the canvas.
    await userEvent.click(await screen.findByRole('option', {name: /Editor/}));
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('"editor"');
  },
};

export const Radio: Story = {
  render: () => (
    <FieldHarness defaultValue={null}>
      <RadioGroupField label="Role" options={ROLES} tooltip="You can change this later" />
    </FieldHarness>
  ),
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', {name: /Admin/}));
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('"admin"');
  },
};
```

If `component: SelectField<string>` is rejected by the TypeScript version in the catalog, use `component: SelectField` and type `meta` with `satisfies Meta<typeof SelectField>`.

- [ ] **Step 6: Run everything for the package**

Run: `pnpm vitest run --project @vt-labs/form && pnpm vitest run --project storybook packages/form`
Expected: PASS.

- [ ] **Step 7: Handoff**

Do not run git. Suggested message: `feat(form): add SelectField and RadioGroupField`

---

### Task 7: `SearchableSelectField` and `MultiSelectField`

**Files:**

- Create: `src/core/autocompleteText.ts`, `src/fields/SearchableSelectField.tsx`, `src/fields/MultiSelectField.tsx`, `src/stories/SearchAndMulti.stories.tsx`
- Test: `src/fields/SearchableSelectField.test.tsx`, `src/fields/MultiSelectField.test.tsx`
- Modify: `src/index.ts`, `src/index.test.ts`

**Interfaces:**

- Consumes: `useFieldBinding`, `FieldShell`, `Option<V>`, `findOption` (Task 6), `NULLABLE_SCALAR`, `SCALAR_ARRAY`, `useFormConfig`.
- Produces:
  ```ts
  function autocompleteText(labels: FormLabels): {noOptionsText: string; loadingText: string; clearText: string; openText: string; closeText: string}
  SearchableSelectField<V>(props: SearchableSelectFieldProps<V>)   // options, placeholder?
  MultiSelectField<V>(props: MultiSelectFieldProps<V>)             // options, placeholder?, searchable?
  ```

MUI 9's `renderInput` params carry `slotProps.{input, htmlInput, inputLabel}`; MUI 7 carried `InputProps` and `inputProps`. That runtime difference is why the package peers on `@mui/material ^9` only. Every Autocomplete here merges its own attributes into `params.slotProps.htmlInput` and never replaces it, because that object carries Autocomplete's own `onBlur`, `ref` and combobox attributes.

- [ ] **Step 1: Write the failing tests**

`packages/form/src/fields/SearchableSelectField.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {FormConfigProvider} from '../config/FormConfigContext';
import {FieldHarness} from '../test/FieldHarness';
import {SearchableSelectField} from './SearchableSelectField';

const COUNTRIES = [
  {value: 'de', label: 'Germany'},
  {value: 'fr', label: 'France'},
  {value: 'in', label: 'India'},
];

describe('SearchableSelectField', () => {
  it('filters as the user types and stores the chosen value', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <SearchableSelectField label="Country" options={COUNTRIES} />
      </FieldHarness>,
    );
    await user.type(screen.getByRole('combobox', {name: 'Country'}), 'fra');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await user.click(screen.getByRole('option', {name: 'France'}));

    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('"fr"');
  });

  it('shows the label of a value set before render', () => {
    render(
      <FieldHarness defaultValue="in">
        <SearchableSelectField label="Country" options={COUNTRIES} />
      </FieldHarness>,
    );
    expect(screen.getByRole('combobox', {name: 'Country'})).toHaveValue('India');
  });

  it('takes the empty-list text from the labels', async () => {
    const user = userEvent.setup();
    render(
      <FormConfigProvider labels={{noOptions: 'Keine Treffer'}}>
        <FieldHarness defaultValue={null}>
          <SearchableSelectField label="Land" options={COUNTRIES} />
        </FieldHarness>
      </FormConfigProvider>,
    );
    await user.type(screen.getByRole('combobox', {name: 'Land'}), 'zzz');
    expect(screen.getByText('Keine Treffer')).toBeInTheDocument();
  });

  it('wires aria-describedby and aria-invalid onto the combobox input', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null} validate={(value) => (value === null ? 'Pick a country' : undefined)}>
        <SearchableSelectField label="Country" options={COUNTRIES} />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    const input = screen.getByRole('combobox', {name: 'Country'});
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Pick a country');
  });
});
```

`packages/form/src/fields/MultiSelectField.test.tsx`:

```tsx
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {FieldHarness} from '../test/FieldHarness';
import {MultiSelectField} from './MultiSelectField';

const TAGS = [
  {value: 1, label: 'Urgent'},
  {value: 2, label: 'Billing'},
  {value: 3, label: 'Bug'},
];

describe('MultiSelectField', () => {
  it('stores an array of values, as chips, from a plain select', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={[]}>
        <MultiSelectField label="Tags" options={TAGS} />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('combobox', {name: /Tags/}));
    const listbox = screen.getByRole('listbox');
    await user.click(within(listbox).getByRole('option', {name: 'Urgent'}));
    await user.click(within(listbox).getByRole('option', {name: 'Bug'}));
    await user.keyboard('{Escape}');

    expect(screen.getByText('Urgent')).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('[1,3]');
  });

  it('searches when searchable, and removes a chip', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={[2]}>
        <MultiSelectField label="Tags" options={TAGS} searchable />
      </FieldHarness>,
    );
    const input = screen.getByRole('combobox', {name: 'Tags'});
    await user.type(input, 'bu');
    await user.click(screen.getByRole('option', {name: 'Bug'}));

    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('[2,3]');

    await user.click(input);
    await user.keyboard('{Backspace}');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('[2]');
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm vitest run --project @vt-labs/form src/fields/SearchableSelectField src/fields/MultiSelectField`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write the shared text helper**

`packages/form/src/core/autocompleteText.ts`:

```ts
import type {FormLabels} from '../config/labels';

/** The Autocomplete props that are words, taken from the labels so every Autocomplete here translates the same way. */
export function autocompleteText(labels: FormLabels) {
  return {
    noOptionsText: labels.noOptions,
    loadingText: labels.loading,
    clearText: labels.clear,
    openText: labels.open,
    closeText: labels.close,
  };
}
```

- [ ] **Step 4: Write `SearchableSelectField`**

`packages/form/src/fields/SearchableSelectField.tsx`:

```tsx
import Autocomplete from '@mui/material/Autocomplete';
import MuiTextField from '@mui/material/TextField';

import {useFormConfig} from '../config/FormConfigContext';
import {autocompleteText} from '../core/autocompleteText';
import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps, Option} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import {NULLABLE_SCALAR} from '../core/valueChecks';
import {findOption} from './optionLookup';

export interface SearchableSelectFieldProps<V extends string | number> extends CommonFieldProps {
  readonly options: readonly Option<V>[];
  readonly placeholder?: string;
}

/** `SelectField` for lists long enough that scrolling stops working, filtered in the browser. */
export function SearchableSelectField<V extends string | number>({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  options,
  placeholder,
}: Readonly<SearchableSelectFieldProps<V>>) {
  const binding = useFieldBinding<V | null>({required, expect: NULLABLE_SCALAR});
  const {labels} = useFormConfig();

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <Autocomplete<Option<V>>
        id={binding.inputId}
        options={options}
        value={findOption(options, binding.value) ?? null}
        onChange={(_event, option) => binding.setValue(option?.value ?? null)}
        onBlur={binding.onBlur}
        getOptionLabel={(option) => option.label}
        getOptionDisabled={(option) => option.disabled === true}
        isOptionEqualToValue={(option, value) => option.value === value.value}
        disabled={disabled}
        fullWidth
        {...autocompleteText(labels)}
        renderInput={(params) => (
          <MuiTextField
            {...params}
            autoFocus={autoFocus}
            placeholder={placeholder}
            error={binding.error !== null}
            slotProps={{...params.slotProps, htmlInput: {...params.slotProps.htmlInput, ...binding.inputProps}}}
          />
        )}
      />
    </FieldShell>
  );
}
```

- [ ] **Step 5: Write `MultiSelectField`**

`packages/form/src/fields/MultiSelectField.tsx`:

```tsx
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import MuiTextField from '@mui/material/TextField';

import {useFormConfig} from '../config/FormConfigContext';
import {autocompleteText} from '../core/autocompleteText';
import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps, Option} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import type {FieldBinding} from '../core/useFieldBinding';
import {SCALAR_ARRAY} from '../core/valueChecks';
import {findOption} from './optionLookup';

export interface MultiSelectFieldProps<V extends string | number> extends CommonFieldProps {
  readonly options: readonly Option<V>[];
  readonly placeholder?: string;
  /** Type to filter. Worth it past a dozen options. */
  readonly searchable?: boolean;
}

export function MultiSelectField<V extends string | number>(props: Readonly<MultiSelectFieldProps<V>>) {
  const {label, description, required, tooltip, disabled} = props;
  const binding = useFieldBinding<V[]>({required, expect: SCALAR_ARRAY});
  const selected = (Array.isArray(binding.value) ? binding.value : []).flatMap(
    (value) => findOption(props.options, value) ?? [],
  );

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      {props.searchable ? (
        <SearchableMulti {...props} binding={binding} selected={selected} />
      ) : (
        <PlainMulti {...props} binding={binding} selected={selected} />
      )}
    </FieldShell>
  );
}

interface VariantProps<V extends string | number> extends MultiSelectFieldProps<V> {
  readonly binding: FieldBinding<V[]>;
  readonly selected: readonly Option<V>[];
}

function PlainMulti<V extends string | number>({
  options,
  placeholder,
  disabled,
  autoFocus,
  binding,
  selected,
}: VariantProps<V>) {
  return (
    <Select<string[]>
      multiple
      labelId={binding.labelId}
      value={selected.map((option) => String(option.value))}
      onChange={(event) => {
        const raw = event.target.value;
        const values = typeof raw === 'string' ? raw.split(',') : raw;
        binding.setValue(values.flatMap((value) => findOption(options, value)?.value ?? []));
      }}
      onBlur={binding.onBlur}
      error={binding.error !== null}
      disabled={disabled}
      autoFocus={autoFocus}
      fullWidth
      displayEmpty
      renderValue={() =>
        selected.length === 0 ? (
          <Box component="span" sx={{color: 'text.secondary'}}>
            {placeholder ?? '​'}
          </Box>
        ) : (
          <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5}}>
            {selected.map((option) => (
              <Chip key={String(option.value)} label={option.label} size="small" />
            ))}
          </Box>
        )
      }
      SelectDisplayProps={{id: binding.inputId, ...binding.inputProps}}
    >
      {options.map((option) => (
        <MenuItem key={String(option.value)} value={String(option.value)} disabled={option.disabled}>
          {option.label}
        </MenuItem>
      ))}
    </Select>
  );
}

function SearchableMulti<V extends string | number>({
  options,
  placeholder,
  disabled,
  autoFocus,
  binding,
  selected,
}: VariantProps<V>) {
  const {labels} = useFormConfig();
  return (
    <Autocomplete<Option<V>, true>
      multiple
      id={binding.inputId}
      options={options}
      value={[...selected]}
      onChange={(_event, chosen) => binding.setValue(chosen.map((option) => option.value))}
      onBlur={binding.onBlur}
      getOptionLabel={(option) => option.label}
      getOptionDisabled={(option) => option.disabled === true}
      isOptionEqualToValue={(option, value) => option.value === value.value}
      filterSelectedOptions
      disabled={disabled}
      fullWidth
      {...autocompleteText(labels)}
      renderInput={(params) => (
        <MuiTextField
          {...params}
          autoFocus={autoFocus}
          placeholder={selected.length === 0 ? placeholder : undefined}
          error={binding.error !== null}
          slotProps={{...params.slotProps, htmlInput: {...params.slotProps.htmlInput, ...binding.inputProps}}}
        />
      )}
    />
  );
}
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `pnpm vitest run --project @vt-labs/form src/fields/SearchableSelectField src/fields/MultiSelectField`
Expected: PASS.

- [ ] **Step 7: Export, pin, and write the story**

Add to `src/index.ts`:

```ts
export {MultiSelectField} from './fields/MultiSelectField';
export type {MultiSelectFieldProps} from './fields/MultiSelectField';
export {SearchableSelectField} from './fields/SearchableSelectField';
export type {SearchableSelectFieldProps} from './fields/SearchableSelectField';
```

Add `'MultiSelectField'` and `'SearchableSelectField'` to `ROOT_API`.

`packages/form/src/stories/SearchAndMulti.stories.tsx`:

```tsx
import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, screen, userEvent, within} from 'storybook/test';

import {MultiSelectField} from '../fields/MultiSelectField';
import {SearchableSelectField} from '../fields/SearchableSelectField';
import {FieldHarness} from '../test/FieldHarness';

const TIMEZONES = ['Asia/Kolkata', 'Europe/Berlin', 'Europe/London', 'America/New_York', 'America/Los_Angeles'].map(
  (zone) => ({
    value: zone,
    label: zone.replace('_', ' '),
  }),
);

const meta = {
  title: 'Form/Searchable and multi select',
  component: SearchableSelectField<string>,
  tags: ['autodocs'],
  args: {label: 'Timezone', options: TIMEZONES, placeholder: 'Search timezones'},
  render: (args) => (
    <FieldHarness defaultValue={null}>
      <SearchableSelectField {...args} />
    </FieldHarness>
  ),
} satisfies Meta<typeof SearchableSelectField<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Searchable: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('combobox', {name: 'Timezone'}), 'berl');
    await userEvent.click(await screen.findByRole('option', {name: 'Europe/Berlin'}));
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('"Europe/Berlin"');
  },
};

export const Multi: Story = {
  render: () => (
    <FieldHarness defaultValue={['Europe/London']}>
      <MultiSelectField label="Timezones" options={TIMEZONES} searchable description="Shown on the team page" />
    </FieldHarness>
  ),
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('combobox', {name: 'Timezones'}), 'kol');
    await userEvent.click(await screen.findByRole('option', {name: 'Asia/Kolkata'}));
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('["Europe/London","Asia/Kolkata"]');
  },
};
```

- [ ] **Step 8: Run everything for the package and jscpd**

Run: `pnpm vitest run --project @vt-labs/form && pnpm vitest run --project storybook packages/form && pnpm jscpd`
Expected: PASS, and jscpd reports no clone in `packages/form/src`. If it flags the two `renderInput` blocks, move them into one internal `renderAutocompleteInput(params, binding, {autoFocus, placeholder})` in `src/core/autocompleteText.ts` and call it from both.

- [ ] **Step 9: Handoff**

Do not run git. Suggested message: `feat(form): add SearchableSelectField and MultiSelectField`

---

### Task 8: `AsyncAutocompleteField`

**Files:**

- Create: `src/fields/useAsyncOptions.ts`, `src/fields/AsyncAutocompleteInput.tsx` (internal), `src/fields/AsyncAutocompleteField.tsx`, `src/stories/AsyncAutocomplete.stories.tsx`
- Test: `src/fields/useAsyncOptions.test.tsx`, `src/fields/AsyncAutocompleteField.test.tsx`
- Modify: `src/index.ts`, `src/index.test.ts`

**Interfaces:**

- Consumes: `useFieldBinding`, `FieldShell`, `autocompleteText`, `useFormConfig`.
- Produces:
  ```ts
  type LoadOptions<T> = (query: string, options: {signal: AbortSignal}) => Promise<readonly T[]>
  function useAsyncOptions<T>(loadOptions: LoadOptions<T>, query: string, settings: {active: boolean; debounceMs: number; minQueryLength: number}):
    {options: readonly T[]; status: 'idle' | 'loading' | 'loaded' | 'error'}
  // internal; Task 12's LocationSearchField renders it too
  AsyncAutocompleteInput<T>(props: {binding: FieldBinding<unknown>; value: T | readonly T[] | null; onChange(value: T | T[] | null): void;
    loadOptions; getOptionValue; getOptionLabel; multiple?; debounceMs?; minQueryLength?; placeholder?; autoFocus?; disabled?})
  AsyncAutocompleteField<T>(props: AsyncAutocompleteFieldProps<T>)
  ```

The form holds the item itself (`T`, not its id), so an edit screen shows the saved item's label before any search runs. The current value is merged into the loaded options so MUI does not warn that the value matches no option.

- [ ] **Step 1: Write the failing tests**

`packages/form/src/fields/useAsyncOptions.test.tsx`:

```tsx
import {act, renderHook, waitFor} from '@testing-library/react';

import {useAsyncOptions} from './useAsyncOptions';

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return {promise, resolve};
}

const settings = {active: true, debounceMs: 0, minQueryLength: 0};

describe('useAsyncOptions', () => {
  it('keeps only the latest query when an older request answers last', async () => {
    const ab = deferred<string[]>();
    const abc = deferred<string[]>();
    const signals: AbortSignal[] = [];
    const load = vi.fn((query: string, {signal}: {signal: AbortSignal}) => {
      signals.push(signal);
      return query === 'ab' ? ab.promise : abc.promise;
    });

    const {result, rerender} = renderHook(({query}) => useAsyncOptions(load, query, settings), {
      initialProps: {query: 'ab'},
    });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    rerender({query: 'abc'});
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));

    expect(signals[0]?.aborted).toBe(true);
    await act(async () => abc.resolve(['abc result']));
    await act(async () => ab.resolve(['stale ab result']));

    expect(result.current).toEqual({options: ['abc result'], status: 'loaded'});
  });

  it('is idle below the minimum query length and while closed', () => {
    const load = vi.fn(async () => ['x']);
    const {result, rerender} = renderHook(
      ({query, active}) => useAsyncOptions(load, query, {...settings, active, minQueryLength: 2}),
      {
        initialProps: {query: 'a', active: true},
      },
    );
    expect(result.current.status).toBe('idle');
    rerender({query: 'ab', active: false});
    expect(result.current.status).toBe('idle');
    expect(load).not.toHaveBeenCalled();
  });

  it('reports a failed load as an error, not as an empty result', async () => {
    const load = vi.fn(async () => {
      throw new Error('network');
    });
    const {result} = renderHook(() => useAsyncOptions(load, 'a', settings));
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('uses the latest loadOptions without reloading when only its identity changes', async () => {
    const first = vi.fn(async () => ['first']);
    const second = vi.fn(async () => ['second']);
    const {result, rerender} = renderHook(({load}) => useAsyncOptions(load, 'q', settings), {
      initialProps: {load: first},
    });
    await waitFor(() => expect(result.current.status).toBe('loaded'));
    rerender({load: second});
    expect(second).not.toHaveBeenCalled();
  });
});
```

`packages/form/src/fields/AsyncAutocompleteField.test.tsx`:

```tsx
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {FieldHarness} from '../test/FieldHarness';
import {AsyncAutocompleteField} from './AsyncAutocompleteField';

interface User {
  readonly id: number;
  readonly name: string;
}

const USERS: User[] = [
  {id: 1, name: 'Ada Lovelace'},
  {id: 2, name: 'Alan Turing'},
  {id: 3, name: 'Grace Hopper'},
];

const search = async (query: string) => USERS.filter((user) => user.name.toLowerCase().includes(query.toLowerCase()));

const common = {
  label: 'Owner',
  getOptionValue: (user: User) => user.id,
  getOptionLabel: (user: User) => user.name,
  debounceMs: 0,
};

describe('AsyncAutocompleteField', () => {
  it('searches, and stores the whole item', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <AsyncAutocompleteField {...common} loadOptions={search} />
      </FieldHarness>,
    );
    await user.type(screen.getByRole('combobox', {name: 'Owner'}), 'gra');
    await user.click(await screen.findByRole('option', {name: 'Grace Hopper'}));
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('{"id":3,"name":"Grace Hopper"}');
  });

  it('shows a saved item before any search', () => {
    render(
      <FieldHarness defaultValue={USERS[1]}>
        <AsyncAutocompleteField {...common} loadOptions={search} />
      </FieldHarness>,
    );
    expect(screen.getByRole('combobox', {name: 'Owner'})).toHaveValue('Alan Turing');
  });

  it('shows the load failure inside the list', async () => {
    const user = userEvent.setup();
    const failing = async (): Promise<User[]> => {
      throw new Error('500');
    };
    render(
      <FieldHarness defaultValue={null}>
        <AsyncAutocompleteField {...common} loadOptions={failing} />
      </FieldHarness>,
    );
    await user.type(screen.getByRole('combobox', {name: 'Owner'}), 'a');
    expect(await screen.findByText('Could not load options')).toBeInTheDocument();
  });

  it('stores an array with multiple', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={[USERS[0]]}>
        <AsyncAutocompleteField {...common} label="Reviewers" loadOptions={search} multiple />
      </FieldHarness>,
    );
    await user.type(screen.getByRole('combobox', {name: 'Reviewers'}), 'alan');
    await user.click(await screen.findByRole('option', {name: 'Alan Turing'}));
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    await waitFor(() => expect(screen.getByLabelText('Submitted value')).toHaveTextContent('[{"id":1,'));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('"Alan Turing"');
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm vitest run --project @vt-labs/form src/fields/useAsyncOptions src/fields/AsyncAutocompleteField`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write `useAsyncOptions`**

`packages/form/src/fields/useAsyncOptions.ts`:

```ts
import {useEffect, useRef, useState} from 'react';

export type LoadOptions<T> = (query: string, options: {signal: AbortSignal}) => Promise<readonly T[]>;

interface Settings {
  /** False while the list is closed: nothing loads until someone looks. */
  readonly active: boolean;
  readonly debounceMs: number;
  readonly minQueryLength: number;
}

interface Result<T> {
  readonly options: readonly T[];
  readonly status: 'idle' | 'loading' | 'loaded' | 'error';
}

const IDLE: Result<never> = {options: [], status: 'idle'};

/**
 * Loads options for a query, debounced, aborting the previous request when the query
 * changes. A result is kept together with the query it answers, so an old answer that
 * arrives late can never show under a newer query.
 */
export function useAsyncOptions<T>(
  loadOptions: LoadOptions<T>,
  query: string,
  {active, debounceMs, minQueryLength}: Settings,
): Result<T> {
  // A consumer usually passes an inline function. Reading it through a ref means a new
  // identity on every render does not refire the request.
  const loadRef = useRef(loadOptions);
  useEffect(() => {
    loadRef.current = loadOptions;
  });

  const [answer, setAnswer] = useState<{query: string; result: Result<T>} | null>(null);
  const shouldLoad = active && query.length >= minQueryLength;

  useEffect(() => {
    if (!shouldLoad) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      loadRef.current(query, {signal: controller.signal}).then(
        (options) => {
          if (!controller.signal.aborted) setAnswer({query, result: {options, status: 'loaded'}});
        },
        () => {
          if (!controller.signal.aborted) setAnswer({query, result: {options: [], status: 'error'}});
        },
      );
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, shouldLoad, debounceMs]);

  if (!shouldLoad) return IDLE;
  if (answer?.query !== query) return {options: [], status: 'loading'};
  return answer.result;
}
```

If oxlint's type-aware pass reports the `.then(...)` call as a floating promise, prefix it with `void`.

- [ ] **Step 4: Write the input and the field**

`packages/form/src/fields/AsyncAutocompleteInput.tsx`:

```tsx
import Autocomplete from '@mui/material/Autocomplete';
import MuiTextField from '@mui/material/TextField';
import {useState} from 'react';

import {useFormConfig} from '../config/FormConfigContext';
import {autocompleteText} from '../core/autocompleteText';
import type {FieldBinding} from '../core/useFieldBinding';
import {useAsyncOptions} from './useAsyncOptions';
import type {LoadOptions} from './useAsyncOptions';

export interface AsyncAutocompleteInputProps<T> {
  readonly binding: Pick<FieldBinding<unknown>, 'inputId' | 'error' | 'onBlur' | 'inputProps'>;
  readonly value: T | readonly T[] | null;
  readonly onChange: (value: T | T[] | null) => void;
  readonly loadOptions: LoadOptions<T>;
  readonly getOptionValue: (option: T) => string | number;
  readonly getOptionLabel: (option: T) => string;
  readonly multiple?: boolean;
  readonly debounceMs?: number;
  readonly minQueryLength?: number;
  readonly placeholder?: string;
  readonly autoFocus?: boolean;
  readonly disabled?: boolean;
}

/**
 * The Autocomplete behind `AsyncAutocompleteField` and `LocationSearchField`. It takes the
 * value and the change handler explicitly, because the location field stores something
 * other than the option the user picked.
 */
export function AsyncAutocompleteInput<T>({
  binding,
  value,
  onChange,
  loadOptions,
  getOptionValue,
  getOptionLabel,
  multiple = false,
  debounceMs = 300,
  minQueryLength = 0,
  placeholder,
  autoFocus,
  disabled,
}: AsyncAutocompleteInputProps<T>) {
  const {labels} = useFormConfig();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const {options, status} = useAsyncOptions(loadOptions, query, {active: open, debounceMs, minQueryLength});

  const current = value === null ? [] : Array.isArray(value) ? value : [value];
  const loadedIds = new Set(options.map(getOptionValue));
  const merged = [...current.filter((item) => !loadedIds.has(getOptionValue(item))), ...options];
  const text = autocompleteText(labels);

  return (
    <Autocomplete<T, boolean, false, false>
      id={binding.inputId}
      multiple={multiple}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={merged}
      value={multiple ? [...current] : (current[0] ?? null)}
      onChange={(_event, next) => onChange(next)}
      onInputChange={(_event, input, reason) => setQuery(reason === 'input' ? input : '')}
      onBlur={binding.onBlur}
      filterOptions={(all) => all}
      filterSelectedOptions={multiple}
      getOptionLabel={getOptionLabel}
      getOptionKey={(option) => getOptionValue(option)}
      isOptionEqualToValue={(option, selected) => getOptionValue(option) === getOptionValue(selected)}
      loading={status === 'loading'}
      disabled={disabled}
      fullWidth
      {...text}
      noOptionsText={status === 'error' ? labels.loadFailed : text.noOptionsText}
      renderInput={(params) => (
        <MuiTextField
          {...params}
          autoFocus={autoFocus}
          placeholder={placeholder}
          error={binding.error !== null}
          slotProps={{...params.slotProps, htmlInput: {...params.slotProps.htmlInput, ...binding.inputProps}}}
        />
      )}
    />
  );
}
```

`packages/form/src/fields/AsyncAutocompleteField.tsx`:

```tsx
import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import {AsyncAutocompleteInput} from './AsyncAutocompleteInput';
import type {LoadOptions} from './useAsyncOptions';

export interface AsyncAutocompleteFieldProps<T> extends CommonFieldProps {
  /**
   * Called with what the user typed. Abort on `signal`; a newer query has replaced this one.
   * For caching, call `queryClient.fetchQuery` in here.
   */
  readonly loadOptions: LoadOptions<T>;
  readonly getOptionValue: (option: T) => string | number;
  readonly getOptionLabel: (option: T) => string;
  /** Store `T[]` instead of `T | null`. */
  readonly multiple?: boolean;
  readonly debounceMs?: number;
  readonly minQueryLength?: number;
  readonly placeholder?: string;
}

export function AsyncAutocompleteField<T>({
  label,
  description,
  required,
  tooltip,
  disabled,
  ...inputProps
}: Readonly<AsyncAutocompleteFieldProps<T>>) {
  const binding = useFieldBinding<T | T[] | null>({required});

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <AsyncAutocompleteInput<T>
        {...inputProps}
        disabled={disabled}
        binding={binding}
        value={binding.value ?? null}
        onChange={binding.setValue}
      />
    </FieldShell>
  );
}
```

No `expect` is passed: `T` is the consumer's type and there is nothing generic to check it against.

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm vitest run --project @vt-labs/form src/fields/useAsyncOptions src/fields/AsyncAutocompleteField`
Expected: PASS.

- [ ] **Step 6: Export, pin, and write the story**

Add to `src/index.ts`:

```ts
export {AsyncAutocompleteField} from './fields/AsyncAutocompleteField';
export type {AsyncAutocompleteFieldProps} from './fields/AsyncAutocompleteField';
export type {LoadOptions} from './fields/useAsyncOptions';
```

Add `'AsyncAutocompleteField'` to `ROOT_API`.

`packages/form/src/stories/AsyncAutocomplete.stories.tsx`:

```tsx
import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, screen, userEvent, within} from 'storybook/test';

import {AsyncAutocompleteField} from '../fields/AsyncAutocompleteField';
import {FieldHarness} from '../test/FieldHarness';

interface Member {
  readonly id: string;
  readonly name: string;
}

const MEMBERS: Member[] = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Katherine Johnson', 'Margaret Hamilton'].map(
  (name) => ({
    id: name.toLowerCase().replace(' ', '-'),
    name,
  }),
);

/** A fake server: 400 ms, and it honours the abort signal. */
function searchMembers(query: string, {signal}: {signal: AbortSignal}): Promise<Member[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => resolve(MEMBERS.filter((member) => member.name.toLowerCase().includes(query.toLowerCase()))),
      400,
    );
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

function Demo() {
  return (
    <FieldHarness defaultValue={null}>
      <AsyncAutocompleteField<Member>
        label="Owner"
        placeholder="Search people"
        loadOptions={searchMembers}
        getOptionValue={(member) => member.id}
        getOptionLabel={(member) => member.name}
        minQueryLength={1}
      />
    </FieldHarness>
  );
}

const meta = {
  title: 'Form/Async autocomplete',
  component: Demo,
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Typing shows a loading row, then the matches; the form stores the whole member. */
export const Default: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('combobox', {name: 'Owner'}), 'hop');
    await userEvent.click(await screen.findByRole('option', {name: 'Grace Hopper'}, {timeout: 3000}));
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('"grace-hopper"');
  },
};
```

- [ ] **Step 7: Run everything for the package**

Run: `pnpm vitest run --project @vt-labs/form && pnpm vitest run --project storybook packages/form`
Expected: PASS.

- [ ] **Step 8: Handoff**

Do not run git. Suggested message: `feat(form): add AsyncAutocompleteField`

---

### Task 9: `DurationField` and `lazyField`

**Files:**

- Create: `src/fields/DurationField.tsx`, `src/lazyField.tsx`, `src/stories/Duration.stories.tsx`
- Test: `src/fields/DurationField.test.tsx`, `src/lazyField.test.tsx`
- Modify: `src/index.ts`, `src/index.test.ts`

**Interfaces:**

- Consumes: `useFieldBinding`, `FieldShell` with `as="fieldset"`, `NULLABLE_NUMBER`, `useFormConfig`.
- Produces:

  ```ts
  DurationField(props: DurationFieldProps)   // maxHours? (default 24, capped at 24), minuteStep? (default 15)
  function lazyField<P extends object>(load: () => Promise<ComponentType<P>>, fallback?: ReactNode): ComponentType<P>
  ```

- [ ] **Step 1: Write the failing tests**

`packages/form/src/fields/DurationField.test.tsx`:

```tsx
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {FieldHarness} from '../test/FieldHarness';
import {DurationField} from './DurationField';

async function pick(user: ReturnType<typeof userEvent.setup>, name: string, option: string) {
  await user.click(screen.getByRole('combobox', {name: new RegExp(name)}));
  await user.click(within(screen.getByRole('listbox')).getByRole('option', {name: option}));
}

describe('DurationField', () => {
  it('stores minutes, and treats an unset part as zero', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <DurationField label="Estimate" />
      </FieldHarness>,
    );
    expect(screen.getByRole('group', {name: 'Estimate'})).toBeInTheDocument();

    await pick(user, 'Hours', '2');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent(/^120$/);

    await pick(user, 'Minutes', '45');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent(/^165$/);
  });

  it('splits a stored value into its two parts', () => {
    render(
      <FieldHarness defaultValue={90}>
        <DurationField label="Estimate" />
      </FieldHarness>,
    );
    expect(screen.getByRole('combobox', {name: /Hours/})).toHaveTextContent('1');
    expect(screen.getByRole('combobox', {name: /Minutes/})).toHaveTextContent('30');
  });

  it('offers minutes in steps and hours up to maxHours', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <DurationField label="Break" maxHours={2} minuteStep={20} />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('combobox', {name: /Minutes/}));
    expect(
      within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['0', '20', '40']);
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('combobox', {name: /Hours/}));
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(3);
  });
});
```

`packages/form/src/lazyField.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';

import {lazyField} from './lazyField';

function Greeting({name}: {readonly name: string}) {
  return <p>Hello {name}</p>;
}

describe('lazyField', () => {
  it('shows the fallback, then the loaded component with its props', async () => {
    let finish: (component: typeof Greeting) => void = () => {};
    const Lazy = lazyField(
      () =>
        new Promise<typeof Greeting>((resolve) => {
          finish = resolve;
        }),
      <p>Loading field</p>,
    );

    render(<Lazy name="Ada" />);
    expect(screen.getByText('Loading field')).toBeInTheDocument();

    finish(Greeting);
    expect(await screen.findByText('Hello Ada')).toBeInTheDocument();
  });

  it('calls load once however many times it renders', async () => {
    const load = vi.fn(async () => Greeting);
    const Lazy = lazyField(load);
    render(
      <>
        <Lazy name="A" />
        <Lazy name="B" />
      </>,
    );
    expect(await screen.findByText('Hello B')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm vitest run --project @vt-labs/form src/fields/DurationField src/lazyField`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write `DurationField`**

`packages/form/src/fields/DurationField.tsx`:

```tsx
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';

import {useFormConfig} from '../config/FormConfigContext';
import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import {NULLABLE_NUMBER} from '../core/valueChecks';

export interface DurationFieldProps extends CommonFieldProps {
  /** The largest hour offered. Capped at 24. */
  readonly maxHours?: number;
  /** The gap between minute options. */
  readonly minuteStep?: number;
}

function range(count: number, step = 1): number[] {
  return Array.from({length: count}, (_, index) => index * step);
}

/** A length of time in minutes, picked as hours and minutes. */
export function DurationField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  maxHours = 24,
  minuteStep = 15,
}: Readonly<DurationFieldProps>) {
  const binding = useFieldBinding<number | null>({required, expect: NULLABLE_NUMBER});
  const {labels} = useFormConfig();
  const total = typeof binding.value === 'number' ? binding.value : null;
  const hours = total === null ? '' : String(Math.floor(total / 60));
  const minutes = total === null ? '' : String(total % 60);

  const change = (part: 'hours' | 'minutes', raw: string) => {
    const nextHours = Number(part === 'hours' ? raw : hours || 0);
    const nextMinutes = Number(part === 'minutes' ? raw : minutes || 0);
    binding.setValue(nextHours * 60 + nextMinutes);
  };

  const parts = [
    {part: 'hours', caption: labels.hours, value: hours, options: range(Math.min(maxHours, 24) + 1)},
    {part: 'minutes', caption: labels.minutes, value: minutes, options: range(Math.ceil(60 / minuteStep), minuteStep)},
  ] as const;

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
      as="fieldset"
    >
      <Box sx={{display: 'flex', gap: 1}}>
        {parts.map(({part, caption, value, options}, index) => {
          const captionId = `${binding.inputId}-${part}-caption`;
          return (
            <Box key={part} sx={{flex: 1}}>
              <Typography id={captionId} variant="caption" sx={{color: 'text.secondary'}}>
                {caption}
              </Typography>
              <Select<string>
                labelId={captionId}
                value={value}
                onChange={(event) => change(part, event.target.value)}
                onBlur={binding.onBlur}
                error={binding.error !== null}
                disabled={disabled}
                autoFocus={autoFocus && index === 0}
                fullWidth
                SelectDisplayProps={{id: `${binding.inputId}-${part}`, ...binding.inputProps}}
              >
                {options.map((option) => (
                  <MenuItem key={option} value={String(option)}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </Box>
          );
        })}
      </Box>
    </FieldShell>
  );
}
```

- [ ] **Step 4: Write `lazyField`**

`packages/form/src/lazyField.tsx`:

```tsx
import {lazy, Suspense} from 'react';
import type {ComponentType, ReactNode} from 'react';

/**
 * Registers a heavy field without loading it. `createAppForm` needs a component for every
 * field up front; this hands it a small stub, and the real module loads the first time the
 * field renders.
 *
 *   const DateField = lazyField(() => import('@vt-labs/form/pickers').then((m) => m.DateField));
 *
 * Call it at module level. Called inside a component, it makes a new lazy component on
 * every render and the field remounts each time.
 */
export function lazyField<P extends object>(
  load: () => Promise<ComponentType<P>>,
  fallback: ReactNode = null,
): ComponentType<P> {
  const Lazy = lazy(() => load().then((component) => ({default: component})));

  function LazyField(props: P) {
    return (
      <Suspense fallback={fallback}>
        <Lazy {...props} />
      </Suspense>
    );
  }

  return LazyField;
}
```

If `<Lazy {...props} />` fails to typecheck because `P` is not known to satisfy `IntrinsicAttributes & P`, change the constraint to `P extends object & JSX.IntrinsicAttributes`; this exact signature typechecked in a scratch project against React 19 types during planning.

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm vitest run --project @vt-labs/form src/fields/DurationField src/lazyField`
Expected: PASS.

- [ ] **Step 6: Export, pin, and write the story**

Add to `src/index.ts`:

```ts
export {DurationField} from './fields/DurationField';
export type {DurationFieldProps} from './fields/DurationField';
export {lazyField} from './lazyField';
```

Add `'DurationField'` and `'lazyField'` to `ROOT_API`.

`packages/form/src/stories/Duration.stories.tsx`:

```tsx
import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, screen, userEvent, within} from 'storybook/test';

import {DurationField} from '../fields/DurationField';
import {FieldHarness} from '../test/FieldHarness';

const meta = {
  title: 'Form/Duration',
  component: DurationField,
  tags: ['autodocs'],
  args: {label: 'Estimate', description: 'How long the job takes', maxHours: 8, minuteStep: 15},
  render: (args) => (
    <FieldHarness defaultValue={null}>
      <DurationField {...args} />
    </FieldHarness>
  ),
} satisfies Meta<typeof DurationField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The form stores minutes; the user picks hours and minutes. */
export const Default: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('combobox', {name: /Hours/}));
    await userEvent.click(await screen.findByRole('option', {name: '1'}));
    await userEvent.click(canvas.getByRole('combobox', {name: /Minutes/}));
    await userEvent.click(await screen.findByRole('option', {name: '30'}));
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('90');
  },
};
```

- [ ] **Step 7: Run everything for the package**

Run: `pnpm vitest run --project @vt-labs/form && pnpm vitest run --project storybook packages/form`
Expected: PASS.

- [ ] **Step 8: Handoff**

Do not run git. Suggested message: `feat(form): add DurationField and lazyField`

---

### Task 10: `@vt-labs/form/pickers`

**Files:**

- Create: `src/pickers/dateStrings.ts`, `src/pickers/usePickerDraft.ts`, `src/pickers/DateField.tsx`, `src/pickers/TimePickerField.tsx`, `src/pickers/DateRangeField.tsx`, `src/stories/Pickers.stories.tsx`
- Test: `src/pickers/dateStrings.test.ts`, `src/pickers/pickers.test.tsx`
- Modify: `src/pickers.ts`, `src/index.test.ts`

**Interfaces:**

- Consumes: `useFieldBinding`, `FieldShell`, `ValueExpectation`, `useFormConfig`, `FieldHarness`. The consumer's `LocalizationProvider`.
- Produces:
  ```ts
  // dateStrings.ts
  function isDateString(value: unknown): value is string            // 'YYYY-MM-DD' and a real calendar day
  function isTimeString(value: unknown): value is string            // 'HH:mm', 00:00 to 23:59
  function dateFromString(adapter: MuiPickersAdapter, value: string | null): PickerValidDate | null
  function dateToString(adapter: MuiPickersAdapter, date: PickerValidDate | null): string | null
  function timeFromString(adapter: MuiPickersAdapter, value: string | null): PickerValidDate | null
  function timeToString(adapter: MuiPickersAdapter, date: PickerValidDate | null): string | null
  // usePickerDraft.ts
  function usePickerDraft(value: string | null, fromString, toString, onChange: (value: string | null) => void):
    {draft: PickerValidDate | null; change(date: PickerValidDate | null): void}
  DateField(props: DateFieldProps)             // minDate?, maxDate? ('YYYY-MM-DD'), disablePast?, disableFuture?
  TimePickerField(props: TimePickerFieldProps) // ampm?, minutesStep?
  DateRangeField(props: DateRangeFieldProps)   // minDate?, maxDate?
  interface DateRange {start: string | null; end: string | null}
  ```

Rules for this entry:

- No date library import in `src/pickers/*.tsx` or `dateStrings.ts`. Conversion goes through the adapter from `usePickerAdapter()` (MUI X 8.6 and later), so the consumer's date-fns or dayjs is used.
- Never `adapter.date(isoString)`. Under date-fns it parses as UTC midnight, which is the previous day west of Greenwich. Build the date with `setYear` / `setMonth` / `setDate` from today's start of year, and read it with `getYear` / `getMonth` / `getDate`.
- Every picker keeps a local draft of the adapter value. A half-typed date is an invalid adapter date: the draft keeps it on screen and the form gets `null`. An outside change of the form value replaces the draft.
- `enableAccessibleFieldDOMStructure={false}` on every picker, so the field is one `<input>` that the package's `<label for>`, `aria-describedby` and `data-form-id` can point at. The newer structure renders a group of spinbuttons with a hidden input, which breaks that contract. If MUI X 9 has removed the prop, stop and tell the user; do not work around it inside this task.

- [ ] **Step 1: Write the failing conversion tests**

`packages/form/src/pickers/dateStrings.test.ts`:

```ts
import {AdapterDateFns} from '@mui/x-date-pickers/AdapterDateFns';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';

import {dateFromString, dateToString, isDateString, isTimeString, timeFromString, timeToString} from './dateStrings';

describe('isDateString and isTimeString', () => {
  it.each([
    ['2026-03-09', true],
    ['2024-02-29', true],
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
```

The test runs in the machine's timezone. To prove the day does not move west of Greenwich, run this file once with `TZ=America/Los_Angeles` in Step 6.

- [ ] **Step 2: Write the failing field tests**

`packages/form/src/pickers/pickers.test.tsx`:

```tsx
import type {AnyFormApi} from '@tanstack/react-form';
import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {AdapterDateFns} from '@mui/x-date-pickers/AdapterDateFns';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {createRef} from 'react';
import type {ReactNode} from 'react';

import {FieldHarness} from '../test/FieldHarness';
import type {FieldHarnessProps} from '../test/FieldHarness';
import {DateField} from './DateField';
import {DateRangeField} from './DateRangeField';
import {TimePickerField} from './TimePickerField';

describe.each([
  ['date-fns', AdapterDateFns],
  ['dayjs', AdapterDayjs],
])('pickers under %s', (_name, Adapter) => {
  function renderPicker(field: ReactNode, harness: Omit<FieldHarnessProps, 'children'>) {
    return render(
      <LocalizationProvider dateAdapter={Adapter}>
        <FieldHarness {...harness}>{field}</FieldHarness>
      </LocalizationProvider>,
    );
  }

  async function submitted(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    return screen.getByLabelText('Submitted value').textContent;
  }

  describe('DateField', () => {
    it('shows a stored date on the same day it was stored', () => {
      renderPicker(<DateField label="Start" />, {defaultValue: '2026-03-09'});
      expect(screen.getByLabelText('Start')).toHaveValue('03/09/2026');
    });

    it('stores what the user types as YYYY-MM-DD', async () => {
      const user = userEvent.setup();
      renderPicker(<DateField label="Start" />, {defaultValue: null});
      const input = screen.getByLabelText('Start');
      await user.click(input);
      await user.keyboard('01152026');
      expect(await submitted(user)).toBe('"2026-01-15"');
    });

    it('keeps a half-typed date on screen while the form holds null', async () => {
      const user = userEvent.setup();
      renderPicker(<DateField label="Start" />, {defaultValue: null});
      const input = screen.getByLabelText('Start');
      await user.click(input);
      await user.keyboard('04');
      expect(input).toHaveValue('04/DD/YYYY');
      expect(await submitted(user)).toBe('null');
    });

    it('renders an unusable stored value as empty and warns once, naming the field', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderPicker(<DateField label="Start" />, {defaultValue: '2026-13-40'});
      expect(screen.getByLabelText('Start')).toHaveValue('');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain('"value"');
    });

    it('follows a value set from outside', () => {
      const formRef = createRef<AnyFormApi>();
      renderPicker(<DateField label="Start" />, {defaultValue: null, formRef});
      act(() => formRef.current?.setFieldValue('value', '2026-07-04'));
      expect(screen.getByLabelText('Start')).toHaveValue('07/04/2026');
    });

    it('wires the error and the form id onto the input', async () => {
      const user = userEvent.setup();
      renderPicker(<DateField label="Start" required />, {
        defaultValue: null,
        validate: (value) => (value ? undefined : 'Pick a date'),
      });
      await user.click(screen.getByRole('button', {name: 'Submit'}));
      const input = screen.getByLabelText(/Start/);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('data-form-id');
      expect(input).toHaveAccessibleDescription('Pick a date');
    });
  });

  describe('TimePickerField', () => {
    it('stores HH:mm and shows a stored time', async () => {
      const user = userEvent.setup();
      renderPicker(<TimePickerField label="Opens at" ampm={false} />, {defaultValue: '09:30'});
      const input = screen.getByLabelText('Opens at');
      expect(input).toHaveValue('09:30');

      await user.clear(input);
      await user.click(input);
      await user.keyboard('1745');
      expect(await submitted(user)).toBe('"17:45"');
    });
  });

  describe('DateRangeField', () => {
    it('stores both ends and labels each picker', async () => {
      const user = userEvent.setup();
      renderPicker(<DateRangeField label="Stay" />, {defaultValue: {start: '2026-05-01', end: null}});
      expect(screen.getByRole('group', {name: 'Stay'})).toBeInTheDocument();
      expect(screen.getByLabelText('Start')).toHaveValue('05/01/2026');

      await user.click(screen.getByLabelText('End'));
      await user.keyboard('05042026');
      expect(await submitted(user)).toBe('{"start":"2026-05-01","end":"2026-05-04"}');
    });
  });
});
```

The displayed format is the adapter's default US locale in both adapters (`MM/DD/YYYY`, and `hh:mm aa` unless `ampm={false}`). If one adapter renders the empty placeholder differently from `04/DD/YYYY` (dayjs and date-fns both use `MM/DD/YYYY` section placeholders by default), assert with `toHaveValue(expect.stringMatching(/^04\//))` instead.

- [ ] **Step 3: Run the tests to see them fail**

Run: `pnpm vitest run --project @vt-labs/form src/pickers`
Expected: FAIL, modules not found.

- [ ] **Step 4: Write the conversions and the draft hook**

`packages/form/src/pickers/dateStrings.ts`:

```ts
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
  const check = new Date(Date.UTC(year, month - 1, day));
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

export function timeFromString(adapter: MuiPickersAdapter, value: string | null): PickerValidDate | null {
  const parts = timeParts(value);
  if (!parts) return null;
  return adapter.setMinutes(adapter.setHours(adapter.startOfDay(adapter.date()), parts[0]), parts[1]);
}

export function timeToString(adapter: MuiPickersAdapter, date: PickerValidDate | null): string | null {
  if (date === null || !adapter.isValid(date)) return null;
  return `${pad(adapter.getHours(date))}:${pad(adapter.getMinutes(date))}`;
}
```

`dateFromString` never produces a rolled-over day: `dateParts` has already rejected any day the month does not have.

`packages/form/src/pickers/usePickerDraft.ts`:

```ts
import type {MuiPickersAdapter, PickerValidDate} from '@mui/x-date-pickers/models';
import {usePickerAdapter} from '@mui/x-date-pickers/hooks';
import {useState} from 'react';

type FromString = (adapter: MuiPickersAdapter, value: string | null) => PickerValidDate | null;
type ToString = (adapter: MuiPickersAdapter, date: PickerValidDate | null) => string | null;

/**
 * The picker's own value, kept beside the form's string. A half-typed date is an invalid
 * adapter date with no string form; the draft keeps it on screen while the form holds null.
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

  const change = (date: PickerValidDate | null) => {
    const next = toString(adapter, date);
    setDraft(date);
    setShownValue(next);
    onChange(next);
  };

  return {draft, change};
}
```

If `usePickerAdapter` is exported from `@mui/x-date-pickers/hooks` under a different path in MUI X 9, find it with `grep -rn "export.*usePickerAdapter" node_modules/@mui/x-date-pickers/*/index.d.ts` from `packages/form` and import it from there.

- [ ] **Step 5: Write the three fields**

`packages/form/src/pickers/DateField.tsx`:

```tsx
import {DatePicker} from '@mui/x-date-pickers/DatePicker';
import {usePickerAdapter} from '@mui/x-date-pickers/hooks';

import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import type {ValueExpectation} from '../core/valueChecks';
import {dateFromString, dateToString, isDateString} from './dateStrings';
import {usePickerDraft} from './usePickerDraft';

export interface DateFieldProps extends CommonFieldProps {
  /** `YYYY-MM-DD`. */
  readonly minDate?: string;
  /** `YYYY-MM-DD`. */
  readonly maxDate?: string;
  readonly disablePast?: boolean;
  readonly disableFuture?: boolean;
}

export const NULLABLE_DATE_STRING: ValueExpectation = {
  test: (value) => value === null || isDateString(value),
  description: "a 'YYYY-MM-DD' string or null",
};

/** A calendar day, stored as `'YYYY-MM-DD'` so no timezone can move it. */
export function DateField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  minDate,
  maxDate,
  disablePast,
  disableFuture,
}: Readonly<DateFieldProps>) {
  const binding = useFieldBinding<string | null>({required, expect: NULLABLE_DATE_STRING});
  const adapter = usePickerAdapter();
  const {draft, change} = usePickerDraft(binding.value ?? null, dateFromString, dateToString, binding.setValue);

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <DatePicker
        enableAccessibleFieldDOMStructure={false}
        value={draft}
        onChange={change}
        onClose={binding.onBlur}
        disabled={disabled}
        autoFocus={autoFocus}
        minDate={dateFromString(adapter, minDate ?? null) ?? undefined}
        maxDate={dateFromString(adapter, maxDate ?? null) ?? undefined}
        disablePast={disablePast}
        disableFuture={disableFuture}
        slotProps={{
          textField: {
            id: binding.inputId,
            onBlur: binding.onBlur,
            error: binding.error !== null,
            fullWidth: true,
            inputProps: binding.inputProps,
          },
        }}
      />
    </FieldShell>
  );
}
```

`slotProps.textField.inputProps` is the one place this package uses MUI's older `inputProps` spelling: the picker merges its own attributes into it, and in MUI X 8 and 9 that is the prop the non-accessible field reads. If `aria-describedby` does not reach the input in the Step 2 test, check the rendered attributes with `screen.debug()` and move the attributes to `slotProps.textField.slotProps.htmlInput`.

`packages/form/src/pickers/TimePickerField.tsx`:

```tsx
import {TimePicker} from '@mui/x-date-pickers/TimePicker';

import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import type {ValueExpectation} from '../core/valueChecks';
import {isTimeString, timeFromString, timeToString} from './dateStrings';
import {usePickerDraft} from './usePickerDraft';

export interface TimePickerFieldProps extends CommonFieldProps {
  /** 12-hour clock. Defaults to the adapter locale's choice. */
  readonly ampm?: boolean;
  readonly minutesStep?: number;
}

const NULLABLE_TIME_STRING: ValueExpectation = {
  test: (value) => value === null || isTimeString(value),
  description: "an 'HH:mm' string or null",
};

/** A time of day, stored as `'HH:mm'`. */
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
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <TimePicker
        enableAccessibleFieldDOMStructure={false}
        value={draft}
        onChange={change}
        onClose={binding.onBlur}
        disabled={disabled}
        autoFocus={autoFocus}
        ampm={ampm}
        minutesStep={minutesStep}
        slotProps={{
          textField: {
            id: binding.inputId,
            onBlur: binding.onBlur,
            error: binding.error !== null,
            fullWidth: true,
            inputProps: binding.inputProps,
          },
        }}
      />
    </FieldShell>
  );
}
```

`packages/form/src/pickers/DateRangeField.tsx`:

```tsx
import Box from '@mui/material/Box';
import FormLabel from '@mui/material/FormLabel';
import {DatePicker} from '@mui/x-date-pickers/DatePicker';
import {usePickerAdapter} from '@mui/x-date-pickers/hooks';

import {useFormConfig} from '../config/FormConfigContext';
import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import type {FieldBinding} from '../core/useFieldBinding';
import type {ValueExpectation} from '../core/valueChecks';
import {NULLABLE_DATE_STRING} from './DateField';
import {dateFromString, dateToString} from './dateStrings';
import {usePickerDraft} from './usePickerDraft';

export interface DateRange {
  readonly start: string | null;
  readonly end: string | null;
}

export interface DateRangeFieldProps extends CommonFieldProps {
  readonly minDate?: string;
  readonly maxDate?: string;
}

const DATE_RANGE: ValueExpectation = {
  test: (value) =>
    typeof value === 'object' &&
    value !== null &&
    'start' in value &&
    'end' in value &&
    NULLABLE_DATE_STRING.test(value.start) &&
    NULLABLE_DATE_STRING.test(value.end),
  description: "{start, end} of 'YYYY-MM-DD' strings or null",
};

const EMPTY: DateRange = {start: null, end: null};

/**
 * Two linked date pickers in one fieldset. MUI's DateRangePicker is in the paid Pro
 * package. The end picker cannot go before the start; any other rule between the two
 * (a maximum length, end required once start is set) belongs in the schema.
 */
export function DateRangeField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  minDate,
  maxDate,
}: Readonly<DateRangeFieldProps>) {
  const binding = useFieldBinding<DateRange>({required, expect: DATE_RANGE});
  const {labels} = useFormConfig();
  const range = DATE_RANGE.test(binding.value) ? binding.value : EMPTY;

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
      as="fieldset"
    >
      <Box sx={{display: 'flex', gap: 1, flexWrap: 'wrap'}}>
        <RangeEnd
          binding={binding}
          side="start"
          caption={labels.rangeStart}
          value={range.start}
          onChange={(start) => binding.setValue({...range, start})}
          minDate={minDate}
          maxDate={range.end ?? maxDate}
          disabled={disabled}
          autoFocus={autoFocus}
        />
        <RangeEnd
          binding={binding}
          side="end"
          caption={labels.rangeEnd}
          value={range.end}
          onChange={(end) => binding.setValue({...range, end})}
          minDate={range.start ?? minDate}
          maxDate={maxDate}
          disabled={disabled}
        />
      </Box>
    </FieldShell>
  );
}

interface RangeEndProps {
  readonly binding: FieldBinding<DateRange>;
  readonly side: 'start' | 'end';
  readonly caption: string;
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
  readonly minDate?: string;
  readonly maxDate?: string;
  readonly disabled?: boolean;
  readonly autoFocus?: boolean;
}

function RangeEnd({binding, side, caption, value, onChange, minDate, maxDate, disabled, autoFocus}: RangeEndProps) {
  const adapter = usePickerAdapter();
  const {draft, change} = usePickerDraft(value, dateFromString, dateToString, onChange);
  const inputId = `${binding.inputId}-${side}`;

  return (
    <Box sx={{flex: 1, minWidth: 180}}>
      <FormLabel htmlFor={inputId} disabled={disabled} sx={{typography: 'caption'}}>
        {caption}
      </FormLabel>
      <DatePicker
        enableAccessibleFieldDOMStructure={false}
        value={draft}
        onChange={change}
        onClose={binding.onBlur}
        disabled={disabled}
        autoFocus={autoFocus}
        minDate={dateFromString(adapter, minDate ?? null) ?? undefined}
        maxDate={dateFromString(adapter, maxDate ?? null) ?? undefined}
        slotProps={{
          textField: {
            id: inputId,
            onBlur: binding.onBlur,
            error: binding.error !== null,
            fullWidth: true,
            inputProps: binding.inputProps,
          },
        }}
      />
    </Box>
  );
}
```

`src/pickers.ts`:

```ts
export {DateField} from './pickers/DateField';
export type {DateFieldProps} from './pickers/DateField';
export {DateRangeField} from './pickers/DateRangeField';
export type {DateRange, DateRangeFieldProps} from './pickers/DateRangeField';
export {TimePickerField} from './pickers/TimePickerField';
export type {TimePickerFieldProps} from './pickers/TimePickerField';
```

`NULLABLE_DATE_STRING` is exported from `DateField.tsx` for `DateRangeField` only; it is not in `pickers.ts`.

In `src/index.test.ts`: `const PICKERS_API = ['DateField', 'DateRangeField', 'TimePickerField'];`

- [ ] **Step 6: Run the tests to see them pass, then west of Greenwich**

Run: `pnpm vitest run --project @vt-labs/form src/pickers src/index.test.ts`
Expected: PASS.

Run: `TZ=America/Los_Angeles pnpm vitest run --project @vt-labs/form src/pickers`
Expected: PASS. A failure here showing `03/08/2026` is the UTC parse this task exists to avoid.

- [ ] **Step 7: Write the story**

The Storybook preview mounts no `LocalizationProvider`, so the story wraps its own. It uses date-fns because that is what promptiva runs.

`packages/form/src/stories/Pickers.stories.tsx`:

```tsx
import Stack from '@mui/material/Stack';
import {AdapterDateFns} from '@mui/x-date-pickers/AdapterDateFns';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, userEvent, within} from 'storybook/test';

import {DateField} from '../pickers/DateField';
import {DateRangeField} from '../pickers/DateRangeField';
import {TimePickerField} from '../pickers/TimePickerField';
import {FieldHarness} from '../test/FieldHarness';

const meta = {
  title: 'Form/Pickers',
  component: DateField,
  tags: ['autodocs'],
  args: {label: 'Start date', description: 'The first working day', required: true},
  decorators: [
    (Story) => (
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Story />
      </LocalizationProvider>
    ),
  ],
  render: (args) => (
    <FieldHarness defaultValue="2026-03-09">
      <DateField {...args} />
    </FieldHarness>
  ),
} satisfies Meta<typeof DateField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The form value is a plain `'YYYY-MM-DD'` string. */
export const Date: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText(/Start date/)).toHaveValue('03/09/2026');
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('"2026-03-09"');
  },
};

export const TimeAndRange: Story = {
  render: () => (
    <Stack spacing={2}>
      <FieldHarness defaultValue="09:00">
        <TimePickerField label="Opens at" ampm={false} />
      </FieldHarness>
      <FieldHarness defaultValue={{start: '2026-05-01', end: '2026-05-04'}}>
        <DateRangeField label="Stay" />
      </FieldHarness>
    </Stack>
  ),
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Opens at')).toHaveValue('09:00');
    await expect(canvas.getByRole('group', {name: 'Stay'})).toBeInTheDocument();
    await expect(canvas.getByLabelText('End')).toHaveValue('05/04/2026');
  },
};
```

`export const Date` shadows the global `Date` inside this module. Nothing in the file uses the global, but if oxlint's `no-shadow-restricted-names` or a similar rule objects, rename the story to `SingleDate`.

- [ ] **Step 8: Run the stories**

Run: `pnpm vitest run --project storybook packages/form`
Expected: PASS.

- [ ] **Step 9: Handoff**

Do not run git. Suggested message: `feat(form): add the pickers entry with DateField, TimePickerField and DateRangeField`

---

### Task 11: `@vt-labs/form/phone`

**Files:**

- Create: `src/phone/PhoneField.tsx`, `src/stories/Phone.stories.tsx`
- Test: `src/phone/PhoneField.test.tsx`
- Modify: `src/phone.ts`, `src/index.test.ts`

**Interfaces:**

- Consumes: `useFieldBinding`, `FieldShell`, `ValueExpectation`, `useFormConfig`, `FieldHarness`.
- Produces:
  ```ts
  PhoneField(props: PhoneFieldProps)   // defaultCountry?: MuiTelInputCountry, preferredCountries?: readonly MuiTelInputCountry[], placeholder?
  ```

The form holds E.164 (`'+4930123456'`) or `null`. The input shows the formatted text the user typed (`+49 30 123456`), kept as a local draft: two different drafts can map to the same E.164 value, so the form value cannot drive the display on its own. An outside change of the form value replaces the draft, the same rule as `NumberField` and the pickers.

The package exports no phone validator. `matchIsValidTel` from `mui-tel-input` loads libphonenumber's metadata, and a consumer who only wants "looks like a number" should not pay for that. The README shows the schema line for those who do.

- [ ] **Step 1: Write the failing tests**

`packages/form/src/phone/PhoneField.test.tsx`:

```tsx
import type {AnyFormApi} from '@tanstack/react-form';
import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createRef} from 'react';

import {FormConfigProvider} from '../config/FormConfigContext';
import {FieldHarness} from '../test/FieldHarness';
import {PhoneField} from './PhoneField';

describe('PhoneField', () => {
  it('stores E.164 while showing the formatted number', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <PhoneField label="Phone" defaultCountry="DE" />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Phone');
    await user.type(input, '30123456');
    expect(input).toHaveValue('+49 30 123456');

    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('"+4930123456"');
  });

  it('stores null when only the calling code is left', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue="+4930123456">
        <PhoneField label="Phone" />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Phone');
    await user.clear(input);
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('null');
  });

  it('shows a stored number and follows a value set from outside', () => {
    const formRef = createRef<AnyFormApi>();
    render(
      <FieldHarness defaultValue="+14155552671" formRef={formRef}>
        <PhoneField label="Phone" />
      </FieldHarness>,
    );
    expect(screen.getByLabelText('Phone')).toHaveValue('+1 415 555 2671');

    act(() => formRef.current?.setFieldValue('value', '+4930123456'));
    expect(screen.getByLabelText('Phone')).toHaveValue('+49 30 123456');

    act(() => formRef.current?.reset());
    expect(screen.getByLabelText('Phone')).toHaveValue('+1 415 555 2671');
  });

  it('names the country button from the labels', () => {
    render(
      <FormConfigProvider labels={{selectCountry: 'Land wählen'}}>
        <FieldHarness defaultValue={null}>
          <PhoneField label="Telefon" defaultCountry="DE" />
        </FieldHarness>
      </FormConfigProvider>,
    );
    expect(screen.getByRole('button', {name: 'Land wählen'})).toBeInTheDocument();
  });

  it('wires the error onto the input', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null} validate={(value) => (value ? undefined : 'Enter a phone number')}>
        <PhoneField label="Phone" required />
      </FieldHarness>,
    );
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    const input = screen.getByLabelText(/Phone/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a phone number');
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm vitest run --project @vt-labs/form src/phone`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `PhoneField`**

`packages/form/src/phone/PhoneField.tsx`:

```tsx
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
          const next = info.numberValue ?? null;
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
```

`MuiTelInput` renders an MUI `TextField` and forwards the props it does not own, so `id`, `slotProps.htmlInput` and `error` reach the input the same way they do in `TextField`. Two checks against the installed `mui-tel-input` 11 before moving on:

- If `FlagIconButtonProps` is not a prop in `node_modules/mui-tel-input/dist/index.d.ts`, look for the flag button in its `slotProps` type and pass the aria-label there.
- If `info.numberValue` is a non-null `'+49'` for an input holding only the calling code, the second test fails. Store `null` when `info.nationalNumber` is empty instead.

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm vitest run --project @vt-labs/form src/phone`
Expected: PASS.

- [ ] **Step 5: Export, pin, and write the story**

`src/phone.ts`:

```ts
export {PhoneField} from './phone/PhoneField';
export type {PhoneFieldProps} from './phone/PhoneField';
```

In `src/index.test.ts`: `const PHONE_API = ['PhoneField'];`

`packages/form/src/stories/Phone.stories.tsx`:

```tsx
import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, userEvent, within} from 'storybook/test';

import {PhoneField} from '../phone/PhoneField';
import {FieldHarness} from '../test/FieldHarness';

const meta = {
  title: 'Form/Phone',
  component: PhoneField,
  tags: ['autodocs'],
  args: {
    label: 'Phone',
    description: 'We text you when the job starts',
    defaultCountry: 'IN',
    preferredCountries: ['IN', 'DE', 'GB'],
  },
  render: (args) => (
    <FieldHarness defaultValue={null}>
      <PhoneField {...args} />
    </FieldHarness>
  ),
} satisfies Meta<typeof PhoneField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The form value is E.164; the input keeps the user's formatting. */
export const Default: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Phone'), '9876543210');
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}));
    await expect(canvas.getByLabelText('Submitted value')).toHaveTextContent('"+919876543210"');
  },
};
```

- [ ] **Step 6: Run everything for the package**

Run: `pnpm vitest run --project @vt-labs/form && pnpm vitest run --project storybook packages/form`
Expected: PASS.

- [ ] **Step 7: Handoff**

Do not run git. Suggested message: `feat(form): add the phone entry with PhoneField`

---

### Task 12: `@vt-labs/form/maps`

**Files:**

- Create: `src/maps/types.ts`, `src/maps/googlePlaces.ts`, `src/maps/googlePlaces.typetest.ts`, `src/maps/usePlacesSession.ts`, `src/maps/LocationSearchField.tsx`, `src/maps/AddressField.tsx`, `src/test/fakePlaces.ts`, `src/stories/Maps.stories.tsx`
- Test: `src/maps/googlePlaces.test.ts`, `src/maps/LocationSearchField.test.tsx`, `src/maps/AddressField.test.tsx`
- Modify: `src/maps.ts`, `src/index.test.ts`

**Interfaces:**

- Consumes: `AsyncAutocompleteInput` (Task 8), `useFieldBinding`, `FieldShell`, `TextField` (Task 2), `fieldContext` from `src/context.ts` (Task 1), `applyServerErrors` (Task 4, in the test), `FieldHarness`.
- Produces:
  ```ts
  interface Place {id: string; label: string; lat: number; lng: number}
  interface Address {line1: string; line2: string; city: string; region: string; postalCode: string; country: string}
  const EMPTY_ADDRESS: Address
  interface PlaceSuggestion {id: string; label: string; secondary?: string}
  interface ResolvedPlace extends Place {address: Address}
  interface PlacesProvider {
    newSession(): object;
    suggest(query: string, options: {signal: AbortSignal; session: object}): Promise<readonly PlaceSuggestion[]>;
    resolve(id: string, options: {session: object}): Promise<ResolvedPlace>;
  }
  interface GooglePlaces { ... }   // structural subset of google.maps.PlacesLibrary
  function createGooglePlacesProvider(places: GooglePlaces, options?: {includedRegionCodes?: readonly string[]}): PlacesProvider
  function usePlacesSession(provider: PlacesProvider): {current(): object; end(): void}   // internal
  LocationSearchField(props: LocationSearchFieldProps)   // provider, placeholder?, minQueryLength? (3)
  AddressField(props: AddressFieldProps)                 // provider, searchPlaceholder?
  ```

Rules for this entry:

- No Google script loader and no `@types/google.maps` in the published types. The consumer loads the library (`await google.maps.importLibrary('places')`) and hands it to `createGooglePlacesProvider`. The package describes the few members it calls with its own `GooglePlaces` interface; a type test proves the real `PlacesLibrary` fits it, and Task 13's graph check fails if `google.maps` appears in any `.d.ts`.
- The fields talk to `PlacesProvider`, not to Google. A test passes a fake, and a consumer on another geocoder writes their own provider.
- Billing: Google charges per autocomplete session, and a session ends at the Place Details call. `usePlacesSession` starts a session with the first keystroke and ends it after `resolve`, so a search-and-pick is one session however many keystrokes it took.
- A session is an opaque `object` to the fields. The spec said `unknown`; `object` lets the Google provider pass it on without a cast, and a fake can return `{}`.

- [ ] **Step 1: Write the types**

`packages/form/src/maps/types.ts`:

```ts
/** What `LocationSearchField` stores: a point and something to show for it. */
export interface Place {
  readonly id: string;
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
}

/** What `AddressField` stores. Every part is a string so each renders as a text field. */
export interface Address {
  readonly line1: string;
  readonly line2: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
  /** ISO 3166-1 alpha-2 when it came from a provider; whatever the user typed otherwise. */
  readonly country: string;
}

/** For `defaultValues`. */
export const EMPTY_ADDRESS: Address = {line1: '', line2: '', city: '', region: '', postalCode: '', country: ''};

export interface PlaceSuggestion {
  readonly id: string;
  readonly label: string;
  readonly secondary?: string;
}

export interface ResolvedPlace extends Place {
  readonly address: Address;
}

/**
 * The geocoder behind the maps fields. `createGooglePlacesProvider` is one; a test fake or
 * another service is another.
 */
export interface PlacesProvider {
  /** Starts a billing session. Called on the first keystroke of a search. */
  newSession(): object;
  suggest(
    query: string,
    options: {readonly signal: AbortSignal; readonly session: object},
  ): Promise<readonly PlaceSuggestion[]>;
  /** Ends the session the suggestion came from. */
  resolve(id: string, options: {readonly session: object}): Promise<ResolvedPlace>;
}
```

`types.ts` holds `EMPTY_ADDRESS`, a value, and the root coverage config excludes `**/types.ts`. That is fine: a constant has no branch to cover.

- [ ] **Step 2: Write the failing Google adapter tests**

`packages/form/src/maps/googlePlaces.test.ts`:

```ts
import {createGooglePlacesProvider} from './googlePlaces';
import type {GooglePlace, GooglePlaces} from './googlePlaces';

function fakeGoogle() {
  const requests: {input: string; sessionToken?: object; includedRegionCodes?: string[]}[] = [];
  const fetchedFields: string[][] = [];

  const berlinPlace: GooglePlace = {
    id: 'berlin-1',
    formattedAddress: 'Unter den Linden 1, 10117 Berlin, Germany',
    location: {lat: () => 52.517, lng: () => 13.389},
    addressComponents: [
      {longText: '1', shortText: '1', types: ['street_number']},
      {longText: 'Unter den Linden', shortText: 'Unter den Linden', types: ['route']},
      {longText: 'Berlin', shortText: 'Berlin', types: ['locality', 'political']},
      {longText: 'Berlin', shortText: 'BE', types: ['administrative_area_level_1', 'political']},
      {longText: '10117', shortText: '10117', types: ['postal_code']},
      {longText: 'Germany', shortText: 'DE', types: ['country', 'political']},
    ],
    fetchFields: async ({fields}) => {
      fetchedFields.push(fields);
      return {place: berlinPlace};
    },
  };

  const google: GooglePlaces = {
    AutocompleteSessionToken: class {},
    Place: class {
      constructor() {
        throw new Error('resolve should use the cached prediction, not a new Place');
      }
    } as GooglePlaces['Place'],
    AutocompleteSuggestion: {
      fetchAutocompleteSuggestions: async (request) => {
        requests.push(request);
        return {
          suggestions: [
            {
              placePrediction: {
                placeId: 'berlin-1',
                text: {text: 'Unter den Linden 1, Berlin, Germany'},
                mainText: {text: 'Unter den Linden 1'},
                secondaryText: {text: 'Berlin, Germany'},
                toPlace: () => berlinPlace,
              },
            },
            {placePrediction: null},
          ],
        };
      },
    },
  };
  return {google, requests, fetchedFields};
}

describe('createGooglePlacesProvider', () => {
  it('turns predictions into suggestions, passing the session and region filter', async () => {
    const {google, requests} = fakeGoogle();
    const provider = createGooglePlacesProvider(google, {includedRegionCodes: ['de']});
    const session = provider.newSession();

    const suggestions = await provider.suggest('unter', {signal: new AbortController().signal, session});

    expect(suggestions).toEqual([{id: 'berlin-1', label: 'Unter den Linden 1', secondary: 'Berlin, Germany'}]);
    expect(requests[0]).toMatchObject({input: 'unter', sessionToken: session, includedRegionCodes: ['de']});
  });

  it('resolves through the cached prediction and maps the address', async () => {
    const {google, fetchedFields} = fakeGoogle();
    const provider = createGooglePlacesProvider(google);
    const session = provider.newSession();
    await provider.suggest('unter', {signal: new AbortController().signal, session});

    const place = await provider.resolve('berlin-1', {session});

    expect(fetchedFields[0]).toEqual(['addressComponents', 'location', 'formattedAddress']);
    expect(place).toEqual({
      id: 'berlin-1',
      label: 'Unter den Linden 1, 10117 Berlin, Germany',
      lat: 52.517,
      lng: 13.389,
      address: {
        line1: '1 Unter den Linden',
        line2: '',
        city: 'Berlin',
        region: 'Berlin',
        postalCode: '10117',
        country: 'DE',
      },
    });
  });

  it('rejects when the request was aborted while Google answered', async () => {
    const {google} = fakeGoogle();
    const provider = createGooglePlacesProvider(google);
    const controller = new AbortController();
    const pending = provider.suggest('unter', {signal: controller.signal, session: provider.newSession()});
    controller.abort();
    await expect(pending).rejects.toBeDefined();
  });
});
```

`as GooglePlaces['Place']` narrows a class expression to the constructor type the interface names, which is an ordinary assertion, not `as unknown as`. If oxlint's type-aware pass calls it unnecessary, drop it.

The line-one format (`'1 Unter den Linden'`, number first) is the US and UK order. German addresses put the number after the street. The provider returns Google's parts in one fixed order and the user edits the line if it reads wrong; per-country formatting is not in this package.

- [ ] **Step 3: Run the tests to see them fail**

Run: `pnpm vitest run --project @vt-labs/form src/maps/googlePlaces`
Expected: FAIL, module not found.

- [ ] **Step 4: Write the Google adapter and its type test**

`packages/form/src/maps/googlePlaces.ts`:

```ts
import type {Address, PlaceSuggestion, PlacesProvider, ResolvedPlace} from './types';

/*
 * The members of `google.maps.PlacesLibrary` this file calls, described structurally so
 * the published types do not depend on `@types/google.maps`. `googlePlaces.typetest.ts`
 * checks that the real library still fits.
 */
interface GoogleText {
  readonly text: string;
}

interface GoogleAddressComponent {
  readonly longText: string | null;
  readonly shortText: string | null;
  readonly types: readonly string[];
}

export interface GooglePlace {
  readonly id: string;
  readonly formattedAddress?: string | null;
  readonly location?: {lat(): number; lng(): number} | null;
  readonly addressComponents?: readonly GoogleAddressComponent[] | null;
  fetchFields(options: {fields: string[]}): Promise<{place: GooglePlace}>;
}

interface GooglePlacePrediction {
  readonly placeId: string;
  readonly text: GoogleText;
  readonly mainText: GoogleText | null;
  readonly secondaryText: GoogleText | null;
  toPlace(): GooglePlace;
}

export interface GooglePlaces {
  readonly AutocompleteSessionToken: new () => object;
  readonly Place: new (options: {id: string}) => GooglePlace;
  readonly AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(request: {
      input: string;
      sessionToken?: object;
      includedRegionCodes?: string[];
    }): Promise<{suggestions: readonly {readonly placePrediction: GooglePlacePrediction | null}[]}>;
  };
}

export interface GooglePlacesOptions {
  /** Up to 15 CLDR region codes (`['de', 'at']`) to restrict suggestions to. */
  readonly includedRegionCodes?: readonly string[];
}

const PLACE_FIELDS = ['addressComponents', 'location', 'formattedAddress'];

/**
 * A `PlacesProvider` on the Places API (New). Load the library yourself and pass it in:
 *
 *   const places = await google.maps.importLibrary('places');
 *   const provider = createGooglePlacesProvider(places);
 */
export function createGooglePlacesProvider(places: GooglePlaces, options: GooglePlacesOptions = {}): PlacesProvider {
  // Predictions from a session, kept so `resolve` can call `toPlace()`, which carries the
  // session token into the details request and closes the session for billing.
  const predictions = new WeakMap<object, Map<string, GooglePlacePrediction>>();

  return {
    newSession: () => new places.AutocompleteSessionToken(),

    async suggest(query, {signal, session}) {
      const {suggestions} = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
        sessionToken: session,
        includedRegionCodes: options.includedRegionCodes ? [...options.includedRegionCodes] : undefined,
      });
      // Google's call takes no signal. The request still completes; its answer is dropped.
      signal.throwIfAborted();

      const cache = predictions.get(session) ?? new Map<string, GooglePlacePrediction>();
      predictions.set(session, cache);
      return suggestions.flatMap(({placePrediction: prediction}): PlaceSuggestion[] => {
        if (!prediction) return [];
        cache.set(prediction.placeId, prediction);
        return [
          {
            id: prediction.placeId,
            label: prediction.mainText?.text ?? prediction.text.text,
            secondary: prediction.secondaryText?.text,
          },
        ];
      });
    },

    async resolve(id, {session}) {
      const place = predictions.get(session)?.get(id)?.toPlace() ?? new places.Place({id});
      const {place: detailed} = await place.fetchFields({fields: PLACE_FIELDS});
      return {
        id,
        label: detailed.formattedAddress ?? '',
        lat: detailed.location?.lat() ?? 0,
        lng: detailed.location?.lng() ?? 0,
        address: toAddress(detailed.addressComponents ?? []),
      };
    },
  };
}

function toAddress(components: readonly GoogleAddressComponent[]): Address {
  const part = (type: string, form: 'longText' | 'shortText' = 'longText') =>
    components.find((component) => component.types.includes(type))?.[form] ?? '';
  return {
    line1: [part('street_number'), part('route')].filter(Boolean).join(' ') || part('premise'),
    line2: part('subpremise'),
    city: part('locality') || part('postal_town') || part('administrative_area_level_2'),
    region: part('administrative_area_level_1'),
    postalCode: part('postal_code'),
    country: part('country', 'shortText'),
  };
}
```

A place with no `location` resolves to `0, 0`. The Places API returns a location for every place it can suggest, so this is a guard for a partial fake, not a state a user reaches; if it ever shows up in practice, the fix is to reject in `resolve`, not to store null island.

`packages/form/src/maps/googlePlaces.typetest.ts`:

```ts
/// <reference types="google.maps" />
/**
 * Compile-time only (excluded from the build and from the test run). Fails `pnpm
 * typecheck` if a `@types/google.maps` release changes a member `createGooglePlacesProvider`
 * relies on. Fix `GooglePlaces` to match; never cast here.
 */
import type {GooglePlaces} from './googlePlaces';

declare const library: google.maps.PlacesLibrary;
export const fits: GooglePlaces = library;
```

- [ ] **Step 5: Run the adapter tests and the typecheck**

Run: `pnpm vitest run --project @vt-labs/form src/maps/googlePlaces && pnpm --filter @vt-labs/form typecheck`
Expected: PASS, and typecheck exits 0. If the type test fails, read the error: it names the member of `PlacesLibrary` that does not fit. Loosen `GooglePlaces` to what Google's type actually says (for example `readonly` arrays, or a `null` the real type allows).

- [ ] **Step 6: Write the fake provider and the failing field tests**

`packages/form/src/test/fakePlaces.ts`:

```ts
import type {PlacesProvider, ResolvedPlace} from '../maps/types';

/** A `PlacesProvider` over a fixed list, recording what the fields asked for. */
export function createFakePlaces(places: readonly ResolvedPlace[]) {
  const log = {sessions: [] as object[], suggestSessions: [] as object[], resolveSessions: [] as object[]};

  const provider: PlacesProvider = {
    newSession() {
      const session = {n: log.sessions.length + 1};
      log.sessions.push(session);
      return session;
    },
    async suggest(query, {session}) {
      log.suggestSessions.push(session);
      return places
        .filter((place) => place.label.toLowerCase().includes(query.toLowerCase()))
        .map((place) => ({id: place.id, label: place.label}));
    },
    async resolve(id, {session}) {
      log.resolveSessions.push(session);
      const place = places.find((candidate) => candidate.id === id);
      if (!place) throw new Error(`no place ${id}`);
      return place;
    },
  };
  return {provider, log};
}

export const BERLIN: ResolvedPlace = {
  id: 'berlin',
  label: 'Unter den Linden 1, Berlin',
  lat: 52.517,
  lng: 13.389,
  address: {
    line1: 'Unter den Linden 1',
    line2: '',
    city: 'Berlin',
    region: 'Berlin',
    postalCode: '10117',
    country: 'DE',
  },
};

export const PUNE: ResolvedPlace = {
  id: 'pune',
  label: 'FC Road, Pune',
  lat: 18.52,
  lng: 73.84,
  address: {line1: 'FC Road', line2: '', city: 'Pune', region: 'Maharashtra', postalCode: '411004', country: 'IN'},
};
```

`[] as object[]` types an empty array literal; it is not a cast past a mismatch.

`packages/form/src/maps/LocationSearchField.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {BERLIN, PUNE, createFakePlaces} from '../test/fakePlaces';
import {FieldHarness} from '../test/FieldHarness';
import {LocationSearchField} from './LocationSearchField';

describe('LocationSearchField', () => {
  it('stores the resolved place', async () => {
    const user = userEvent.setup();
    const {provider} = createFakePlaces([BERLIN, PUNE]);
    render(
      <FieldHarness defaultValue={null}>
        <LocationSearchField label="Pickup" provider={provider} debounceMs={0} />
      </FieldHarness>,
    );
    await user.type(screen.getByRole('combobox', {name: 'Pickup'}), 'pune');
    await user.click(await screen.findByRole('option', {name: 'FC Road, Pune'}));
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent(
      '{"id":"pune","label":"FC Road, Pune","lat":18.52,"lng":73.84}',
    );
  });

  it('asks nothing below three characters', async () => {
    const user = userEvent.setup();
    const {provider, log} = createFakePlaces([BERLIN]);
    render(
      <FieldHarness defaultValue={null}>
        <LocationSearchField label="Pickup" provider={provider} debounceMs={0} />
      </FieldHarness>,
    );
    await user.type(screen.getByRole('combobox', {name: 'Pickup'}), 'be');
    expect(log.suggestSessions).toHaveLength(0);
  });

  it('uses one session per search-and-pick, and a new one for the next search', async () => {
    const user = userEvent.setup();
    const {provider, log} = createFakePlaces([BERLIN, PUNE]);
    render(
      <FieldHarness defaultValue={null}>
        <LocationSearchField label="Pickup" provider={provider} debounceMs={0} />
      </FieldHarness>,
    );
    const input = screen.getByRole('combobox', {name: 'Pickup'});
    await user.type(input, 'unter');
    await user.click(await screen.findByRole('option', {name: 'Unter den Linden 1, Berlin'}));
    expect(log.sessions).toHaveLength(1);
    expect(new Set([...log.suggestSessions, ...log.resolveSessions]).size).toBe(1);

    await user.clear(input);
    await user.type(input, 'pune');
    await screen.findByRole('option', {name: 'FC Road, Pune'});
    expect(log.sessions).toHaveLength(2);
  });

  it('shows a stored place', () => {
    const {provider} = createFakePlaces([]);
    render(
      <FieldHarness defaultValue={{id: 'berlin', label: 'Unter den Linden 1, Berlin', lat: 52.5, lng: 13.4}}>
        <LocationSearchField label="Pickup" provider={provider} />
      </FieldHarness>,
    );
    expect(screen.getByRole('combobox', {name: 'Pickup'})).toHaveValue('Unter den Linden 1, Berlin');
  });
});
```

`packages/form/src/maps/AddressField.test.tsx`:

```tsx
import type {AnyFormApi} from '@tanstack/react-form';
import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createRef} from 'react';

import {applyServerErrors} from '../serverErrors';
import {BERLIN, createFakePlaces} from '../test/fakePlaces';
import {FieldHarness} from '../test/FieldHarness';
import {AddressField} from './AddressField';
import {EMPTY_ADDRESS} from './types';

describe('AddressField', () => {
  it('fills every part from a search, and keeps a manual edit', async () => {
    const user = userEvent.setup();
    const {provider} = createFakePlaces([BERLIN]);
    render(
      <FieldHarness defaultValue={EMPTY_ADDRESS}>
        <AddressField label="Billing address" provider={provider} debounceMs={0} />
      </FieldHarness>,
    );
    expect(screen.getByRole('group', {name: 'Billing address'})).toBeInTheDocument();

    await user.type(screen.getByRole('combobox', {name: 'Search for an address'}), 'unter');
    await user.click(await screen.findByRole('option', {name: 'Unter den Linden 1, Berlin'}));
    expect(screen.getByLabelText('City')).toHaveValue('Berlin');

    await user.type(screen.getByLabelText('Address line 2'), 'Floor 3');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(JSON.parse(screen.getByLabelText('Submitted value').textContent ?? '')).toEqual({
      ...BERLIN.address,
      line2: 'Floor 3',
    });
  });

  it('marks line 1, city, postal code and country as required', () => {
    const {provider} = createFakePlaces([]);
    render(
      <FieldHarness defaultValue={EMPTY_ADDRESS}>
        <AddressField label="Address" provider={provider} required />
      </FieldHarness>,
    );
    expect(screen.getByLabelText(/Address line 1/)).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText(/City/)).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText(/Address line 2/)).not.toHaveAttribute('aria-required');
    expect(screen.getByLabelText(/State or region/)).not.toHaveAttribute('aria-required');
  });

  it('shows a server error on the part it names', () => {
    const formRef = createRef<AnyFormApi>();
    const {provider} = createFakePlaces([]);
    render(
      <FieldHarness defaultValue={EMPTY_ADDRESS} formRef={formRef}>
        <AddressField label="Address" provider={provider} />
      </FieldHarness>,
    );
    act(() => {
      if (formRef.current)
        applyServerErrors(formRef.current, {fields: {'value.postalCode': 'We do not deliver there'}});
    });
    expect(screen.getByLabelText('Postal code')).toHaveAccessibleDescription('We do not deliver there');
  });
});
```

The labels in these tests (`Search for an address`, `Address line 1`, `City`, `State or region`, `Postal code`) are the English defaults from `DEFAULT_FORM_LABELS` (Task 1). If a default there reads differently, the test follows the default, not the other way round.

- [ ] **Step 7: Run the field tests to see them fail**

Run: `pnpm vitest run --project @vt-labs/form src/maps`
Expected: the adapter tests PASS; the two field test files FAIL, modules not found.

- [ ] **Step 8: Write the session hook and the two fields**

`packages/form/src/maps/usePlacesSession.ts`:

```ts
import {useMemo, useRef} from 'react';

import type {PlacesProvider} from './types';

/** One billing session from the first keystroke of a search to the pick that ends it. */
export function usePlacesSession(provider: PlacesProvider) {
  const session = useRef<object | null>(null);
  return useMemo(
    () => ({
      current: () => (session.current ??= provider.newSession()),
      end: () => {
        session.current = null;
      },
    }),
    [provider],
  );
}
```

`packages/form/src/maps/LocationSearchField.tsx`:

```tsx
import {useRef} from 'react';

import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import type {ValueExpectation} from '../core/valueChecks';
import {AsyncAutocompleteInput} from '../fields/AsyncAutocompleteInput';
import type {Place, PlaceSuggestion, PlacesProvider} from './types';
import {usePlacesSession} from './usePlacesSession';

export interface LocationSearchFieldProps extends CommonFieldProps {
  readonly provider: PlacesProvider;
  readonly placeholder?: string;
  /** Characters typed before the first request. Each request costs money. */
  readonly minQueryLength?: number;
  readonly debounceMs?: number;
}

const NULLABLE_PLACE: ValueExpectation = {
  test: (value) => value === null || (typeof value === 'object' && 'id' in value && 'lat' in value && 'lng' in value),
  description: 'a Place ({id, label, lat, lng}) or null',
};

/** Search for a place and store where it is. */
export function LocationSearchField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  provider,
  placeholder,
  minQueryLength = 3,
  debounceMs,
}: Readonly<LocationSearchFieldProps>) {
  const binding = useFieldBinding<Place | null>({required, expect: NULLABLE_PLACE});
  const session = usePlacesSession(provider);
  const latestPick = useRef(0);
  const place = NULLABLE_PLACE.test(binding.value) ? binding.value : null;

  const pick = async (suggestion: PlaceSuggestion | null) => {
    const pickId = ++latestPick.current;
    if (!suggestion) {
      binding.setValue(null);
      return;
    }
    const current = session.current();
    session.end();
    // A failed lookup leaves the field as it was. The provider is the consumer's code and
    // is where a failure gets reported; a required schema catches the empty value on submit.
    const resolved = await provider.resolve(suggestion.id, {session: current}).catch(() => null);
    if (resolved && pickId === latestPick.current) {
      binding.setValue({id: resolved.id, label: resolved.label, lat: resolved.lat, lng: resolved.lng});
    }
  };

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <AsyncAutocompleteInput<PlaceSuggestion>
        binding={binding}
        value={place ? {id: place.id, label: place.label} : null}
        onChange={(next) => void pick(Array.isArray(next) ? (next[0] ?? null) : next)}
        loadOptions={(query, {signal}) => provider.suggest(query, {signal, session: session.current()})}
        getOptionValue={(suggestion) => suggestion.id}
        getOptionLabel={(suggestion) => suggestion.label}
        minQueryLength={minQueryLength}
        debounceMs={debounceMs}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
      />
    </FieldShell>
  );
}
```

`debounceMs` is a prop here and on `AddressField` because the tests need it at 0 and a consumer may want a longer wait to save requests. `AsyncAutocompleteInput` defaults it to 300.

`packages/form/src/maps/AddressField.tsx`:

```tsx
import Box from '@mui/material/Box';
import {useField} from '@tanstack/react-form';
import type {AnyFieldApi} from '@tanstack/react-form';
import {useRef} from 'react';

import {useFormConfig} from '../config/FormConfigContext';
import type {FormLabels} from '../config/labels';
import {fieldContext, useFieldContext} from '../context';
import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import type {ValueExpectation} from '../core/valueChecks';
import {AsyncAutocompleteInput} from '../fields/AsyncAutocompleteInput';
import {TextField} from '../fields/TextField';
import type {Address, PlaceSuggestion, PlacesProvider} from './types';
import {usePlacesSession} from './usePlacesSession';

export interface AddressFieldProps extends CommonFieldProps {
  readonly provider: PlacesProvider;
  readonly searchPlaceholder?: string;
  readonly minQueryLength?: number;
  readonly debounceMs?: number;
}

const PARTS = [
  {key: 'line1', label: 'addressLine1', required: true, autoComplete: 'address-line1'},
  {key: 'line2', label: 'addressLine2', required: false, autoComplete: 'address-line2'},
  {key: 'city', label: 'city', required: true, autoComplete: 'address-level2'},
  {key: 'region', label: 'region', required: false, autoComplete: 'address-level1'},
  {key: 'postalCode', label: 'postalCode', required: true, autoComplete: 'postal-code'},
  {key: 'country', label: 'country', required: true, autoComplete: 'country'},
] as const satisfies readonly {key: keyof Address; label: keyof FormLabels; required: boolean; autoComplete: string}[];

const ADDRESS: ValueExpectation = {
  test: (value) => typeof value === 'object' && value !== null && PARTS.every(({key}) => key in value),
  description: 'an Address object (EMPTY_ADDRESS is a valid start)',
};

/**
 * A postal address: a search box that fills the parts, and the parts as ordinary text
 * fields the user can correct. Each part is its own TanStack field at `<name>.city` and
 * so on, so a schema or a server error on `address.city` shows under City.
 */
export function AddressField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  provider,
  searchPlaceholder,
  minQueryLength = 3,
  debounceMs,
}: Readonly<AddressFieldProps>) {
  const binding = useFieldBinding<Address>({expect: ADDRESS});
  const parent = useFieldContext<Address>();
  const {labels} = useFormConfig();
  const session = usePlacesSession(provider);
  const latestPick = useRef(0);

  const pick = async (suggestion: PlaceSuggestion | null) => {
    if (!suggestion) return;
    const pickId = ++latestPick.current;
    const current = session.current();
    session.end();
    const resolved = await provider.resolve(suggestion.id, {session: current}).catch(() => null);
    if (resolved && pickId === latestPick.current) binding.setValue(resolved.address);
  };

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
      as="fieldset"
    >
      <Box sx={{display: 'grid', gap: 1, gridTemplateColumns: {xs: '1fr', sm: '1fr 1fr'}}}>
        <Box sx={{gridColumn: '1 / -1'}}>
          <AsyncAutocompleteInput<PlaceSuggestion>
            binding={{...binding, inputProps: {...binding.inputProps, 'aria-label': labels.searchAddress}}}
            value={null}
            onChange={(next) => void pick(Array.isArray(next) ? (next[0] ?? null) : next)}
            loadOptions={(query, {signal}) => provider.suggest(query, {signal, session: session.current()})}
            getOptionValue={(suggestion) => suggestion.id}
            getOptionLabel={(suggestion) => suggestion.label}
            minQueryLength={minQueryLength}
            debounceMs={debounceMs}
            placeholder={searchPlaceholder}
            autoFocus={autoFocus}
            disabled={disabled}
          />
        </Box>
        {PARTS.map((part) => (
          <Box key={part.key} sx={part.key === 'line1' || part.key === 'line2' ? {gridColumn: '1 / -1'} : undefined}>
            <AddressPart
              parent={parent}
              name={part.key}
              label={labels[part.label]}
              required={required === true && part.required}
              autoComplete={part.autoComplete}
              disabled={disabled}
            />
          </Box>
        ))}
      </Box>
    </FieldShell>
  );
}

interface AddressPartProps {
  readonly parent: AnyFieldApi;
  readonly name: keyof Address;
  readonly label: string;
  readonly required: boolean;
  readonly autoComplete: string;
  readonly disabled?: boolean;
}

/** Mounts `<parent>.<name>` as a real field and renders `TextField` inside it. */
function AddressPart({parent, name, label, required, autoComplete, disabled}: AddressPartProps) {
  const field = useField({form: parent.form, name: `${parent.name}.${name}`});
  return (
    <fieldContext.Provider value={field}>
      <TextField label={label} required={required} autoComplete={autoComplete} disabled={disabled} />
    </fieldContext.Provider>
  );
}
```

Two things to check while this goes green:

- `useFieldContext<Address>()` returns the field API with the form's types erased. If `useField({form: parent.form, name: ...})` does not typecheck against it, look at the parameter type `useField` declares in `node_modules/@tanstack/react-form/dist/esm/useField.d.ts` and type `parent` as what it wants. Do not cast. If no honest type fits, stop and report; the fallback is rendering the parts through `form.AppField` from `useFormContext()`, which is a design change the user should see.
- The search box's accessible name comes from `aria-label` on its input, and the fieldset's legend names the group. If axe reports the search input as having two names, drop the `aria-label` and render a visually hidden `<label htmlFor>` with `labels.searchAddress` instead.

- [ ] **Step 9: Run the maps tests to see them pass**

Run: `pnpm vitest run --project @vt-labs/form src/maps`
Expected: PASS.

- [ ] **Step 10: Export and pin**

`src/maps.ts`:

```ts
export {AddressField} from './maps/AddressField';
export type {AddressFieldProps} from './maps/AddressField';
export {createGooglePlacesProvider} from './maps/googlePlaces';
export type {GooglePlaces, GooglePlacesOptions} from './maps/googlePlaces';
export {LocationSearchField} from './maps/LocationSearchField';
export type {LocationSearchFieldProps} from './maps/LocationSearchField';
export {EMPTY_ADDRESS} from './maps/types';
export type {Address, Place, PlaceSuggestion, PlacesProvider, ResolvedPlace} from './maps/types';
```

In `src/index.test.ts`: `const MAPS_API = ['AddressField', 'EMPTY_ADDRESS', 'LocationSearchField', 'createGooglePlacesProvider'];`

- [ ] **Step 11: Write the story**

The story runs on the fake provider, so it needs no API key and makes no request.

`packages/form/src/stories/Maps.stories.tsx`:

```tsx
import Stack from '@mui/material/Stack';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, screen, userEvent, within} from 'storybook/test';

import {AddressField} from '../maps/AddressField';
import {LocationSearchField} from '../maps/LocationSearchField';
import {EMPTY_ADDRESS} from '../maps/types';
import {BERLIN, PUNE, createFakePlaces} from '../test/fakePlaces';
import {FieldHarness} from '../test/FieldHarness';

const {provider} = createFakePlaces([BERLIN, PUNE]);

function Demo() {
  return (
    <Stack spacing={3}>
      <FieldHarness defaultValue={null}>
        <LocationSearchField label="Pickup point" provider={provider} placeholder="Type three letters" />
      </FieldHarness>
      <FieldHarness defaultValue={EMPTY_ADDRESS}>
        <AddressField label="Billing address" provider={provider} required />
      </FieldHarness>
    </Stack>
  );
}

const meta = {
  title: 'Form/Maps',
  component: Demo,
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Runs on a fake provider. In an app, pass `createGooglePlacesProvider(await google.maps.importLibrary('places'))`. */
export const Default: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('combobox', {name: 'Search for an address'}), 'pune');
    await userEvent.click(await screen.findByRole('option', {name: 'FC Road, Pune'}));
    await expect(canvas.getByLabelText(/City/)).toHaveValue('Pune');
    await expect(canvas.getByLabelText(/Postal code/)).toHaveValue('411004');
  },
};
```

- [ ] **Step 12: Run everything for the package**

Run: `pnpm vitest run --project @vt-labs/form && pnpm vitest run --project storybook packages/form && pnpm --filter @vt-labs/form typecheck`
Expected: PASS, typecheck exits 0.

- [ ] **Step 13: Handoff**

Do not run git. Suggested message: `feat(form): add the maps entry with LocationSearchField, AddressField and a Google Places provider`

---

### Task 13: Prove the leanness

**Files:**

- Create: `packages/form/scripts/check-graph.mjs`, `packages/form/scripts/check-fixture.mjs`, `packages/form/fixtures/consumer/index.html`, `packages/form/fixtures/consumer/src/main.tsx`, `packages/form/fixtures/consumer/src/SignIn.tsx`, `packages/form/fixtures/consumer/src/BirthdayField.tsx`, `packages/form/.size-limit.json`
- Modify: `packages/form/package.json` (scripts, devDependencies), `turbo.json`, root `package.json` (`validate`, `validate:ci`)

**Interfaces:**

- Consumes: the built `dist/` from Tasks 1 to 12.
- Produces: `pnpm --filter @vt-labs/form verify`, and a turbo `verify` task that `pnpm validate` runs.

Four checks, each catching a different way the package can end up heavy in someone's app:

| Check               | Catches                                                                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-graph.mjs`   | An entry importing another entry's peer; the MUI barrel; any date library, icon pack or `libphonenumber-js`; a bare import that is not a declared peer; `google.maps` in a `.d.ts` |
| `check-fixture.mjs` | A real Vite app build: the sign-in form's main chunk holding picker, phone or date-library code; `lazyField` failing to split                                                      |
| size-limit          | Our own code growing past its budget, per entry, peers excluded                                                                                                                    |
| publint and attw    | `exports` and `types` that resolve wrong for a consumer's bundler or `tsc`                                                                                                         |

- [ ] **Step 1: Write the graph check**

`packages/form/scripts/check-graph.mjs`:

```js
// Walks dist/ from each entry along relative imports and checks every bare import it
// reaches. The build marks every bare specifier external, so what this sees is exactly
// what a consumer's bundler will be asked to resolve. Decision 0009 has the reasoning.
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const {peerDependencies = {}} = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const PICKERS = '@mui/x-date-pickers';
const PHONE = 'mui-tel-input';
const FORBIDDEN_BY_ENTRY = {
  index: [PICKERS, PHONE],
  pickers: [PHONE],
  phone: [PICKERS],
  maps: [PICKERS, PHONE],
};
// Never, from any entry: the MUI barrel, an icon pack, a date library, phone metadata.
const FORBIDDEN_EVERYWHERE = [/^@mui\/material$/, /^@mui\/icons-material/, /^date-fns/, /^dayjs/, /^libphonenumber-js/];

// Rolldown emits one import or export statement per line in the lib output. This is a
// scanner for that output, not a general JS parser.
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;

const packageName = (specifier) =>
  specifier
    .split('/')
    .slice(0, specifier.startsWith('@') ? 2 : 1)
    .join('/');

function reachable(entryFile) {
  const seen = new Set();
  const bare = new Set();
  const queue = [entryFile];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const [, specifier] of readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
      if (specifier.startsWith('.')) queue.push(resolve(dirname(file), specifier));
      else bare.add(specifier);
    }
  }
  return bare;
}

const failures = [];
for (const [entry, forbidden] of Object.entries(FORBIDDEN_BY_ENTRY)) {
  const file = join(dist, `${entry}.js`);
  if (!existsSync(file)) {
    failures.push(`${entry}: dist/${entry}.js is missing. Run the build first.`);
    continue;
  }
  for (const specifier of reachable(file)) {
    const name = packageName(specifier);
    if (forbidden.includes(name)) failures.push(`${entry}: reaches ${specifier}, which belongs to another entry`);
    if (FORBIDDEN_EVERYWHERE.some((pattern) => pattern.test(specifier)))
      failures.push(`${entry}: imports ${specifier}`);
    if (!(name in peerDependencies))
      failures.push(`${entry}: imports ${specifier}, and ${name} is not a peer dependency`);
  }
}

function declarationFiles(dir) {
  return readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return declarationFiles(path);
    return entry.name.endsWith('.d.ts') ? [path] : [];
  });
}
for (const file of declarationFiles(dist)) {
  if (readFileSync(file, 'utf8').includes('google.maps')) {
    failures.push(`${file.slice(root.length + 1)}: mentions google.maps; consumers do not have those types`);
  }
}

if (failures.length > 0) {
  console.error(`check-graph: ${failures.length} problem(s)\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('check-graph: every entry reaches only its own peers');
```

- [ ] **Step 2: Prove the graph check can fail**

Run: `pnpm --filter @vt-labs/form build && node packages/form/scripts/check-graph.mjs`
Expected: `check-graph: every entry reaches only its own peers`.

Then, temporarily, add `export {DateField} from './pickers/DateField';` to the end of `src/index.ts`, rebuild, and rerun.
Expected: exit 1, with `index: reaches @mui/x-date-pickers/DatePicker, which belongs to another entry`. Remove the line and rebuild. A check that has never failed has not been shown to work.

- [ ] **Step 3: Write the consumer fixture**

A small Vite app that imports the package the way promptiva will: a sign-in form from the root entry, and a date field registered through `lazyField`. It is built, never run or served.

`packages/form/fixtures/consumer/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>form consumer fixture</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`packages/form/fixtures/consumer/src/main.tsx`:

```tsx
import {createRoot} from 'react-dom/client';

import {SignIn} from './SignIn';

const container = document.getElementById('root');
if (container) createRoot(container).render(<SignIn />);
```

`packages/form/fixtures/consumer/src/BirthdayField.tsx`:

```tsx
// The date field with its adapter, as one lazily loaded module. An app that mounts
// LocalizationProvider at its root pays for the adapter up front instead; this fixture
// measures the package, so it keeps the adapter out of the main chunk too.
import {AdapterDateFns} from '@mui/x-date-pickers/AdapterDateFns';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {DateField} from '@vt-labs/form/pickers';
import type {DateFieldProps} from '@vt-labs/form/pickers';

export function BirthdayField(props: DateFieldProps) {
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <DateField {...props} />
    </LocalizationProvider>
  );
}
```

`packages/form/fixtures/consumer/src/SignIn.tsx`:

```tsx
import {createAppForm, FormError, lazyField, PasswordField, SubmitButton, TextField} from '@vt-labs/form';
import {useState} from 'react';

const BirthdayField = lazyField(() => import('./BirthdayField').then((module) => module.BirthdayField));

const {useAppForm} = createAppForm({
  fieldComponents: {TextField, PasswordField, BirthdayField},
  formComponents: {SubmitButton, FormError},
});

interface SignInValues {
  email: string;
  password: string;
  birthday: string | null;
}

const DEFAULTS: SignInValues = {email: '', password: '', birthday: null};

export function SignIn() {
  const [signingUp, setSigningUp] = useState(false);
  const form = useAppForm({defaultValues: DEFAULTS, onSubmit: async () => {}});

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="email">{(field) => <field.TextField label="Email" type="email" />}</form.AppField>
      <form.AppField name="password">{(field) => <field.PasswordField label="Password" />}</form.AppField>
      {signingUp && (
        <form.AppField name="birthday">{(field) => <field.BirthdayField label="Birthday" />}</form.AppField>
      )}
      <button type="button" onClick={() => setSigningUp(true)}>
        Sign up instead
      </button>
      <form.AppForm>
        <form.FormError />
        <form.SubmitButton>Sign in</form.SubmitButton>
      </form.AppForm>
    </form>
  );
}
```

`fixtures/` is outside `tsconfig.json`'s `include`, on purpose: `@vt-labs/form` resolves to `dist/`, which does not exist when `typecheck` runs. The fixture is checked by building it in the next step. oxlint still lints it with the rest of the repo.

`date-fns` is imported by the fixture (through the adapter), not by the package. It is already in the package's devDependencies, which is where the fixture resolves it from.

- [ ] **Step 4: Write the fixture check**

`packages/form/scripts/check-fixture.mjs`:

```js
// Builds fixtures/consumer against dist/ with Vite and inspects the chunks. The sign-in
// form's initial load (the entry chunk and everything it imports statically) must hold no
// date picker, phone input or date library, and the lazily registered date field must
// land in a chunk of its own.
import {resolve} from 'node:path';

import react from '@vitejs/plugin-react';
import {build} from 'vite';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');

const result = await build({
  root: resolve(root, 'fixtures/consumer'),
  configFile: false,
  logLevel: 'warn',
  plugins: [react()],
  resolve: {
    alias: [
      {find: /^@vt-labs\/form\/(pickers|phone|maps)$/, replacement: `${dist}/$1.js`},
      {find: /^@vt-labs\/form$/, replacement: `${dist}/index.js`},
    ],
  },
  build: {write: false, modulePreload: false, minify: false},
});

const outputs = (Array.isArray(result) ? result : [result]).flatMap((bundle) => bundle.output);
const chunks = new Map(outputs.filter((output) => output.type === 'chunk').map((chunk) => [chunk.fileName, chunk]));

function staticClosure(fileName, seen = new Set()) {
  if (seen.has(fileName)) return seen;
  seen.add(fileName);
  for (const imported of chunks.get(fileName)?.imports ?? []) staticClosure(imported, seen);
  return seen;
}

const entry = [...chunks.values()].find((chunk) => chunk.isEntry);
const initial = [...staticClosure(entry.fileName)].flatMap((fileName) => chunks.get(fileName)?.moduleIds ?? []);

const MUST_NOT_LOAD_UP_FRONT = [
  [/node_modules\/@mui\/x-date-pickers\//, 'MUI X date pickers'],
  [/node_modules\/mui-tel-input\//, 'mui-tel-input'],
  [/node_modules\/libphonenumber-js\//, 'libphonenumber-js'],
  [/node_modules\/date-fns\//, 'date-fns'],
  [/node_modules\/@mui\/material\/(esm\/)?index\.js$/, 'the @mui/material barrel'],
  [/\/dist\/(pickers|phone|maps)\//, 'another entry of @vt-labs/form'],
];

const failures = MUST_NOT_LOAD_UP_FRONT.flatMap(([pattern, what]) => {
  const hits = initial.filter((id) => pattern.test(id));
  return hits.length > 0 ? [`the initial load includes ${what} (${hits.length} modules, first: ${hits[0]})`] : [];
});

const lazyHasPickers = [...chunks.values()].some(
  (chunk) =>
    !staticClosure(entry.fileName).has(chunk.fileName) &&
    chunk.moduleIds.some((id) => /node_modules\/@mui\/x-date-pickers\//.test(id)),
);
if (!lazyHasPickers) failures.push('no lazily loaded chunk holds the date picker; lazyField did not split');

if (failures.length > 0) {
  console.error(`check-fixture: ${failures.length} problem(s)\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-fixture: initial load is ${initial.length} modules, none of them pickers, phone or date code`);
```

Under pnpm, a module id reads like `…/node_modules/.pnpm/@mui+x-date-pickers@9.12.0_…/node_modules/@mui/x-date-pickers/DatePicker/…`, which the patterns match. If `build()` returns an object without `output` (a watcher), `build.watch` is set somewhere it should not be; the config above sets `configFile: false` so no project config can do that.

- [ ] **Step 5: Prove the fixture check can fail**

Run: `node packages/form/scripts/check-fixture.mjs`
Expected: `check-fixture: initial load is N modules, none of them pickers, phone or date code`.

Then, temporarily, change the `BirthdayField` line in `SignIn.tsx` to a static import (`import {BirthdayField} from './BirthdayField';`) and rerun.
Expected: exit 1, naming `MUI X date pickers` and `date-fns` in the initial load and `lazyField did not split`. Restore the line.

- [ ] **Step 6: Add the tools and measure**

In `packages/form/package.json`, add to `devDependencies`:

```json
    "@arethetypeswrong/cli": "^0.18.5",
    "@size-limit/preset-small-lib": "^14.1.0",
    "publint": "^0.3.24",
    "size-limit": "^14.1.0",
```

Run: `pnpm install`

`packages/form/.size-limit.json`, first without limits:

```json
[
  {
    "name": "root: a sign-in form",
    "path": "dist/index.js",
    "import": "{ createAppForm, TextField, PasswordField, SubmitButton, FormError }",
    "ignore": ["react", "react-dom", "@mui/material", "@emotion/react", "@emotion/styled", "@tanstack/react-form"]
  },
  {
    "name": "root: everything",
    "path": "dist/index.js",
    "import": "*",
    "ignore": ["react", "react-dom", "@mui/material", "@emotion/react", "@emotion/styled", "@tanstack/react-form"]
  },
  {
    "name": "pickers",
    "path": "dist/pickers.js",
    "import": "*",
    "ignore": [
      "react",
      "react-dom",
      "@mui/material",
      "@emotion/react",
      "@emotion/styled",
      "@tanstack/react-form",
      "@mui/x-date-pickers"
    ]
  },
  {
    "name": "phone",
    "path": "dist/phone.js",
    "import": "*",
    "ignore": [
      "react",
      "react-dom",
      "@mui/material",
      "@emotion/react",
      "@emotion/styled",
      "@tanstack/react-form",
      "mui-tel-input"
    ]
  },
  {
    "name": "maps",
    "path": "dist/maps.js",
    "import": "*",
    "ignore": ["react", "react-dom", "@mui/material", "@emotion/react", "@emotion/styled", "@tanstack/react-form"]
  }
]
```

`ignore` takes package names and the preset matches their subpaths too, so `@mui/material/TextField` is excluded along with the rest of MUI. The numbers are this package's own code, gzipped.

Run: `pnpm --filter @vt-labs/form exec size-limit`
Expected: a size for each of the five rows. Record them.

Then give each row a `"limit"`: its measured size times 1.1, rounded up to the next 0.1 kB (a measured `4.23 kB` becomes `"limit": "4.7 kB"`). The 10% is headroom for normal work; a jump past it means a review of what grew, not a bump of the number. Rerun and expect every row to pass.

Sanity check on the numbers: "root: a sign-in form" should be well under "root: everything". If they are equal, tree-shaking across `preserveModules` output is not happening; stop and report instead of setting limits.

- [ ] **Step 7: Wire `verify`**

In `packages/form/package.json` `scripts`, add:

```json
    "verify": "node scripts/check-graph.mjs && node scripts/check-fixture.mjs && size-limit && publint && attw --pack . --profile esm-only"
```

In `turbo.json` `tasks`, add:

```json
    "verify": {
      "dependsOn": ["build"]
    }
```

In the root `package.json`, change `turbo run typecheck build` to `turbo run typecheck build verify` in both `validate` and `validate:ci`. Nothing else in those two lines changes. Datatable has no `verify` script, so turbo skips it there.

`attw --pack .` runs `pnpm pack` under the hood; `publint` reads `package.json` and `dist/`. Both need the build, which the turbo dependency guarantees.

- [ ] **Step 8: Run the gate**

Run: `pnpm --filter @vt-labs/form verify`
Expected: exit 0. The graph and fixture lines print as in Steps 2 and 5, size-limit passes every row, publint reports no errors, and attw's table shows 🟢 for `node16 (from ESM)` and `bundler` on all four entries (`esm-only` skips the CommonJS columns).

If attw reports `Masquerading as CJS` or `Missing types` on an entry, the fix is in the `exports` map or in `tsconfig.build.json`'s output path, never an attw flag.

Then run: `pnpm validate`
Expected: exit 0.

- [ ] **Step 9: Handoff**

Do not run git. Suggested message: `build(form): check the import graph, a consumer build, bundle size and package exports`

---

### Task 14: Document and close

**Files:**

- Create: `packages/form/README.md`, `.changeset/form-initial.md`
- Modify: `vitest.config.ts` (coverage), `apps/storybook/package.json`, root `README.md` (package table), `docs/roadmap.md`, `docs/extraction/README.md`, `docs/superpowers/specs/2026-09-29-form-package-design.md` (status line)
- Move: `docs/superpowers/plans/open/2026-09-29-form-package.md` to `docs/superpowers/plans/done/`

**Interfaces:**

- Consumes: everything above.
- Produces: nothing new in code.

- [ ] **Step 1: Coverage for the new package**

In `vitest.config.ts`, the coverage `exclude` list names `**/index.ts` as a barrel. This package has three more. Add, under the existing barrel comment:

```ts
        '**/packages/form/src/pickers.ts',
        '**/packages/form/src/phone.ts',
        '**/packages/form/src/maps.ts',
```

and a threshold for this package only, beside `exclude`:

```ts
      // Per package, so a new package starts with a floor of its own instead of being
      // averaged into the others. Datatable has none yet; adding one is its own change.
      thresholds: {
        [fileURLToPath(new URL('./packages/form/src/**', import.meta.url))]: {lines: 90, functions: 90, branches: 90, statements: 90},
      },
```

Run: `pnpm test:cov`
Expected: exit 0, and the text report lists `packages/form/src` files. If a glob threshold never applies (the report shows no threshold line for the package), Vitest is matching threshold globs relative to the root; change the key to `'packages/form/src/**'` and rerun. If the package is under a threshold, the fix is a test for the uncovered branch the report names, not a lower number.

- [ ] **Step 2: The showcase dependency**

In `apps/storybook/package.json` `dependencies`, add `"@vt-labs/form": "workspace:*"` below the datatable line, then run `pnpm install`. The stories already run (they sit in the package and the app's glob finds them); this makes the dependency the app has in fact declared, so turbo builds the package before `build-storybook`.

Run: `pnpm build-storybook`
Expected: exit 0.

- [ ] **Step 3: The README**

`packages/form/README.md`. It opens with what the package is for, not with install. Required contents, in this order:

1. **What it is.** One paragraph: MUI fields for TanStack Form, for admin and product forms in apps on React 19 and MUI 9. Every field shows the same label, helper and error layout, reads the same value shape, and wires the same aria attributes. Date, phone and address fields sit behind their own entry points so a sign-in form ships none of them.
2. **Install.** The peers, then the optional peers per entry:
   ```sh
   pnpm add @vt-labs/form @tanstack/react-form @mui/material @emotion/react @emotion/styled
   pnpm add @mui/x-date-pickers date-fns   # for @vt-labs/form/pickers (or dayjs)
   pnpm add mui-tel-input                  # for @vt-labs/form/phone
   ```
3. **A form.** A full sign-in example: `createAppForm` with `TextField`, `PasswordField`, `SubmitButton`, `FormError`, a Zod schema passed as `validators.onSubmit`, and `applyServerErrors` in `onSubmit`'s catch. Written in the same shape as the fixture's `SignIn.tsx`.
4. **Value shapes.** The table from the plan's Global Constraints, one row per field.
5. **Heavy fields.** `lazyField(() => import('@vt-labs/form/pickers').then((m) => m.DateField))`, why it is at module level, and that the consumer mounts `LocalizationProvider` with their own adapter.
6. **Phone validation.** The schema line for those who want it, and what it costs:
   ```ts
   import {matchIsValidTel} from 'mui-tel-input';
   phone: z.string().nullable().refine((value) => value === null || matchIsValidTel(value), 'Enter a valid number'),
   ```
   Say that `matchIsValidTel` loads libphonenumber's metadata into whatever chunk the schema lives in.
7. **Maps.** Loading the Places library, `createGooglePlacesProvider`, sessions and billing in two sentences, `EMPTY_ADDRESS` for defaults, and that `PlacesProvider` is the seam for another geocoder or a test fake.
8. **Translation.** `FormConfigProvider` with `labels` and `formatError`; every key of `DEFAULT_FORM_LABELS` listed with its English default.
9. **Server errors.** `applyServerErrors(form, {fields, form})`: a path with a mounted field shows under it, any other path joins the form-level message, and a user edit clears a field's server error.
10. **Your own field.** `useFieldBinding` plus `FieldShell`, in ten lines, so it behaves like the built-in ones.

Follow the text rules in `CLAUDE.md`: no em-dashes, no filler. Every code block must compile against the package as built; copy them from the tests and stories rather than writing fresh ones.

- [ ] **Step 4: The changeset**

`.changeset/form-initial.md`:

```md
---
'@vt-labs/form': minor
---

First version of `@vt-labs/form`: MUI fields for TanStack Form. Text, password, number, select, searchable and multi select, radio, checkbox, switch, duration and async autocomplete fields in the main entry, with submit, cancel and form-error components and server-error mapping. Date, time and date-range pickers in `@vt-labs/form/pickers`, a phone field in `@vt-labs/form/phone`, and location and address fields with a Google Places provider in `@vt-labs/form/maps`.
```

The package stays `"private": true` at `0.0.0`; the changeset records the entry for when it publishes. Flipping `private` is a separate decision.

- [ ] **Step 5: The docs**

- Root `README.md` package table: add a row below datatable:
  `| \`packages/form\` | MUI fields for TanStack Form, with pickers, phone and maps entries | 0.0.0, private |`
- `docs/roadmap.md`, section 3: the form row's plan link moves to `superpowers/plans/done/2026-09-29-form-package.md`, Tasks reads `14/14`, Status reads `done (<date>)`, Blocked on reads `nothing`.
- `docs/extraction/README.md`: the form row's plan link points at the same `done/` path.
- The spec's status line: `**Status:** implemented, <date>. Plan: [2026-09-29 form package](../plans/done/2026-09-29-form-package.md).`
- Move `docs/superpowers/plans/open/2026-09-29-form-package.md` to `docs/superpowers/plans/done/`, with every task checked.

- [ ] **Step 6: The final gate**

Run: `pnpm validate:ci`
Expected: exit 0. Then hand the whole change to the `lib-reviewer` agent, and the three entry files plus `package.json` to `api-surface-auditor`. Report what they found; fix what is a real defect and list the rest for the user.

- [ ] **Step 7: Handoff**

Do not run git. Suggested message: `docs(form): README, changeset and roadmap for @vt-labs/form`
