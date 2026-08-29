# @bohardlabs/form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the TanStack Form + MUI field kit that four admin apps each keep their own copy of, including the `lazyField` split that keeps `@mui/x-date-pickers`, `mui-tel-input` and Google Maps out of a login screen.

**Architecture:** The package owns the one `createFormHookContexts()` call, exports the field and form components bound to it, and exports a `createAppForm` factory so a consumer registers their own domain fields alongside the built-in ones. Heavy fields are registered behind `lazyField`, so registering them costs a dynamic import that only resolves when the field renders. Nothing in the package fetches or knows a domain type.

**Tech Stack:** React 19, MUI 7, `@tanstack/react-form` 1, `@mui/x-date-pickers` 8 + `dayjs` (optional peers), `mui-tel-input` 9 (optional peer), `@bohardlabs/admin-ui` (peer), Vite lib mode, Vitest + jsdom, Storybook 10.

**Spec:** [`docs/extraction/README.md`](../../../extraction/README.md), section "3. `@bohardlabs/form`"

**Source being ported:** `skipwash-latest/skipwash-admin/src/components/form/` and `src/hooks/form.tsx` + `src/hooks/form-context.ts`. Roughly 2640 lines including tests.

**Blocked on:** plan 2. `CancelButton` renders `UnsavedChangesDialog` from `@bohardlabs/admin-ui`.

## Global Constraints

- Package name `@bohardlabs/form`, `"private": true`, version `0.0.0`.
- No `@/…` imports. `DATE_PICKER_FORMAT` and `NAME_TOOLTIP_TRUNCATE_LENGTH`-style constants become defaulted props.
- No hardcoded user-facing string. One `FormLabels` interface, one `DEFAULT_LABELS`, one context, same shape as `@bohardlabs/datatable` and `@bohardlabs/admin-ui`. The four strings currently hardcoded in English inside components (`'Show password'`, `'Hide password'`, and the two in `TimeField`) go into it.
- No hardcoded colour. Theme tokens only.
- Never `any`, `@ts-ignore`, `@ts-expect-error`, `as unknown as`. TanStack Form's generics are wide; if a type will not line up, widen the field's own value type parameter rather than casting.
- Icons import per-icon.
- **`@bohardlabs/admin-ui` is a peer, not a dependency.** Two copies in a consumer's tree means two `AdminUiLabelsProvider` contexts, and the consumer's translations silently stop reaching the dialog `CancelButton` opens. Same reasoning as React.
- `@mui/x-date-pickers`, `dayjs` and `mui-tel-input` are **optional** peers (`peerDependenciesMeta`). A consumer who never renders a date or phone field should not have to install them, and `lazyField` is what makes that true.
- ESM only, `formats: ['es']`, `preserveModules: true`. `preserveModules` matters more here than anywhere else: it is what lets a bundler drop the heavy field chunks.
- Every component gets a story with a `play`.
- Never run a git command. Tasks end with a handoff step.

## The one architectural decision

`createFormHookContexts()` must be called **exactly once** in a consumer's application. TanStack Form's `useFieldContext` reads from the object that call returns; a second call creates a second context, and a field registered against one is invisible to a form built from the other.

So the package makes that call, and exports `fieldContext`, `formContext`, `useFieldContext` and `useFormContext` from it. A consumer writing their own field imports `useFieldContext` **from `@bohardlabs/form`**, never from `@tanstack/react-form`. This is the single thing most likely to be got wrong, and it fails at runtime with an unhelpful message, so it is called out in the README, in a doc comment on the export, and in a test.

---

### Task 1: Scaffolding, contexts, labels

**Files:**

- Create: `packages/form/package.json`
- Create: `packages/form/tsconfig.json`
- Create: `packages/form/tsconfig.build.json`
- Create: `packages/form/vite.config.ts`
- Create: `packages/form/src/test/setup.ts`
- Create: `packages/form/src/context.ts`
- Create: `packages/form/src/i18n/labels.ts`
- Create: `packages/form/src/i18n/LabelsContext.tsx`
- Create: `packages/form/src/i18n/index.ts`
- Create: `packages/form/src/index.ts`
- Test: `packages/form/src/i18n/LabelsContext.test.tsx`
- Modify: `pnpm-workspace.yaml` (catalog entries for the new deps)

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `fieldContext`, `formContext`, `useFieldContext`, `useFormContext` from `./context`.
  - `interface FormLabels`, `DEFAULT_LABELS`, `<FormLabelsProvider>`, `useLabels()`.

- [ ] **Step 1: Add catalog entries**

In `pnpm-workspace.yaml`, in the `catalog:` block:

```yaml
'@mui/x-date-pickers': ^8.14.0
'@tanstack/react-form': ^1.23.5
'mui-tel-input': ^9.0.1
```

`dayjs` and `@tanstack/react-table` are already there; do not duplicate them. If a version listed above is already present with a different range, keep the existing one and note the difference in the handoff.

- [ ] **Step 2: Write `packages/form/package.json`**

```json
{
  "name": "@bohardlabs/form",
  "version": "0.0.0",
  "private": true,
  "description": "TanStack Form fields for MUI, with lazy boundaries around the heavy ones",
  "type": "module",
  "sideEffects": false,
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./package.json": "./package.json"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "publishConfig": {
    "access": "public"
  },
  "scripts": {
    "build": "vite build && tsc -p tsconfig.build.json",
    "dev": "vite build --watch",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "test:cov": "vitest run --coverage",
    "clean": "rm -rf dist *.tsbuildinfo"
  },
  "peerDependencies": {
    "@bohardlabs/admin-ui": "workspace:*",
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.0",
    "@mui/icons-material": "^7.0.0",
    "@mui/material": "^7.0.0",
    "@mui/x-date-pickers": "^8.0.0",
    "@tanstack/react-form": "^1.0.0",
    "dayjs": "^1.11.0",
    "mui-tel-input": "^9.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "peerDependenciesMeta": {
    "@mui/x-date-pickers": {"optional": true},
    "dayjs": {"optional": true},
    "mui-tel-input": {"optional": true}
  },
  "devDependencies": {
    "@bohardlabs/admin-ui": "workspace:*",
    "@emotion/react": "catalog:",
    "@emotion/styled": "catalog:",
    "@mui/icons-material": "catalog:",
    "@mui/material": "catalog:",
    "@mui/x-date-pickers": "catalog:",
    "@storybook/addon-docs": "^10.5.10",
    "@storybook/react-vite": "^10.5.10",
    "@tanstack/react-form": "catalog:",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^26.4.0",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "babel-plugin-react-compiler": "^1.0.0",
    "dayjs": "catalog:",
    "jsdom": "^28.0.1",
    "mui-tel-input": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:",
    "storybook": "^10.5.10",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vitest": "catalog:"
  }
}
```

`@bohardlabs/admin-ui` appears in both blocks: `workspace:*` in devDependencies so this repo builds against the local copy, and `workspace:*` in peerDependencies, which pnpm rewrites to the published range on publish.

- [ ] **Step 3: Copy the tsconfigs, vite config and test setup**

Take all four from `packages/admin-ui` unchanged. The `matchMedia` and `ResizeObserver` stubs in `src/test/setup.ts` are both needed: MUI's date pickers query media, and `mui-tel-input`'s menu observes.

- [ ] **Step 4: Write `src/context.ts`**

```ts
import {createFormHookContexts} from '@tanstack/react-form';

/**
 * The one `createFormHookContexts()` call for the whole application.
 *
 * TanStack Form's field and form contexts are ordinary React contexts: a component reading
 * from one instance cannot see a value provided through another. Calling
 * `createFormHookContexts()` a second time anywhere in a consumer's tree produces a second
 * pair, and any field registered against it renders with an empty context and throws.
 *
 * So: a consumer writing their own field component imports `useFieldContext` from
 * `@bohardlabs/form`, never from `@tanstack/react-form`.
 */
export const {fieldContext, useFieldContext, formContext, useFormContext} = createFormHookContexts();
```

- [ ] **Step 5: Write the failing labels test**

```tsx
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {DEFAULT_LABELS, FormLabelsProvider, useLabels} from './index';

function ShowCancel() {
  return <span>{useLabels().cancel}</span>;
}

describe('FormLabelsProvider', () => {
  it('falls back to the English defaults outside a provider', () => {
    render(<ShowCancel />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('overrides only the keys it is given', () => {
    render(
      <FormLabelsProvider labels={{cancel: 'Abbrechen'}}>
        <ShowCancel />
      </FormLabelsProvider>,
    );
    expect(screen.getByText('Abbrechen')).toBeInTheDocument();
  });

  it('keeps the defaults for everything else', () => {
    function ShowHours() {
      return <span>{useLabels().hours}</span>;
    }
    render(
      <FormLabelsProvider labels={{cancel: 'Abbrechen'}}>
        <ShowHours />
      </FormLabelsProvider>,
    );
    expect(screen.getByText(DEFAULT_LABELS.hours)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run and watch it fail**

Run: `pnpm --filter @bohardlabs/form test`
Expected: FAIL, "Failed to resolve import './index'".

- [ ] **Step 7: Write the labels**

`src/i18n/labels.ts`:

```ts
/**
 * Every string the kit renders that a caller does not already pass in.
 *
 * Field labels, placeholders and helper text are per-field props, not entries here: they
 * are content, not chrome. What lives here is the chrome a consumer never passes and
 * therefore never gets to translate: the password visibility toggle's accessible name, the
 * hour and minute captions in `TimeField`, and the two button labels.
 */
export interface FormLabels {
  readonly cancel: string;
  readonly showPassword: string;
  readonly hidePassword: string;
  readonly hours: string;
  readonly minutes: string;
  /** Marks a required field. Rendered next to the label; also its accessible name. */
  readonly requiredIndicator: string;
  readonly requiredFieldHint: string;
}

export const DEFAULT_LABELS: FormLabels = {
  cancel: 'Cancel',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  hours: 'Hours',
  minutes: 'Minutes',
  requiredIndicator: '*',
  requiredFieldHint: 'required',
};
```

- [ ] **Step 8: Write `LabelsContext.tsx` and `i18n/index.ts`**

Identical in shape to the admin-ui one from plan 2, with `FormLabels` / `FormLabelsProvider` / `DEFAULT_LABELS` substituted. Copy it and rename; do not invent a variation.

- [ ] **Step 9: Write the temporary entry point**

```ts
export {fieldContext, formContext, useFieldContext, useFormContext} from './context';
export {DEFAULT_LABELS, FormLabelsProvider, useLabels} from './i18n';
export type {FormLabels} from './i18n';
```

- [ ] **Step 10: Install, test, build**

Run: `pnpm install && pnpm --filter @bohardlabs/form test && pnpm --filter @bohardlabs/form build`
Expected: 3 tests pass, build succeeds.

- [ ] **Step 11: Hand off for commit**

```
feat(form): scaffold the package, form contexts and labels
```

---

### Task 2: FieldShell, ErrorMessages, InfoTooltip

**Files:**

- Create: `packages/form/src/internal/ErrorMessages.tsx`
- Create: `packages/form/src/internal/InfoTooltip.tsx`
- Create: `packages/form/src/internal/FieldShell.tsx`
- Test: `packages/form/src/internal/ErrorMessages.test.tsx`
- Test: `packages/form/src/internal/FieldShell.test.tsx`
- Modify: `packages/form/src/index.ts`

**Interfaces:**

- Consumes: `useLabels` from Task 1.
- Produces:
  - `<ErrorMessages errors />` where `errors: ReadonlyArray<string | {message: string} | undefined>`.
  - `<InfoTooltip title size? />`.
  - `<FieldShell label required? tooltip? htmlFor? errors? showErrors? children />`: the label row plus the error slot every field repeats.
  - `interface CommonFieldProps {label: string; required?: boolean; tooltip?: string; disabled?: boolean}`.

Nine of the eleven fields open with the same eleven lines: a `FormControl`, a `Typography` label, a conditional red asterisk, a conditional `InfoTooltip`, and a trailing `{field.state.meta.isTouched && <ErrorMessages …/>}`. Extracting it once is the difference between a kit and nine near-copies, and it is where the missing `htmlFor` gets fixed for all of them at once.

- [ ] **Step 1: Write the failing ErrorMessages test**

```tsx
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {ErrorMessages} from './ErrorMessages';

describe('ErrorMessages', () => {
  it('renders nothing for an empty list', () => {
    const {container} = render(<ErrorMessages errors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when every entry is undefined', () => {
    const {container} = render(<ErrorMessages errors={[undefined, undefined]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a plain string error', () => {
    render(<ErrorMessages errors={['Required']} />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('renders the message of an object error', () => {
    render(<ErrorMessages errors={[{message: 'Must be a valid email'}]} />);
    expect(screen.getByText('Must be a valid email')).toBeInTheDocument();
  });

  it('shows only the first defined error', () => {
    render(<ErrorMessages errors={[undefined, 'First', 'Second']} />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.queryByText('Second')).not.toBeInTheDocument();
  });
});
```

The mixed shape is not a design choice, it is what TanStack Form and a Zod resolver actually produce between them: a standard-schema adapter yields objects with `message`, a hand-written validator yields strings. The component absorbs both so no caller has to.

- [ ] **Step 2: Run and watch it fail, then write ErrorMessages**

Run: `pnpm --filter @bohardlabs/form test ErrorMessages` → FAIL.

```tsx
import FormHelperText from '@mui/material/FormHelperText';

export type FieldError = string | {message: string} | undefined;

interface ErrorMessagesProps {
  readonly errors: ReadonlyArray<FieldError>;
  readonly id?: string;
}

/**
 * The first validation message for a field, or nothing.
 *
 * One message, not all of them: a field with three simultaneous failures reads as noise,
 * and the first is the one the user has to fix before the others are even evaluated.
 */
export function ErrorMessages({errors, id}: Readonly<ErrorMessagesProps>) {
  const firstError = errors.find((error) => error !== undefined);
  if (!firstError) return null;

  const message = typeof firstError === 'string' ? firstError : firstError.message;

  return (
    <FormHelperText error id={id}>
      {message}
    </FormHelperText>
  );
}
```

Run again: PASS, 5 tests.

- [ ] **Step 3: Write InfoTooltip**

Ported unchanged apart from the icon import path and one addition: the icon gets `aria-label={title}` and `role="img"`, because a `Tooltip` on a non-focusable SVG is invisible to a screen reader and to `getByRole`.

```tsx
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import Tooltip from '@mui/material/Tooltip';

interface InfoTooltipProps {
  readonly title: string;
  readonly size?: number;
}

export function InfoTooltip({title, size = 16}: Readonly<InfoTooltipProps>) {
  return (
    <Tooltip title={title} arrow placement="top">
      <InfoOutlined
        role="img"
        aria-label={title}
        sx={{fontSize: size, ml: 0.5, color: 'text.secondary', cursor: 'help', verticalAlign: 'middle'}}
      />
    </Tooltip>
  );
}
```

- [ ] **Step 4: Write the failing FieldShell test**

```tsx
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {FieldShell} from './FieldShell';

describe('FieldShell', () => {
  it('renders the label and the child control', () => {
    render(
      <FieldShell label="Email" htmlFor="email">
        <input id="email" />
      </FieldShell>,
    );

    expect(screen.getByLabelText('Email')).toBe(screen.getByRole('textbox'));
  });

  it('marks a required field for sighted and assistive users alike', () => {
    render(
      <FieldShell label="Email" htmlFor="email" required>
        <input id="email" />
      </FieldShell>,
    );

    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByText('*')).toHaveAccessibleName('required');
  });

  it('renders a tooltip trigger when given a tooltip', () => {
    render(
      <FieldShell label="Email" htmlFor="email" tooltip="We never share this">
        <input id="email" />
      </FieldShell>,
    );

    expect(screen.getByRole('img', {name: 'We never share this'})).toBeInTheDocument();
  });

  it('hides errors until the field is shown as touched', () => {
    const {rerender} = render(
      <FieldShell label="Email" htmlFor="email" errors={['Required']} showErrors={false}>
        <input id="email" />
      </FieldShell>,
    );
    expect(screen.queryByText('Required')).not.toBeInTheDocument();

    rerender(
      <FieldShell label="Email" htmlFor="email" errors={['Required']} showErrors>
        <input id="email" />
      </FieldShell>,
    );
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('links the error message to the control with aria-describedby', () => {
    render(
      <FieldShell label="Email" htmlFor="email" errors={['Required']} showErrors>
        <input id="email" aria-describedby="email-error" />
      </FieldShell>,
    );

    expect(screen.getByText('Required')).toHaveAttribute('id', 'email-error');
  });
});
```

- [ ] **Step 5: Run and watch it fail, then write FieldShell**

```tsx
import FormControl from '@mui/material/FormControl';
import Typography from '@mui/material/Typography';
import type {ReactNode} from 'react';

import {useLabels} from '../i18n';
import type {FieldError} from './ErrorMessages';
import {ErrorMessages} from './ErrorMessages';
import {InfoTooltip} from './InfoTooltip';

/** The props every field in the kit accepts, whatever it renders underneath. */
export interface CommonFieldProps {
  readonly label: string;
  readonly required?: boolean;
  readonly tooltip?: string;
  readonly disabled?: boolean;
}

interface FieldShellProps extends CommonFieldProps {
  /** The id of the control this label points at. Fields derive it from the field name. */
  readonly htmlFor: string;
  readonly errors?: ReadonlyArray<FieldError>;
  /** Usually `field.state.meta.isTouched`: hold errors back until the user has engaged. */
  readonly showErrors?: boolean;
  readonly error?: boolean;
  readonly children: ReactNode;
}

/**
 * The label row, the required marker, the tooltip and the error slot, once.
 *
 * Nine fields rendered their own copy of this before it was extracted, which is nine
 * places for the asterisk to be a different shade of red and one place, in practice, where
 * the label was not tied to its input at all.
 */
export function FieldShell({
  label,
  htmlFor,
  required = false,
  tooltip,
  errors = [],
  showErrors = false,
  error,
  children,
}: Readonly<FieldShellProps>) {
  const labels = useLabels();
  const hasError = error ?? (showErrors && errors.some((e) => e !== undefined));

  return (
    <FormControl fullWidth error={hasError}>
      <Typography component="label" htmlFor={htmlFor} variant="subtitle1" fontWeight={600} sx={{mb: 1}}>
        {label}
        {required && (
          <Typography component="span" aria-label={labels.requiredFieldHint} sx={{color: 'error.main', ml: 0.5}}>
            {labels.requiredIndicator}
          </Typography>
        )}
        {tooltip && <InfoTooltip title={tooltip} />}
      </Typography>
      {children}
      {showErrors && <ErrorMessages errors={errors} id={`${htmlFor}-error`} />}
    </FormControl>
  );
}
```

Run: `pnpm --filter @bohardlabs/form test internal`
Expected: PASS, 10 tests.

- [ ] **Step 6: Export the two public pieces**

`FieldShell` and `CommonFieldProps` are exported; `ErrorMessages` and `InfoTooltip` are exported too, because a consumer writing a domain field needs all four to make it match.

```ts
export {ErrorMessages} from './internal/ErrorMessages';
export type {FieldError} from './internal/ErrorMessages';
export {InfoTooltip} from './internal/InfoTooltip';
export {FieldShell} from './internal/FieldShell';
export type {CommonFieldProps} from './internal/FieldShell';
```

- [ ] **Step 7: Hand off for commit**

```
feat(form): FieldShell, ErrorMessages and InfoTooltip
```

---

### Task 3: TextField, and the test harness every later field reuses

**Files:**

- Create: `packages/form/src/test/renderField.tsx`
- Create: `packages/form/src/fields/TextField.tsx`
- Test: `packages/form/src/fields/TextField.test.tsx`
- Modify: `packages/form/src/index.ts`

**Interfaces:**

- Consumes: `useFieldContext` (Task 1), `FieldShell`, `CommonFieldProps` (Task 2).
- Produces:
  - `renderField(Field, {defaultValue, validator?, props?})`: a test helper that mounts one field inside a real form and returns `{form, ...RenderResult}`. Every later field task uses it.
  - `<TextField label placeholder? type? htmlInputProps? disabled? required? tooltip? />`.

A field component cannot be rendered on its own: it reads from `useFieldContext`. Building the harness once, here, is what makes the next six tasks short.

- [ ] **Step 1: Write the harness**

```tsx
import type {ReactNode} from 'react';
import {render} from '@testing-library/react';
import {createFormHook} from '@tanstack/react-form';
import type {RenderResult} from '@testing-library/react';

import {fieldContext, formContext} from '../context';

/**
 * Mounts one field component inside a real `useAppForm` so it has a live field context.
 *
 * A field cannot be rendered standalone: `useFieldContext` throws without a provider, and
 * mocking the context would test the mock. This builds the smallest genuine form that can
 * hold the field under test.
 */
export function renderField<TValue, TProps extends object>(
  Field: (props: TProps) => ReactNode,
  options: {
    readonly defaultValue: TValue;
    readonly props: TProps;
    readonly onChange?: (value: TValue) => string | undefined;
  },
): RenderResult {
  const {useAppForm} = createFormHook({
    fieldComponents: {Field},
    formComponents: {},
    fieldContext,
    formContext,
  });

  function Harness() {
    const form = useAppForm({defaultValues: {value: options.defaultValue}});

    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.AppField
          name="value"
          validators={options.onChange ? {onChange: ({value}) => options.onChange?.(value)} : undefined}
        >
          {(field) => <field.Field {...options.props} />}
        </form.AppField>
        <button type="submit">Submit</button>
      </form>
    );
  }

  return render(<Harness />);
}
```

If TypeScript rejects the `fieldComponents: {Field}` object because `Field`'s props are generic, give `renderField` its `TProps` bound as written above and pass the component through unchanged. Do not reach for a cast.

- [ ] **Step 2: Write the failing TextField test**

```tsx
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';

import {renderField} from '../test/renderField';
import {TextField} from './TextField';

describe('TextField', () => {
  it('renders the label tied to the input', () => {
    renderField(TextField, {defaultValue: '', props: {label: 'Email'}});

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('shows the current value', () => {
    renderField(TextField, {defaultValue: 'ada@example.com', props: {label: 'Email'}});

    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
  });

  it('renders a null value as an empty controlled input', () => {
    renderField(TextField, {defaultValue: null, props: {label: 'Price'}});

    expect(screen.getByLabelText('Price')).toHaveValue('');
  });

  it('writes what the user types', async () => {
    const user = userEvent.setup();
    renderField(TextField, {defaultValue: '', props: {label: 'Email'}});

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');

    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
  });

  it('stores a number rather than a string for type="number"', async () => {
    const user = userEvent.setup();
    const seen: unknown[] = [];
    renderField(TextField, {
      defaultValue: null,
      props: {label: 'Price', type: 'number'},
      onChange: (value) => {
        seen.push(value);
        return undefined;
      },
    });

    await user.type(screen.getByLabelText('Price'), '42');

    expect(seen.at(-1)).toBe(42);
    expect(typeof seen.at(-1)).toBe('number');
  });

  it('clears a number field to empty rather than to NaN', async () => {
    const user = userEvent.setup();
    const seen: unknown[] = [];
    renderField(TextField, {
      defaultValue: 42,
      props: {label: 'Price', type: 'number'},
      onChange: (value) => {
        seen.push(value);
        return undefined;
      },
    });

    await user.clear(screen.getByLabelText('Price'));

    expect(seen.at(-1)).toBe('');
    expect(Number.isNaN(seen.at(-1))).toBe(false);
  });

  it('does not accept input while disabled', async () => {
    const user = userEvent.setup();
    renderField(TextField, {defaultValue: '', props: {label: 'Email', disabled: true}});

    await user.type(screen.getByLabelText('Email'), 'x');

    expect(screen.getByLabelText('Email')).toHaveValue('');
  });

  it('hides a validation error until the field is touched', async () => {
    const user = userEvent.setup();
    renderField(TextField, {
      defaultValue: '',
      props: {label: 'Email'},
      onChange: (value) => (value === '' ? 'Required' : undefined),
    });

    expect(screen.queryByText('Required')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Email'));
    await user.tab();

    expect(await screen.findByText('Required')).toBeInTheDocument();
  });
});
```

The two number cases are the ones worth the effort. `Number('')` is `0` and `Number('4e')` is `NaN`; the app version guards the first and not the second, and either one silently writes a wrong value into a form a user thinks is empty.

- [ ] **Step 3: Run and watch it fail**

Run: `pnpm --filter @bohardlabs/form test TextField`
Expected: FAIL, module not found.

- [ ] **Step 4: Write TextField**

Port the app version onto `FieldShell`. The changes: the label row is gone (the shell renders it), `id` comes from `field.name`, and the number branch handles `NaN`.

```tsx
import MuiTextField from '@mui/material/TextField';
import {useStore} from '@tanstack/react-form';
import type {InputHTMLAttributes} from 'react';

import {useFieldContext} from '../context';
import {FieldShell} from '../internal/FieldShell';
import type {CommonFieldProps} from '../internal/FieldShell';

export interface TextFieldProps extends CommonFieldProps {
  readonly placeholder?: string;
  readonly type?: 'text' | 'number' | 'email' | 'tel' | 'url';
  readonly htmlInputProps?: InputHTMLAttributes<HTMLInputElement>;
}

export function TextField({
  label,
  placeholder,
  type = 'text',
  htmlInputProps,
  disabled = false,
  required = false,
  tooltip,
}: Readonly<TextFieldProps>) {
  const field = useFieldContext<string | number | null | undefined>();
  const errors = useStore(field.store, (state) => state.meta.errors);
  const touched = useStore(field.store, (state) => state.meta.isTouched);

  const handleChange = (raw: string) => {
    if (type !== 'number') {
      field.handleChange(raw);
      return;
    }
    if (raw === '') {
      field.handleChange('');
      return;
    }
    const parsed = Number(raw);
    // A partially typed exponent ("4e") parses to NaN. Keep the previous value rather than
    // writing NaN into the form, which no validator reports usefully.
    field.handleChange(Number.isNaN(parsed) ? field.state.value : parsed);
  };

  return (
    <FieldShell
      label={label}
      htmlFor={field.name}
      required={required}
      tooltip={tooltip}
      errors={errors}
      showErrors={touched}
    >
      {/* A null value renders as '' so the input stays controlled across an unset optional. */}
      <MuiTextField
        id={field.name}
        name={field.name}
        value={field.state.value ?? ''}
        placeholder={placeholder}
        type={type}
        onBlur={field.handleBlur}
        onChange={(event) => handleChange(event.target.value)}
        error={touched && errors.length > 0}
        disabled={disabled}
        size="small"
        fullWidth
        slotProps={{htmlInput: htmlInputProps, input: {'aria-describedby': `${field.name}-error`}}}
      />
    </FieldShell>
  );
}
```

The app version guarded typing while disabled with an early return inside `onChange`. That guard goes: MUI's `disabled` already prevents the event, and a second guard hides the fact that the first one is what matters.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @bohardlabs/form test TextField`
Expected: PASS, 8 tests.

- [ ] **Step 6: Export it**

```ts
export {TextField} from './fields/TextField';
export type {TextFieldProps} from './fields/TextField';
```

- [ ] **Step 7: Hand off for commit**

```
feat(form): TextField and the field test harness
```

---

### Task 4: TextArea and PasswordField

**Files:**

- Create: `packages/form/src/fields/TextArea.tsx`
- Create: `packages/form/src/fields/PasswordField.tsx`
- Test: `packages/form/src/fields/TextArea.test.tsx`
- Test: `packages/form/src/fields/PasswordField.test.tsx`
- Modify: `packages/form/src/index.ts`

**Interfaces:**

- Consumes: `useFieldContext`, `FieldShell`, `CommonFieldProps`, `useLabels`, `renderField`.
- Produces: `<TextArea label rows? placeholder? required? tooltip? disabled? />`, `<PasswordField label placeholder? required? tooltip? disabled? />`, and their props types.

- [ ] **Step 1: Write the failing TextArea test**

```tsx
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';

import {renderField} from '../test/renderField';
import {TextArea} from './TextArea';

describe('TextArea', () => {
  it('renders a multiline control tied to its label', () => {
    renderField(TextArea, {defaultValue: '', props: {label: 'Notes'}});

    expect(screen.getByLabelText('Notes').tagName).toBe('TEXTAREA');
  });

  it('renders a null value as empty', () => {
    renderField(TextArea, {defaultValue: null, props: {label: 'Notes'}});

    expect(screen.getByLabelText('Notes')).toHaveValue('');
  });

  it('writes what the user types, newlines included', async () => {
    const user = userEvent.setup();
    renderField(TextArea, {defaultValue: '', props: {label: 'Notes'}});

    await user.type(screen.getByLabelText('Notes'), 'first{Enter}second');

    expect(screen.getByLabelText('Notes')).toHaveValue('first\nsecond');
  });

  it('honours the rows prop', () => {
    renderField(TextArea, {defaultValue: '', props: {label: 'Notes', rows: 8}});

    expect(screen.getByLabelText('Notes')).toHaveAttribute('rows', '8');
  });

  it('shows a validation error once touched', async () => {
    const user = userEvent.setup();
    renderField(TextArea, {
      defaultValue: '',
      props: {label: 'Notes'},
      onChange: (value) => (value === '' ? 'Required' : undefined),
    });

    await user.click(screen.getByLabelText('Notes'));
    await user.tab();

    expect(await screen.findByText('Required')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, fail, write TextArea**

Port the app version onto `FieldShell`, same shape as `TextField`: `id={field.name}`, `value={field.state.value ?? ''}`, `multiline`, `rows`, `size="small"`, `fullWidth`. Add the `disabled` prop the app version omits, so the kit is consistent.

Run: PASS, 5 tests.

- [ ] **Step 3: Write the failing PasswordField test**

```tsx
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';

import {renderField} from '../test/renderField';
import {PasswordField} from './PasswordField';

describe('PasswordField', () => {
  it('masks the value by default', () => {
    renderField(PasswordField, {defaultValue: 'hunter2', props: {label: 'Password'}});

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('reveals and re-masks on the toggle', async () => {
    const user = userEvent.setup();
    renderField(PasswordField, {defaultValue: 'hunter2', props: {label: 'Password'}});

    await user.click(screen.getByRole('button', {name: 'Show password'}));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', {name: 'Hide password'}));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('does not submit the form when the toggle is clicked', async () => {
    const user = userEvent.setup();
    renderField(PasswordField, {defaultValue: '', props: {label: 'Password'}});

    const toggle = screen.getByRole('button', {name: 'Show password'});
    expect(toggle).toHaveAttribute('type', 'button');

    await user.click(toggle);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
  });

  it('names the toggle from the labels context', async () => {
    const user = userEvent.setup();
    renderField(PasswordField, {defaultValue: '', props: {label: 'Password'}});

    await user.click(screen.getByRole('button', {name: 'Show password'}));

    expect(screen.getByRole('button', {name: 'Hide password'})).toBeInTheDocument();
  });
});
```

The `type="button"` assertion is a real bug in the app version: an `IconButton` inside a `<form>` defaults to `type="submit"`, so revealing the password submits the login form. It happens not to bite because MUI sets `type="button"` on `IconButton` by default, but the test pins it so a swap to a plain `<button>` cannot regress it.

- [ ] **Step 4: Run, fail, write PasswordField**

Port onto `FieldShell`. Two changes from the app version: the two hardcoded English strings become `labels.showPassword` / `labels.hidePassword`, and the icons swap to match their meaning. The app renders `<Visibility />` when the password is already visible, which is backwards for an affordance that says what the click will do; render `<VisibilityOff />` while visible and `<Visibility />` while masked.

Run: PASS, 4 tests.

- [ ] **Step 5: Export both, then hand off**

```ts
export {TextArea} from './fields/TextArea';
export type {TextAreaProps} from './fields/TextArea';
export {PasswordField} from './fields/PasswordField';
export type {PasswordFieldProps} from './fields/PasswordField';
```

```
feat(form): TextArea and PasswordField
```

---

### Task 5: Select and Checkbox

**Files:**

- Create: `packages/form/src/fields/Select.tsx`
- Create: `packages/form/src/fields/Checkbox.tsx`
- Test: `packages/form/src/fields/Select.test.tsx`
- Test: `packages/form/src/fields/Checkbox.test.tsx`
- Modify: `packages/form/src/index.ts`

**Interfaces:**

- Consumes: `useFieldContext`, `FieldShell`, `CommonFieldProps`, `renderField`.
- Produces:
  - `interface SelectOption {label: string; value: string; disabled?: boolean}`.
  - `<Select label values placeholder? required? tooltip? disabled? />`.
  - `<Checkbox label description? tooltip? disabled? />`.

`Checkbox` renders a MUI `Switch`, not a checkbox. That is what the app does and what the apps look like, so the rendering stays; the name stays too, because renaming it would break every call site for a cosmetic gain. Its ARIA role is `checkbox` either way, which is why the tests query it as one.

- [ ] **Step 1: Write the failing Select test**

```tsx
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';

import {renderField} from '../test/renderField';
import {Select} from './Select';

const VALUES = [
  {label: 'Active', value: 'ACTIVE'},
  {label: 'Suspended', value: 'SUSPENDED'},
  {label: 'Archived', value: 'ARCHIVED', disabled: true},
];

describe('Select', () => {
  it('renders the current selection', () => {
    renderField(Select, {defaultValue: 'ACTIVE', props: {label: 'Status', values: VALUES}});

    expect(screen.getByRole('combobox', {name: 'Status'})).toHaveTextContent('Active');
  });

  it('renders empty when the value is empty', () => {
    renderField(Select, {defaultValue: '', props: {label: 'Status', values: VALUES}});

    expect(screen.getByRole('combobox', {name: 'Status'})).toHaveTextContent('');
  });

  it('changes the value when an option is chosen', async () => {
    const user = userEvent.setup();
    renderField(Select, {defaultValue: 'ACTIVE', props: {label: 'Status', values: VALUES}});

    await user.click(screen.getByRole('combobox', {name: 'Status'}));
    await user.click(screen.getByRole('option', {name: 'Suspended'}));

    expect(screen.getByRole('combobox', {name: 'Status'})).toHaveTextContent('Suspended');
  });

  it('renders a disabled option as unselectable', async () => {
    const user = userEvent.setup();
    renderField(Select, {defaultValue: 'ACTIVE', props: {label: 'Status', values: VALUES}});

    await user.click(screen.getByRole('combobox', {name: 'Status'}));

    expect(screen.getByRole('option', {name: 'Archived'})).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows a validation error once touched', async () => {
    const user = userEvent.setup();
    renderField(Select, {
      defaultValue: '',
      props: {label: 'Status', values: VALUES},
      onChange: (value) => (value === '' ? 'Pick one' : undefined),
    });

    await user.click(screen.getByRole('combobox', {name: 'Status'}));
    await user.keyboard('{Escape}');
    await user.tab();

    expect(await screen.findByText('Pick one')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, fail, write Select**

Port onto `FieldShell`. Three changes from the app version: `placeholder` is now honoured (it was in the props and never rendered, so either use it as a `displayEmpty` `MenuItem` or delete the prop; use it), `SelectOption` gains `disabled?`, and the label ties to the control with `labelId` plus `id` rather than a bare `Typography`.

Use `labelId={`${field.name}-label`}` on the MUI `Select` and give `FieldShell` an `htmlFor` of `field.name`; MUI's `Select` renders a `combobox` whose accessible name comes from `labelId`. Set `id` on the `Typography` label inside the shell by passing `htmlFor`, and confirm `getByRole('combobox', {name: 'Status'})` resolves before moving on. If it does not, the label is not wired and the fix belongs here, not in the test.

Run: PASS, 5 tests.

- [ ] **Step 3: Write the failing Checkbox test**

```tsx
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';

import {renderField} from '../test/renderField';
import {Checkbox} from './Checkbox';

describe('Checkbox', () => {
  it('reflects a false value', () => {
    renderField(Checkbox, {defaultValue: false, props: {label: 'Send receipts'}});

    expect(screen.getByRole('checkbox', {name: 'Send receipts'})).not.toBeChecked();
  });

  it('reflects a true value', () => {
    renderField(Checkbox, {defaultValue: true, props: {label: 'Send receipts'}});

    expect(screen.getByRole('checkbox', {name: 'Send receipts'})).toBeChecked();
  });

  it('treats an undefined value as unchecked', () => {
    renderField(Checkbox, {defaultValue: undefined, props: {label: 'Send receipts'}});

    expect(screen.getByRole('checkbox', {name: 'Send receipts'})).not.toBeChecked();
  });

  it('toggles on click', async () => {
    const user = userEvent.setup();
    renderField(Checkbox, {defaultValue: false, props: {label: 'Send receipts'}});

    await user.click(screen.getByRole('checkbox', {name: 'Send receipts'}));

    expect(screen.getByRole('checkbox', {name: 'Send receipts'})).toBeChecked();
  });

  it('renders the description under the label', () => {
    renderField(Checkbox, {
      defaultValue: false,
      props: {label: 'Send receipts', description: 'One email per completed order.'},
    });

    expect(screen.getByText('One email per completed order.')).toBeInTheDocument();
  });

  it('does not toggle while disabled', async () => {
    const user = userEvent.setup();
    renderField(Checkbox, {defaultValue: false, props: {label: 'Send receipts', disabled: true}});

    await user.click(screen.getByRole('checkbox', {name: 'Send receipts'}));

    expect(screen.getByRole('checkbox', {name: 'Send receipts'})).not.toBeChecked();
  });
});
```

- [ ] **Step 4: Run, fail, write Checkbox**

This one does not use `FieldShell`: its label sits beside the control rather than above it. Keep the app's row layout, and add three things: `disabled`, an `id` on the `Switch` with the label's `htmlFor` pointing at it, and `aria-describedby` linking the description. The `field.state.value || false` coercion stays; it is what makes the undefined case pass.

Run: PASS, 6 tests.

- [ ] **Step 5: Export both, then hand off**

```ts
export {Select} from './fields/Select';
export type {SelectOption, SelectProps} from './fields/Select';
export {Checkbox} from './fields/Checkbox';
export type {CheckboxProps} from './fields/Checkbox';
```

```
feat(form): Select and Checkbox
```

---

### Task 6: TimeField

**Files:**

- Create: `packages/form/src/fields/TimeField.tsx`
- Test: `packages/form/src/fields/TimeField.test.tsx`
- Modify: `packages/form/src/index.ts`

**Interfaces:**

- Consumes: `useFieldContext`, `FieldShell`, `useLabels`, `renderField`.
- Produces: `<TimeField label disabled? required? maxHours? minuteStep? helperText? />`. The field value is a **duration in minutes**, not a clock time.

Its own task because it is the only field with real arithmetic, and because the two captions it renders ("Hours", "Minutes") are the last hardcoded English in the kit. Note it is a _duration_ picker despite the name; `TimePickerField` in Task 7 is the clock one. The names are confusing and they are the names four apps already call, so they stay.

- [ ] **Step 1: Write the failing test**

```tsx
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';

import {renderField} from '../test/renderField';
import {TimeField} from './TimeField';

describe('TimeField', () => {
  it('splits a minute total into hours and minutes', () => {
    renderField(TimeField, {defaultValue: 450, props: {label: 'Duration'}});

    expect(screen.getByRole('combobox', {name: 'Hours'})).toHaveTextContent('7');
    expect(screen.getByRole('combobox', {name: 'Minutes'})).toHaveTextContent('30');
  });

  it('renders zero for an unset value', () => {
    renderField(TimeField, {defaultValue: 0, props: {label: 'Duration'}});

    expect(screen.getByRole('combobox', {name: 'Hours'})).toHaveTextContent('0');
    expect(screen.getByRole('combobox', {name: 'Minutes'})).toHaveTextContent('0');
  });

  it('recombines a changed hour into the minute total', async () => {
    const user = userEvent.setup();
    const seen: unknown[] = [];
    renderField(TimeField, {
      defaultValue: 450,
      props: {label: 'Duration'},
      onChange: (value) => {
        seen.push(value);
        return undefined;
      },
    });

    await user.click(screen.getByRole('combobox', {name: 'Hours'}));
    await user.click(screen.getByRole('option', {name: '8'}));

    expect(seen.at(-1)).toBe(510);
  });

  it('offers minutes at the requested step', async () => {
    const user = userEvent.setup();
    renderField(TimeField, {defaultValue: 0, props: {label: 'Duration', minuteStep: 30}});

    await user.click(screen.getByRole('combobox', {name: 'Minutes'}));

    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['0', '30']);
  });

  it('caps the hour options at maxHours', async () => {
    const user = userEvent.setup();
    renderField(TimeField, {defaultValue: 0, props: {label: 'Duration', maxHours: 3}});

    await user.click(screen.getByRole('combobox', {name: 'Hours'}));

    expect(screen.getAllByRole('option')).toHaveLength(4); // 0 through 3
  });

  it('never allows more than 24 hours, whatever maxHours says', async () => {
    const user = userEvent.setup();
    renderField(TimeField, {defaultValue: 0, props: {label: 'Duration', maxHours: 100}});

    await user.click(screen.getByRole('combobox', {name: 'Hours'}));

    expect(screen.getAllByRole('option')).toHaveLength(25); // 0 through 24
  });

  it('forces minutes to zero at 24 hours', async () => {
    const user = userEvent.setup();
    const seen: unknown[] = [];
    renderField(TimeField, {
      defaultValue: 1410, // 23:30
      props: {label: 'Duration'},
      onChange: (value) => {
        seen.push(value);
        return undefined;
      },
    });

    await user.click(screen.getByRole('combobox', {name: 'Hours'}));
    await user.click(screen.getByRole('option', {name: '24'}));

    expect(seen.at(-1)).toBe(1440);
  });

  it('clamps a value above 24 hours on the way in', () => {
    renderField(TimeField, {defaultValue: 5000, props: {label: 'Duration'}});

    expect(screen.getByRole('combobox', {name: 'Hours'})).toHaveTextContent('24');
    expect(screen.getByRole('combobox', {name: 'Minutes'})).toHaveTextContent('0');
  });

  it('renders helper text when given some', () => {
    renderField(TimeField, {defaultValue: 0, props: {label: 'Duration', helperText: 'Rounded to 15 minutes'}});

    expect(screen.getByText('Rounded to 15 minutes')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm --filter @bohardlabs/form test TimeField`
Expected: FAIL, module not found.

- [ ] **Step 3: Port the field**

Copy the app version, then: replace the label row with `FieldShell`, replace the two hardcoded captions with `labels.hours` and `labels.minutes`, give each `Select` an `id` and a `labelId` so the two `combobox` queries above resolve by name, and keep the `MAX_TOTAL_MINUTES = 24 * 60` clamp and the `effectiveMaxHours = Math.min(maxHours, 24)` guard exactly as they are. Both are load-bearing and both are covered above.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @bohardlabs/form test TimeField`
Expected: PASS, 9 tests.

If "forces minutes to zero at 24 hours" fails with `1440` expected and `1470` received, the recombination is adding the old minute value before the `isAtMaxHours` guard runs. The guard has to apply to the value being written, not to the value being displayed.

- [ ] **Step 5: Export it, then hand off**

```ts
export {TimeField} from './fields/TimeField';
export type {TimeFieldProps} from './fields/TimeField';
```

```
feat(form): TimeField
```

---

### Task 7: DateField and TimePickerField

**Files:**

- Create: `packages/form/src/fields/DateField.tsx`
- Create: `packages/form/src/fields/TimePickerField.tsx`
- Test: `packages/form/src/fields/DateField.test.tsx`
- Test: `packages/form/src/fields/TimePickerField.test.tsx`
- Modify: `packages/form/src/index.ts`

**Interfaces:**

- Consumes: `useFieldContext`, `FieldShell`, `renderField`.
- Produces:
  - `<DateField label format? minDate? maxDate? disabled? required? tooltip? />`, where `format` defaults to `'DD/MM/YYYY'`.
  - `<TimePickerField label disabled? required? tooltip? />`.
  - `DEFAULT_DATE_FORMAT` exported as a constant.

The first two fields with an optional peer. Both import `@mui/x-date-pickers` and `dayjs` at module scope, which is fine because Task 9 puts a lazy boundary in front of them: a consumer who never registers them never resolves the import.

- [ ] **Step 1: Note the LocalizationProvider requirement before writing anything**

MUI's pickers throw without a `LocalizationProvider` above them. The package does **not** render one: a consumer almost certainly already has one for their own pickers, and a second one with a different adapter is a locale bug that is very hard to find. The requirement goes in the README, in a doc comment on both components, and in the test harness for this task.

Add to `src/test/renderField.tsx` an optional wrapper option rather than a second harness:

```tsx
readonly wrapper?: (children: ReactNode) => ReactNode;
```

applied around the `<form>` in `Harness`.

- [ ] **Step 2: Write the failing DateField test**

```tsx
import {LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import {describe, expect, it} from 'vitest';

import {renderField} from '../test/renderField';
import {DateField} from './DateField';

const withPickers = (children: React.ReactNode) => (
  <LocalizationProvider dateAdapter={AdapterDayjs}>{children}</LocalizationProvider>
);

describe('DateField', () => {
  it('renders an ISO date in the default DD/MM/YYYY format', () => {
    renderField(DateField, {defaultValue: '2026-03-14', props: {label: 'Start date'}, wrapper: withPickers});

    expect(screen.getByLabelText('Start date')).toHaveValue('14/03/2026');
  });

  it('renders an empty control for a null value', () => {
    renderField(DateField, {defaultValue: null, props: {label: 'Start date'}, wrapper: withPickers});

    expect(screen.getByLabelText('Start date')).toHaveValue('');
  });

  it('honours a custom format', () => {
    renderField(DateField, {
      defaultValue: '2026-03-14',
      props: {label: 'Start date', format: 'YYYY-MM-DD'},
      wrapper: withPickers,
    });

    expect(screen.getByLabelText('Start date')).toHaveValue('2026-03-14');
  });

  it('writes an ISO date string back, not a Dayjs object', async () => {
    const user = userEvent.setup();
    const seen: unknown[] = [];
    renderField(DateField, {
      defaultValue: null,
      props: {label: 'Start date'},
      wrapper: withPickers,
      onChange: (value) => {
        seen.push(value);
        return undefined;
      },
    });

    await user.type(screen.getByLabelText('Start date'), '14/03/2026');

    expect(seen.at(-1)).toBe('2026-03-14');
    expect(dayjs.isDayjs(seen.at(-1))).toBe(false);
  });

  it('ignores an incomplete date rather than writing an invalid one', async () => {
    const user = userEvent.setup();
    const seen: unknown[] = [];
    renderField(DateField, {
      defaultValue: null,
      props: {label: 'Start date'},
      wrapper: withPickers,
      onChange: (value) => {
        seen.push(value);
        return undefined;
      },
    });

    await user.type(screen.getByLabelText('Start date'), '99');

    expect(seen).not.toContain('Invalid Date');
  });
});
```

The serialisation test is the important one. A form whose value is a `Dayjs` object cannot be compared for dirtiness, cannot be JSON-posted without a transform, and breaks `isDirty` on every render. Storing an ISO string is the contract.

- [ ] **Step 3: Run, fail, write DateField**

Port the app version with three changes: `DATE_PICKER_FORMAT` becomes an exported `DEFAULT_DATE_FORMAT = 'DD/MM/YYYY'` and a `format` prop, the label row becomes `FieldShell`, and the `onChange` writes `value?.isValid() ? value.format('YYYY-MM-DD') : null` rather than whatever the app does. Check what the app does first; if it already serialises, keep its exact expression.

Add the doc comment:

```tsx
/**
 * A date input backed by MUI's `DatePicker`.
 *
 * Requires a `LocalizationProvider` above it. The package does not render one: a consumer
 * has their own, and two providers with different adapters produce a locale bug that
 * surfaces as dates being one day out for some users and not others.
 *
 * The form value is an ISO `YYYY-MM-DD` string, not a `Dayjs`. A Dayjs in form state
 * breaks dirty-checking, because two Dayjs objects for the same instant are not equal.
 */
```

Run: PASS, 5 tests.

- [ ] **Step 4: Write the failing TimePickerField test**

Four cases, same shape: renders an `HH:mm` value, renders empty for null, writes back a string rather than a Dayjs, and shows a validation error once touched. Use the same `withPickers` wrapper.

- [ ] **Step 5: Run, fail, write TimePickerField**

Port with the same three changes. Its serialised form is `'HH:mm'`.

Run: PASS, 9 tests across both files.

- [ ] **Step 6: Export both, then hand off**

```ts
export {DateField, DEFAULT_DATE_FORMAT} from './fields/DateField';
export type {DateFieldProps} from './fields/DateField';
export {TimePickerField} from './fields/TimePickerField';
export type {TimePickerFieldProps} from './fields/TimePickerField';
```

```
feat(form): DateField and TimePickerField
```

---

### Task 8: PhoneField

**Files:**

- Create: `packages/form/src/fields/PhoneField.tsx`
- Test: `packages/form/src/fields/PhoneField.test.tsx`
- Modify: `packages/form/src/index.ts`

**Interfaces:**

- Consumes: `useFieldContext`, `FieldShell`, `renderField`.
- Produces: `<PhoneField label placeholder? defaultCountry? required? tooltip? disabled? />`. `defaultCountry` is `MuiTelInputCountry` and defaults to `'CA'`.

- [ ] **Step 1: Write the failing test**

```tsx
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';

import {renderField} from '../test/renderField';
import {PhoneField} from './PhoneField';

describe('PhoneField', () => {
  it('renders the current value', () => {
    renderField(PhoneField, {defaultValue: '+1 613 555 0142', props: {label: 'Phone'}});

    expect(screen.getByLabelText('Phone')).toHaveValue('+1 613 555 0142');
  });

  it('renders an empty control for an empty value', () => {
    renderField(PhoneField, {defaultValue: '', props: {label: 'Phone'}});

    expect(screen.getByLabelText('Phone')).toHaveValue('');
  });

  it('stores the value in E.164-ish international form', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    renderField(PhoneField, {
      defaultValue: '',
      props: {label: 'Phone'},
      onChange: (value) => {
        seen.push(value);
        return undefined;
      },
    });

    await user.type(screen.getByLabelText('Phone'), '+16135550142');

    expect(seen.at(-1)?.startsWith('+1')).toBe(true);
  });

  it('offers a country selector', () => {
    renderField(PhoneField, {defaultValue: '', props: {label: 'Phone', defaultCountry: 'GB'}});

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows a validation error once touched', async () => {
    const user = userEvent.setup();
    renderField(PhoneField, {
      defaultValue: '',
      props: {label: 'Phone'},
      onChange: (value) => (value === '' ? 'Required' : undefined),
    });

    await user.click(screen.getByLabelText('Phone'));
    await user.tab();

    expect(await screen.findByText('Required')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, fail, port the field**

Port the app version onto `FieldShell`, add `disabled`, and keep `defaultCountry = 'CA'`, since a default country is unavoidable and Canada is the one the source apps use. Say so in a comment so a future reader does not read it as arbitrary.

The `sx` override on `.MuiOutlinedInput-root` in the app version sets `borderRadius: 1`, which is MUI's default. Delete it.

Run: PASS, 5 tests.

- [ ] **Step 3: Export it, then hand off**

```ts
export {PhoneField} from './fields/PhoneField';
export type {PhoneFieldProps} from './fields/PhoneField';
```

```
feat(form): PhoneField
```

---

### Task 9: lazyField

**Files:**

- Create: `packages/form/src/lazyField.tsx`
- Test: `packages/form/src/lazyField.test.tsx`
- Modify: `packages/form/src/index.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `lazyField<TProps>(loader: () => Promise<ComponentType<TProps>>, options?: {height?: number}): ComponentType<TProps>`.

This is the reason the package exists rather than being copied a fifth time. `createFormHook` takes a static map of field components, so registering `DateField` in a shared `useAppForm` imports `@mui/x-date-pickers` into every bundle that touches any form, login included. Wrapping the registration in `lazy()` turns that into a dynamic import that resolves on first render.

- [ ] **Step 1: Write the failing test**

```tsx
import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import {lazyField} from './lazyField';

describe('lazyField', () => {
  it('does not call the loader until the component renders', () => {
    const loader = vi.fn(() => Promise.resolve(() => <span>loaded</span>));

    lazyField(loader);

    expect(loader).not.toHaveBeenCalled();
  });

  it('shows a skeleton, then the component', async () => {
    const Lazy = lazyField(() => Promise.resolve(() => <span>loaded</span>));

    const {container} = render(<Lazy />);

    expect(container.querySelector('.MuiSkeleton-root')).not.toBeNull();
    expect(await screen.findByText('loaded')).toBeInTheDocument();
  });

  it('passes props through to the loaded component', async () => {
    const Lazy = lazyField<{label: string}>(() => Promise.resolve(({label}: {label: string}) => <span>{label}</span>));

    render(<Lazy label="Start date" />);

    expect(await screen.findByText('Start date')).toBeInTheDocument();
  });

  it('sizes the skeleton to the requested height', () => {
    const Lazy = lazyField(() => new Promise<() => null>(() => {}), {height: 120});

    const {container} = render(<Lazy />);

    expect(container.querySelector('.MuiSkeleton-root')).toHaveStyle({height: '120px'});
  });

  it('loads the module only once across several mounts', async () => {
    const loader = vi.fn(() => Promise.resolve(() => <span>loaded</span>));
    const Lazy = lazyField(loader);

    const first = render(<Lazy />);
    await screen.findByText('loaded');
    first.unmount();

    render(<Lazy />);
    await screen.findByText('loaded');

    expect(loader).toHaveBeenCalledOnce();
  });
});
```

The last case is `React.lazy`'s own caching, not something the wrapper implements. It is tested anyway because the wrapper is one refactor away from creating the `lazy()` inside the render function, which would re-import on every mount and undo the whole point.

- [ ] **Step 2: Run, fail, write it**

````tsx
import Skeleton from '@mui/material/Skeleton';
import type {ComponentType} from 'react';
import {Suspense, lazy} from 'react';

interface LazyFieldOptions {
  /** Matches the height of a small MUI text field with its label, so nothing jumps. */
  readonly height?: number;
}

/**
 * Registers a field without importing it.
 *
 * `createFormHook` takes a static map, so a heavy field in that map lands in every bundle
 * that imports the hook. A login screen with two text inputs should not download
 * `@mui/x-date-pickers`. This wraps the registration in `lazy()` + `Suspense`, so the
 * import resolves the first time the field is actually rendered.
 *
 * Call it at module scope. Calling it inside a component creates a new lazy component per
 * render, which re-mounts the field and loses its input on every keystroke.
 *
 * @example
 * ```tsx
 * const DateField = lazyField(() => import('@bohardlabs/form').then((m) => m.DateField));
 * ```
 */
export function lazyField<TProps extends object>(
  loader: () => Promise<ComponentType<TProps>>,
  options: LazyFieldOptions = {},
): ComponentType<TProps> {
  const {height = 56} = options;
  const Lazy = lazy(() => loader().then((Component) => ({default: Component})));

  return function LazyField(props: TProps) {
    return (
      <Suspense fallback={<Skeleton variant="rounded" height={height} />}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}
````

Run: PASS, 5 tests.

- [ ] **Step 3: Export it, then hand off**

```ts
export {lazyField} from './lazyField';
```

```
feat(form): lazyField
```

---

### Task 10: FormError, SubscribeButton, CancelButton

**Files:**

- Create: `packages/form/src/form/FormError.tsx`
- Create: `packages/form/src/form/SubscribeButton.tsx`
- Create: `packages/form/src/form/CancelButton.tsx`
- Test: `packages/form/src/form/FormError.test.tsx`
- Test: `packages/form/src/form/SubscribeButton.test.tsx`
- Test: `packages/form/src/form/CancelButton.test.tsx`
- Modify: `packages/form/src/index.ts`

**Interfaces:**

- Consumes: `useFormContext` (Task 1), `useLabels` (Task 1), `UnsavedChangesDialog` from `@bohardlabs/admin-ui`.
- Produces:
  - `<FormError />`: reads `errorMap.onSubmit` and renders a dismissible `Alert`.
  - `<SubscribeButton label loadingLabel? disabled? sx? />`.
  - `<CancelButton onCancel? disabled? hasChanges? variant? sx? />`.

These are form-level, not field-level: they read `useFormContext`, so the harness from Task 3 does not fit. Write a second small harness in the test file itself, built the same way but registering these under `formComponents`.

- [ ] **Step 1: Write the form-level harness inside the first test file**

```tsx
import {createFormHook} from '@tanstack/react-form';
import {render} from '@testing-library/react';
import type {ReactNode} from 'react';

import {fieldContext, formContext} from '../context';
import {FormError} from './FormError';

function renderWithForm(children: ReactNode, onSubmit?: () => Promise<void> | void) {
  const {useAppForm} = createFormHook({fieldComponents: {}, formComponents: {FormError}, fieldContext, formContext});

  function Harness() {
    const form = useAppForm({defaultValues: {name: ''}, onSubmit});

    return (
      <form.AppForm>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          {children}
        </form>
      </form.AppForm>
    );
  }

  return render(<Harness />);
}
```

Adapt the registered `formComponents` per file. Duplicating six lines across three test files is better than a shared helper that has to be generic over three different component sets.

- [ ] **Step 2: Write the failing FormError test**

Five cases:

1. Renders nothing when `errorMap.onSubmit` is undefined.
2. Renders the message when the submit error is a plain string.
3. Renders `error.form` when the submit error is a `{form: string, fields: {}}` object.
4. Renders nothing when the submit error is an object with no `form` key.
5. Clears the error when the alert's close button is clicked, and the alert disappears.

Case 4 is the one the app version handles by accident and is worth pinning: a validator that returns `{fields: {...}}` with no form-level message must not render an empty red bar.

Drive the error by giving the harness an `onSubmit` that returns a value, and submit via the button.

- [ ] **Step 3: Run, fail, port FormError**

Unchanged from the app version except the context import. The narrowing chain stays exactly as written: `typeof submitError === 'string'`, then `'form' in submitError && typeof submitError.form === 'string'`. Do not simplify it to an optional chain; the `in` guard is what keeps TypeScript from widening.

- [ ] **Step 4: Write the failing SubscribeButton test**

Four cases: renders the label; disables and swaps to `loadingLabel` while `isSubmitting`; falls back to `label` when no `loadingLabel` is given; honours the `disabled` prop while idle.

For the submitting state, give the harness an `onSubmit` that returns a promise you resolve by hand, exactly as in plan 2's `ConfirmDialog` test.

- [ ] **Step 5: Run, fail, port SubscribeButton**

Unchanged except the context import and one fix: `loadingLabel || label` becomes `loadingLabel ?? label`, so an intentional empty string is respected rather than falling through.

- [ ] **Step 6: Write the failing CancelButton test**

```tsx
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

// renderWithForm as above, registering {CancelButton} and a text field so the form can be
// made dirty by typing.

describe('CancelButton', () => {
  it('is disabled while the form is pristine', () => {
    // ...
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
  });

  it('calls onCancel directly when hasChanges is false', async () => {
    const onCancel = vi.fn();
    // render with hasChanges={false}
    // the button is disabled, so assert that rather than clicking
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('opens the unsaved-changes dialog when the form is dirty', async () => {
    const user = userEvent.setup();
    // render with hasChanges
    await user.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();
  });

  it('calls onCancel when the dialog is discarded', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    // render with hasChanges and onCancel
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    await user.click(await screen.findByRole('button', {name: 'Discard changes'}));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('leaves the form alone when the dialog is dismissed', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    // render with hasChanges and onCancel
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    await user.click(await screen.findByRole('button', {name: 'Keep editing'}));

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('prefers an explicit hasChanges over the form dirty state', async () => {
    const user = userEvent.setup();
    // render with hasChanges={true} on a pristine form
    await user.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
```

Fill in each harness call rather than leaving the comments in the committed file; they are here to show which case is which, not to be shipped.

- [ ] **Step 7: Run, fail, port CancelButton**

Two changes from the app version: `t('common.cancel')` becomes `labels.cancel`, and `UnsavedChangesDialog` is imported from `@bohardlabs/admin-ui` rather than a relative path. Everything else, including the `hasChanges ?? formIsDirty` precedence, stays.

Run: `pnpm --filter @bohardlabs/form test form/`
Expected: PASS, 15 tests across three files.

- [ ] **Step 8: Export the three, then hand off**

```ts
export {FormError} from './form/FormError';
export {SubscribeButton} from './form/SubscribeButton';
export type {SubscribeButtonProps} from './form/SubscribeButton';
export {CancelButton} from './form/CancelButton';
export type {CancelButtonProps} from './form/CancelButton';
```

```
feat(form): FormError, SubscribeButton and CancelButton
```

---

### Task 11: createAppForm, and the stories

**Files:**

- Create: `packages/form/src/createAppForm.ts`
- Create: `packages/form/src/fields.ts`
- Test: `packages/form/src/createAppForm.test.tsx`
- Create: `packages/form/src/Form.stories.tsx`
- Modify: `packages/form/src/index.ts`
- Modify: `apps/storybook/package.json`

**Interfaces:**

- Consumes: every field and form component from Tasks 3 through 10.
- Produces:
  - `defaultFieldComponents`: the eleven fields, heavy ones already wrapped in `lazyField`.
  - `defaultFormComponents`: `CancelButton`, `FormError`, `SubscribeButton`.
  - `createAppForm(extra?)` returning `{useAppForm, withForm}`, merging `extra.fieldComponents` and `extra.formComponents` over the defaults.
  - `useAppForm`: the no-extras case, for a consumer with no domain fields.

- [ ] **Step 1: Write `fields.ts`**

```ts
import {lazyField} from './lazyField';
import {Checkbox} from './fields/Checkbox';
import {PasswordField} from './fields/PasswordField';
import {Select} from './fields/Select';
import {TextArea} from './fields/TextArea';
import {TextField} from './fields/TextField';
import {TimeField} from './fields/TimeField';
import {CancelButton} from './form/CancelButton';
import {FormError} from './form/FormError';
import {SubscribeButton} from './form/SubscribeButton';

/**
 * Heavy fields are registered behind a lazy boundary, so a form that never renders one
 * never downloads its dependency:
 *
 *   DateField, TimePickerField → @mui/x-date-pickers + dayjs
 *   PhoneField                 → mui-tel-input
 *
 * This is why those three are optional peers. Registration costs a dynamic import, not an
 * install.
 */
const DateField = lazyField(() => import('./fields/DateField').then((m) => m.DateField));
const TimePickerField = lazyField(() => import('./fields/TimePickerField').then((m) => m.TimePickerField));
const PhoneField = lazyField(() => import('./fields/PhoneField').then((m) => m.PhoneField));

export const defaultFieldComponents = {
  Checkbox,
  DateField,
  PasswordField,
  PhoneField,
  Select,
  TextArea,
  TextField,
  TimeField,
  TimePickerField,
} as const;

export const defaultFormComponents = {
  CancelButton,
  FormError,
  SubscribeButton,
} as const;
```

Note that the light fields import directly from their own files, never from `./index`. Importing the barrel here would re-pull every field and defeat the lazy split entirely, which is the single most likely way for this to be broken by a later "tidy the imports" change. Say so in a comment above the import block.

- [ ] **Step 2: Write the failing createAppForm test**

```tsx
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {createAppForm} from './createAppForm';
import {useFieldContext} from './context';

function CustomField({label}: Readonly<{label: string}>) {
  const field = useFieldContext<string>();
  return (
    <label>
      {label}
      <input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
    </label>
  );
}

describe('createAppForm', () => {
  it('provides the built-in fields with no configuration', () => {
    const {useAppForm} = createAppForm();

    function Harness() {
      const form = useAppForm({defaultValues: {name: ''}});
      return <form.AppField name="name">{(field) => <field.TextField label="Name" />}</form.AppField>;
    }

    render(<Harness />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('registers a consumer field alongside the built-ins', () => {
    const {useAppForm} = createAppForm({fieldComponents: {CustomField}});

    function Harness() {
      const form = useAppForm({defaultValues: {name: '', custom: ''}});
      return (
        <>
          <form.AppField name="name">{(field) => <field.TextField label="Name" />}</form.AppField>
          <form.AppField name="custom">{(field) => <field.CustomField label="Custom" />}</form.AppField>
        </>
      );
    }

    render(<Harness />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Custom')).toBeInTheDocument();
  });

  it('lets a consumer field override a built-in of the same name', () => {
    const {useAppForm} = createAppForm({
      fieldComponents: {TextField: ({label}: Readonly<{label: string}>) => <span>replaced {label}</span>},
    });

    function Harness() {
      const form = useAppForm({defaultValues: {name: ''}});
      return <form.AppField name="name">{(field) => <field.TextField label="Name" />}</form.AppField>;
    }

    render(<Harness />);
    expect(screen.getByText('replaced Name')).toBeInTheDocument();
  });

  it('provides the form-level components', () => {
    const {useAppForm} = createAppForm();

    function Harness() {
      const form = useAppForm({defaultValues: {name: ''}});
      return (
        <form.AppForm>
          <form.SubscribeButton label="Save" />
        </form.AppForm>
      );
    }

    render(<Harness />);
    expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
  });

  it('reaches a consumer field through the package context, not a second one', () => {
    // CustomField imports useFieldContext from the package. If a consumer accidentally
    // called createFormHookContexts() themselves, this render would throw.
    const {useAppForm} = createAppForm({fieldComponents: {CustomField}});

    function Harness() {
      const form = useAppForm({defaultValues: {custom: 'seeded'}});
      return <form.AppField name="custom">{(field) => <field.CustomField label="Custom" />}</form.AppField>;
    }

    render(<Harness />);
    expect(screen.getByLabelText('Custom')).toHaveValue('seeded');
  });
});
```

- [ ] **Step 3: Run, fail, write createAppForm**

````ts
import {createFormHook} from '@tanstack/react-form';

import {fieldContext, formContext} from './context';
import {defaultFieldComponents, defaultFormComponents} from './fields';

interface CreateAppFormOptions {
  readonly fieldComponents?: Record<string, unknown>;
  readonly formComponents?: Record<string, unknown>;
}

/**
 * Builds a `useAppForm` with the kit's fields plus whatever the consumer adds.
 *
 * A consumer's own field imports `useFieldContext` from this package. See `./context` for
 * why that matters.
 *
 * @example
 * ```tsx
 * // app/form.ts
 * import {createAppForm, lazyField} from '@bohardlabs/form';
 *
 * const BuildingSelectField = lazyField(() =>
 *   import('./fields/BuildingSelectField').then((m) => m.BuildingSelectField),
 * );
 *
 * export const {useAppForm} = createAppForm({fieldComponents: {BuildingSelectField}});
 * ```
 */
export function createAppForm(options: CreateAppFormOptions = {}) {
  return createFormHook({
    fieldComponents: {...defaultFieldComponents, ...options.fieldComponents},
    formComponents: {...defaultFormComponents, ...options.formComponents},
    fieldContext,
    formContext,
  });
}

/** The kit's fields with nothing added, for a consumer with no domain fields of their own. */
export const {useAppForm, withForm} = createAppForm();
````

The `Record<string, unknown>` on the two options is the one place a wide type is unavoidable: `createFormHook` accepts an open record of components and infers the field API from it. It is a widening, not a cast, and the inference on the result is unaffected. If TypeScript loses the inferred field names on `form.AppField`, make `CreateAppFormOptions` generic over the two records and pass them through, rather than adding an assertion.

Run: PASS, 5 tests.

- [ ] **Step 4: Write the entry point in full**

Replace `src/index.ts` with the complete surface, grouped and commented:

```ts
/**
 * Public surface.
 *
 * Three groups: the form factory a consumer builds their app's hook from, the field and
 * form components it registers, and the pieces needed to write a field of your own.
 */

// The factory, and the ready-made hook for a consumer with no fields of their own.
export {createAppForm, useAppForm, withForm} from './createAppForm';
export {defaultFieldComponents, defaultFormComponents} from './fields';

// The contexts. A consumer's own field imports useFieldContext from here, never from
// @tanstack/react-form. See ./context.
export {fieldContext, formContext, useFieldContext, useFormContext} from './context';

// Writing your own field.
export {FieldShell} from './internal/FieldShell';
export type {CommonFieldProps} from './internal/FieldShell';
export {ErrorMessages} from './internal/ErrorMessages';
export type {FieldError} from './internal/ErrorMessages';
export {InfoTooltip} from './internal/InfoTooltip';
export {lazyField} from './lazyField';

// Fields.
export {Checkbox} from './fields/Checkbox';
export type {CheckboxProps} from './fields/Checkbox';
export {DateField, DEFAULT_DATE_FORMAT} from './fields/DateField';
export type {DateFieldProps} from './fields/DateField';
export {PasswordField} from './fields/PasswordField';
export type {PasswordFieldProps} from './fields/PasswordField';
export {PhoneField} from './fields/PhoneField';
export type {PhoneFieldProps} from './fields/PhoneField';
export {Select} from './fields/Select';
export type {SelectOption, SelectProps} from './fields/Select';
export {TextArea} from './fields/TextArea';
export type {TextAreaProps} from './fields/TextArea';
export {TextField} from './fields/TextField';
export type {TextFieldProps} from './fields/TextField';
export {TimeField} from './fields/TimeField';
export type {TimeFieldProps} from './fields/TimeField';
export {TimePickerField} from './fields/TimePickerField';
export type {TimePickerFieldProps} from './fields/TimePickerField';

// Form-level components.
export {CancelButton} from './form/CancelButton';
export type {CancelButtonProps} from './form/CancelButton';
export {FormError} from './form/FormError';
export {SubscribeButton} from './form/SubscribeButton';
export type {SubscribeButtonProps} from './form/SubscribeButton';

// Labels.
export {DEFAULT_LABELS, FormLabelsProvider, useLabels} from './i18n';
export type {FormLabels} from './i18n';
```

Exporting `DateField` directly _and_ registering a lazy copy in `fields.ts` is deliberate: a consumer who renders it outside a form, or who wants it eagerly, can import it, and the lazy registration still keeps it out of the default bundle because `fields.ts` imports it dynamically.

- [ ] **Step 5: Add the package to the showcase and write the stories**

`apps/storybook/package.json` gains `"@bohardlabs/form": "workspace:*"`, then `pnpm install`.

`Form.stories.tsx` gets four stories, each a real working form:

- **LoginForm**: email + password + `SubscribeButton`. `play` types an invalid email, submits, asserts the validation message, then corrects it and asserts a success state the story renders. This is also the story that demonstrates the point of `lazyField`: no date or phone field, so nothing heavy loads.
- **AllFields**: every field at once, wrapped in a `LocalizationProvider`. `play` asserts each control is present by its label, including the two behind lazy boundaries, which requires `findBy` rather than `getBy`.
- **ValidationStates**: a form with a required field, a min-length field and a submit-level error. `play` submits empty, asserts three messages, and asserts the `FormError` alert dismisses when closed.
- **CancelWithChanges**: a dirty form. `play` clicks Cancel, asserts the unsaved-changes dialog appears, clicks "Keep editing", and asserts the form still holds its value.

Every story wraps its content in `FormLabelsProvider` only where it is demonstrating translation; the rest rely on defaults, which is what a consumer sees first.

- [ ] **Step 6: Run everything**

Run: `pnpm --filter @bohardlabs/form test && pnpm --filter @bohardlabs/storybook test`
Expected: PASS. Roughly 70 unit tests plus the four stories, each also running axe.

- [ ] **Step 7: Confirm the lazy split actually works**

Run: `pnpm --filter @bohardlabs/form build`, then:

```bash
grep -rl "x-date-pickers" packages/form/dist | sort
```

Expected: `dist/fields/DateField.js` and `dist/fields/TimePickerField.js`, and nothing else. If `dist/fields.js` or `dist/index.js` appears in that list, the dynamic import in `fields.ts` was rewritten to a static one and the whole point of the package has been lost. Fix it before continuing.

Same check for `mui-tel-input`, which should appear only in `dist/fields/PhoneField.js`.

- [ ] **Step 8: Hand off for commit**

```
feat(form): createAppForm, the field registry, and stories
```

---

### Task 12: README, changeset, and close the plan

**Files:**

- Create: `packages/form/README.md`
- Create: `.changeset/<generated-name>.md`
- Modify: `README.md`
- Modify: `docs/roadmap.md`
- Move: this file to `docs/superpowers/plans/done/`

- [ ] **Step 1: Write the README**

Longer than the other two packages, because this one has a setup step that can be got wrong silently. Sections, in order:

1. **What it is.** A field kit for TanStack Form and MUI, with the heavy fields behind lazy boundaries.
2. **Install**, with the peer table marking the three optional peers and saying what each unlocks.
3. **Setup.** The `createAppForm` call, in a file the app owns, with the `LocalizationProvider` requirement stated next to it.
4. **The context rule**, as its own section with a heading, not a footnote. State plainly: do not call `createFormHookContexts()`; import `useFieldContext` from `@bohardlabs/form`. Show the failure mode so a reader recognises it.
5. **The fields**, one subsection each with a props table.
6. **Writing your own field**, showing `FieldShell` + `useFieldContext` + `lazyField` together.
7. **Labels**, with a worked `FormLabelsProvider`.
8. **Why lazyField**, with the actual numbers: what a login bundle costs with and without it. Measure them rather than guessing; if measuring is awkward, say what the three heavy dependencies are and leave the sizes out.

- [ ] **Step 2: Add the row to the root README**

```
| `packages/form` | TanStack Form fields for MUI, with lazy boundaries around the heavy ones | ported, not published |
```

- [ ] **Step 3: Write the changeset**

`pnpm changeset`, select `@bohardlabs/form`, **minor**:

```
Initial release. TanStack Form fields for MUI: TextField, TextArea, Select, Checkbox,
PasswordField, PhoneField, DateField, TimeField and TimePickerField, plus FormError,
SubscribeButton and CancelButton. `createAppForm` registers your own fields alongside
them, and `lazyField` keeps the date picker and phone input out of bundles that do not
render them.
```

- [ ] **Step 4: Run the full gate**

Run: `pnpm validate:ci`
Expected: PASS.

- [ ] **Step 5: Close the plan**

```bash
mv docs/superpowers/plans/open/2026-08-28-form-kit-package.md \
   docs/superpowers/plans/done/2026-08-28-form-kit-package.md
```

In `docs/roadmap.md`, section "New packages", set this plan's row to `done (today's date)`
and fix its link, which now points at `done/`.

- [ ] **Step 6: Hand off for commit**

```
feat(form): README, changeset, first release prep
```

---

## Out of scope

**Four fields stay in the app.** `AddressField` and `LocationSearchField` carry `@react-google-maps/api` plus `@/types/location`; `BuildingSelectField` and `ScheduleField` carry `@/types/vendor`, `@/hooks/useLocationApi` and `@/utils/scheduleTime`. The app registers them through `createAppForm({fieldComponents: {...}})`, which is the case Task 11 exists to support.

The two map fields could return later behind a `@bohardlabs/form/maps` subpath export, once someone has decided whether the package should depend on Google Maps at all. `BuildingSelectField` is domain and never will.

**A Zod or standard-schema integration.** The kit reads whatever shape a validator produces, string or `{message}`, and does not care which library made it. Shipping an opinion about validators would double the peer matrix for no gain.

**Adopting the package in the apps.** Needs the package published. When it lands, the app's `hooks/form.tsx` becomes a four-line `createAppForm` call and `components/form/` loses eleven of its fifteen files.
