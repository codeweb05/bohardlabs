# @bohardlabs/admin-ui Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One package holding the nine small MUI pieces every admin screen renders: five dialogs, a page header, truncating text, a pager, and a de-branded loader.

**Architecture:** Nine independent components with no shared state and no context between them, plus the one `Labels` context the whole package reads from. Nothing here fetches, routes, or knows a domain type. Two components change shape on the way in: `Loader` loses its Skipwash branding and becomes `BrandedLoader`, and `TruncatedTextWithTooltip` loses its import of an app constant.

**Tech Stack:** React 19, MUI 7, Vite lib mode, Vitest + jsdom, Storybook 10.

**Spec:** [`docs/extraction/README.md`](../../../extraction/README.md), section "2. `@bohardlabs/admin-ui`"

**Source being ported:** `skipwash-latest/skipwash-admin/src/components/`: `ConfirmDialog.tsx`, `UnsavedChangesDialog.tsx`, `DeletionErrorDialog.tsx`, `SignOutDialog.tsx`, `WelcomeDialog.tsx`, `PageHeader/`, `TruncatedTextWithTooltip/`, `ListPagination/`, `Loader.tsx`. Roughly 1000 lines.

**Why this one is worth doing before the form kit:** `CancelButton` in `@bohardlabs/form` renders `UnsavedChangesDialog`. Plan 3 cannot start until this ships.

## Global Constraints

- Package name `@bohardlabs/admin-ui`, `"private": true`, version `0.0.0`.
- No `@/…` imports. Every one becomes a prop with a default.
- No hardcoded user-facing string. One `AdminUiLabels` interface for the whole package, one `DEFAULT_LABELS`, one context. A label that interpolates is a function (`successMessage: (count: number) => string`), matching `@bohardlabs/datatable`.
- No hardcoded colour. Three of the ported files carry `rgba(...)` literals; every one is replaced with a theme token or `alpha(theme.palette.X, n)`.
- Never `any`, `@ts-ignore`, `@ts-expect-error`, `as unknown as`.
- Icons import per-icon (`@mui/icons-material/KeyboardArrowLeft`), never the barrel.
- Peers: `react` ^19, `react-dom` ^19, `@mui/material` ^7, `@mui/icons-material` ^7, `@emotion/react` ^11, `@emotion/styled` ^11. Each repeated in `devDependencies` as `catalog:`.
- ESM only, `formats: ['es']`, `preserveModules: true`.
- Every component gets a story with a `play` function. A story with no `play` asserts nothing.
- Never run a git command. Tasks end with a handoff step; a person commits.

---

### Task 1: Scaffolding and labels

**Files:**

- Create: `packages/admin-ui/package.json`
- Create: `packages/admin-ui/tsconfig.json`
- Create: `packages/admin-ui/tsconfig.build.json`
- Create: `packages/admin-ui/vite.config.ts`
- Create: `packages/admin-ui/src/index.ts`
- Create: `packages/admin-ui/src/test/setup.ts`
- Create: `packages/admin-ui/src/i18n/labels.ts`
- Create: `packages/admin-ui/src/i18n/LabelsContext.tsx`
- Create: `packages/admin-ui/src/i18n/index.ts`
- Test: `packages/admin-ui/src/i18n/LabelsContext.test.tsx`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `interface AdminUiLabels`: every string in the package, listed below.
  - `const DEFAULT_LABELS: AdminUiLabels`.
  - `<AdminUiLabelsProvider labels?: Partial<AdminUiLabels>>`.
  - `useLabels(): AdminUiLabels`, returning `DEFAULT_LABELS` outside a provider.

Scaffolding and labels are one task because neither is independently reviewable: an empty package proves nothing, and a labels module with no package to live in cannot be built.

- [ ] **Step 1: Copy the scaffolding from the image-editor package**

If plan 1 has shipped, copy from `packages/image-editor`; otherwise copy from `packages/datatable`. Either way, take `tsconfig.json`, `tsconfig.build.json`, `vite.config.ts` and `src/test/setup.ts` unchanged, minus the canvas and image stubs, which only the image editor needs. The setup file for this package is:

```ts
import '@testing-library/jest-dom/vitest';
import {cleanup} from '@testing-library/react';
import {afterEach, vi} from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
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

`matchMedia` matters here: `ListPagination` calls `useMediaQuery`, and without the stub MUI logs a warning and takes the desktop branch by accident rather than on purpose.

- [ ] **Step 2: Write `packages/admin-ui/package.json`**

```json
{
  "name": "@bohardlabs/admin-ui",
  "version": "0.0.0",
  "private": true,
  "description": "Dialogs, page headers, pagination and loaders for MUI admin screens",
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
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.0",
    "@mui/icons-material": "^7.0.0",
    "@mui/material": "^7.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@emotion/react": "catalog:",
    "@emotion/styled": "catalog:",
    "@mui/icons-material": "catalog:",
    "@mui/material": "catalog:",
    "@storybook/addon-docs": "^10.5.10",
    "@storybook/react-vite": "^10.5.10",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^26.4.0",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "babel-plugin-react-compiler": "^1.0.0",
    "jsdom": "^28.0.1",
    "react": "catalog:",
    "react-dom": "catalog:",
    "storybook": "^10.5.10",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 3: Write the failing labels test**

`packages/admin-ui/src/i18n/LabelsContext.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {AdminUiLabelsProvider, DEFAULT_LABELS, useLabels} from './index';

function ShowConfirm() {
  return <span>{useLabels().confirm}</span>;
}

function ShowDeletedCount() {
  return <span>{useLabels().deletionSuccess(3)}</span>;
}

describe('AdminUiLabelsProvider', () => {
  it('falls back to the English defaults outside a provider', () => {
    render(<ShowConfirm />);
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('overrides only the keys it is given', () => {
    render(
      <AdminUiLabelsProvider labels={{confirm: 'Bestätigen'}}>
        <ShowConfirm />
      </AdminUiLabelsProvider>,
    );
    expect(screen.getByText('Bestätigen')).toBeInTheDocument();
  });

  it('leaves untouched keys at their default', () => {
    render(
      <AdminUiLabelsProvider labels={{confirm: 'Bestätigen'}}>
        <ShowDeletedCount />
      </AdminUiLabelsProvider>,
    );
    expect(screen.getByText(DEFAULT_LABELS.deletionSuccess(3))).toBeInTheDocument();
  });

  it('takes a function label for an interpolated string', () => {
    render(
      <AdminUiLabelsProvider labels={{deletionSuccess: (count) => `${count} gelöscht`}}>
        <ShowDeletedCount />
      </AdminUiLabelsProvider>,
    );
    expect(screen.getByText('3 gelöscht')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run it and watch it fail**

Run: `pnpm --filter @bohardlabs/admin-ui test`
Expected: FAIL, "Failed to resolve import './index'".

- [ ] **Step 5: Write `labels.ts`**

One flat interface for the whole package rather than one per component. Nine small objects would mean nine providers in a consumer's tree, and every one of these strings is something an app translates in the same pass.

```ts
/**
 * Every user-facing string in the package.
 *
 * Flat rather than nested per component: a consumer translates all of these at once, and
 * nine providers in a tree is nine chances to forget one.
 *
 * A string that interpolates is a function, so a translator controls word order rather than
 * receiving a fragment to concatenate. This is the same shape `@bohardlabs/datatable` uses.
 */
export interface AdminUiLabels {
  // Shared dialog actions
  readonly cancel: string;
  readonly confirm: string;
  readonly close: string;

  // UnsavedChangesDialog
  readonly unsavedChangesTitle: string;
  readonly unsavedChangesMessage: string;
  readonly discardChanges: string;
  readonly keepEditing: string;

  // DeletionErrorDialog
  readonly deletionSuccess: (count: number) => string;
  readonly deletionErrorSummary: (count: number) => string;

  // SignOutDialog
  readonly signOutTitle: string;
  readonly signOutMessage: string;
  readonly signOutAllSessions: string;
  readonly signOut: string;

  // WelcomeDialog
  readonly welcomeTitle: string;
  readonly welcomeMessage: string;
  readonly welcomeGetStarted: string;

  // ListPagination
  readonly totalItems: (count: number) => string;
  readonly itemsPerPage: string;
  readonly rowsDisplayed: (from: number, to: number, count: number) => string;
  readonly firstPage: string;
  readonly previousPage: string;
  readonly nextPage: string;
  readonly lastPage: string;

  // BrandedLoader
  readonly loading: string;
}

export const DEFAULT_LABELS: AdminUiLabels = {
  cancel: 'Cancel',
  confirm: 'Confirm',
  close: 'Close',

  unsavedChangesTitle: 'Discard changes?',
  unsavedChangesMessage: 'You have unsaved changes that will be lost. Are you sure you want to discard them?',
  discardChanges: 'Discard changes',
  keepEditing: 'Keep editing',

  deletionSuccess: (count) => `Successfully deleted ${count} item(s)`,
  deletionErrorSummary: (count) => `${count} item(s) could not be deleted:`,

  signOutTitle: 'Sign out',
  signOutMessage: 'Are you sure you want to sign out?',
  signOutAllSessions: 'Sign out of all sessions',
  signOut: 'Sign out',

  welcomeTitle: 'Welcome',
  welcomeMessage: 'This is your first time signing in. Take a moment to explore.',
  welcomeGetStarted: 'Get started',

  totalItems: (count) => `${count} item(s) total.`,
  itemsPerPage: 'Items per page',
  rowsDisplayed: (from, to, count) => `${from}-${to} of ${count}`,
  firstPage: 'First page',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  lastPage: 'Last page',

  loading: 'Loading',
};
```

The welcome copy is deliberately shorter and less specific than the app's ("Welcome to the Admin Panel!", "We're excited to have you on board…"). A default that presumes the consumer is an admin panel and enthusiastic is a default nobody keeps.

- [ ] **Step 6: Write `LabelsContext.tsx` and `i18n/index.ts`**

```tsx
import {createContext, useContext, useMemo} from 'react';
import type {ReactNode} from 'react';

import type {AdminUiLabels} from './labels';
import {DEFAULT_LABELS} from './labels';

const LabelsContext = createContext<AdminUiLabels>(DEFAULT_LABELS);

interface AdminUiLabelsProviderProps {
  readonly labels?: Partial<AdminUiLabels>;
  readonly children: ReactNode;
}

export function AdminUiLabelsProvider({labels, children}: Readonly<AdminUiLabelsProviderProps>) {
  const value = useMemo<AdminUiLabels>(() => (labels ? {...DEFAULT_LABELS, ...labels} : DEFAULT_LABELS), [labels]);

  return <LabelsContext.Provider value={value}>{children}</LabelsContext.Provider>;
}

export function useLabels(): AdminUiLabels {
  return useContext(LabelsContext);
}
```

`packages/admin-ui/src/i18n/index.ts`:

```ts
export {AdminUiLabelsProvider, useLabels} from './LabelsContext';
export {DEFAULT_LABELS} from './labels';
export type {AdminUiLabels} from './labels';
```

- [ ] **Step 7: Write a temporary entry point**

`packages/admin-ui/src/index.ts`:

```ts
export {AdminUiLabelsProvider, DEFAULT_LABELS, useLabels} from './i18n';
export type {AdminUiLabels} from './i18n';
```

- [ ] **Step 8: Install, test, build**

Run: `pnpm install && pnpm --filter @bohardlabs/admin-ui test && pnpm --filter @bohardlabs/admin-ui build`
Expected: 4 tests pass, build succeeds.

- [ ] **Step 9: Hand off for commit**

```
feat(admin-ui): scaffold the package and its labels
```

---

### Task 2: TruncatedTextWithTooltip

**Files:**

- Create: `packages/admin-ui/src/TruncatedTextWithTooltip.tsx`
- Test: `packages/admin-ui/src/TruncatedTextWithTooltip.test.tsx`
- Modify: `packages/admin-ui/src/index.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `<TruncatedTextWithTooltip text maxLength? variant? component? sx? />` and `TruncatedTextWithTooltipProps`. `maxLength` defaults to `30`.

First because `PageHeader` renders it. The only change from the app version is that `NAME_TOOLTIP_TRUNCATE_LENGTH` becomes an exported constant with the same value.

- [ ] **Step 1: Write the failing test**

```tsx
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';

import {DEFAULT_TRUNCATE_LENGTH, TruncatedTextWithTooltip} from './TruncatedTextWithTooltip';

describe('TruncatedTextWithTooltip', () => {
  it('renders short text in full and adds no tooltip', () => {
    render(<TruncatedTextWithTooltip text="Short" />);

    expect(screen.getByText('Short')).toBeInTheDocument();
    expect(screen.queryByLabelText('Short')).not.toBeInTheDocument();
  });

  it('truncates at the default length', () => {
    const text = 'x'.repeat(DEFAULT_TRUNCATE_LENGTH + 5);
    render(<TruncatedTextWithTooltip text={text} />);

    expect(screen.getByText(`${'x'.repeat(DEFAULT_TRUNCATE_LENGTH)}…`)).toBeInTheDocument();
  });

  it('truncates at an explicit maxLength', () => {
    render(<TruncatedTextWithTooltip text="abcdefghij" maxLength={4} />);

    expect(screen.getByText('abcd…')).toBeInTheDocument();
  });

  it('does not truncate text of exactly maxLength', () => {
    render(<TruncatedTextWithTooltip text="abcd" maxLength={4} />);

    expect(screen.getByText('abcd')).toBeInTheDocument();
  });

  it('shows the full text in a tooltip on hover', async () => {
    const user = userEvent.setup();
    render(<TruncatedTextWithTooltip text="abcdefghij" maxLength={4} />);

    await user.hover(screen.getByText('abcd…'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('abcdefghij');
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm --filter @bohardlabs/admin-ui test TruncatedText`
Expected: FAIL, module not found.

- [ ] **Step 3: Port the component**

Copy the app file and change two things: replace the `@/constants/display` import with a local exported constant, and export the props type from the package root in Step 5.

```tsx
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type {TypographyProps} from '@mui/material/Typography';
import type {SxProps, Theme} from '@mui/material/styles';

/**
 * Long enough for most names in a table cell, short enough that two of them fit side by
 * side at 1280px. Override per call site rather than changing this.
 */
export const DEFAULT_TRUNCATE_LENGTH = 30;

export interface TruncatedTextWithTooltipProps {
  readonly text: string;
  readonly maxLength?: number;
  readonly variant?: TypographyProps['variant'];
  readonly component?: TypographyProps['component'];
  readonly sx?: SxProps<Theme>;
}

/**
 * Text cut to `maxLength` with an ellipsis, full value in a tooltip on hover.
 *
 * Truncation is by character count, not by CSS overflow, so the cut point is the same at
 * every viewport width and a test can assert on it.
 */
export function TruncatedTextWithTooltip({
  text,
  maxLength = DEFAULT_TRUNCATE_LENGTH,
  variant = 'body2',
  /** Matches the MUI body2 default: a block line under a label, not inline with it. */
  component = 'p',
  sx,
}: Readonly<TruncatedTextWithTooltipProps>) {
  const needsTooltip = text.length > maxLength;
  const displayText = needsTooltip ? `${text.slice(0, maxLength)}…` : text;

  const typography = (
    <Typography
      variant={variant}
      component={component}
      sx={{...(needsTooltip ? {overflowWrap: 'break-word'} : {}), ...sx}}
    >
      {displayText}
    </Typography>
  );

  if (!needsTooltip) {
    return typography;
  }

  return (
    <Tooltip title={text} enterTouchDelay={0} placement="top">
      {typography}
    </Tooltip>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @bohardlabs/admin-ui test TruncatedText`
Expected: PASS, 5 tests.

- [ ] **Step 5: Export it**

Add to `packages/admin-ui/src/index.ts`:

```ts
export {DEFAULT_TRUNCATE_LENGTH, TruncatedTextWithTooltip} from './TruncatedTextWithTooltip';
export type {TruncatedTextWithTooltipProps} from './TruncatedTextWithTooltip';
```

- [ ] **Step 6: Hand off for commit**

```
feat(admin-ui): TruncatedTextWithTooltip
```

---

### Task 3: PageHeader

**Files:**

- Create: `packages/admin-ui/src/PageHeader.tsx`
- Test: `packages/admin-ui/src/PageHeader.test.tsx`
- Modify: `packages/admin-ui/src/index.ts`

**Interfaces:**

- Consumes: `TruncatedTextWithTooltip` from Task 2.
- Produces: `<PageHeader title subtitle? badges? titleMaxLength? />` and `PageHeaderProps`.

- [ ] **Step 1: Write the failing test**

The app's own test file is a good starting point and is reproduced here with two additions: a check that the heading level is `h5`, and a check that `subtitle={null}` renders nothing rather than an empty paragraph.

```tsx
import Chip from '@mui/material/Chip';
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {PageHeader} from './PageHeader';

describe('PageHeader', () => {
  it('renders the title as a heading', () => {
    render(<PageHeader title="Buildings" />);

    expect(screen.getByRole('heading', {name: 'Buildings'})).toBeInTheDocument();
  });

  it('renders the subtitle when given one', () => {
    render(<PageHeader title="Buildings" subtitle="Manage your buildings" />);

    expect(screen.getByText('Manage your buildings')).toBeInTheDocument();
  });

  it('renders no subtitle element when subtitle is null', () => {
    const {container} = render(<PageHeader title="Buildings" subtitle={null} />);

    expect(container.querySelectorAll('p')).toHaveLength(0);
  });

  it('renders badges alongside the title', () => {
    render(
      <PageHeader
        title="Building detail"
        badges={
          <>
            <Chip label="Active" />
            <Chip label="Verified" />
          </>
        }
      />,
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('truncates the title when titleMaxLength is set, keeping the full value accessible', () => {
    const longTitle = `${'x'.repeat(20)}yyyyy`;
    render(<PageHeader title={longTitle} titleMaxLength={20} />);

    const heading = screen.getByRole('heading', {name: longTitle});
    expect(heading).toHaveTextContent(`${'x'.repeat(20)}…`);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm --filter @bohardlabs/admin-ui test PageHeader`
Expected: FAIL, module not found.

- [ ] **Step 3: Port the component**

Copy the app file. One change: the `@/components/TruncatedTextWithTooltip` import becomes a relative one.

```tsx
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type {ReactNode} from 'react';

import {TruncatedTextWithTooltip} from './TruncatedTextWithTooltip';

export interface PageHeaderProps {
  readonly title: string;
  readonly subtitle?: string | null;
  readonly badges?: ReactNode;
  /** When set, the title truncates to this length with the full value in a tooltip. */
  readonly titleMaxLength?: number;
}

/**
 * The title block at the top of a list or detail screen.
 *
 * It renders no actions of its own: a consumer puts buttons in a sibling, because the
 * moment a header owns its action bar it starts needing to know what the actions do.
 */
export function PageHeader({title, subtitle, badges, titleMaxLength}: Readonly<PageHeaderProps>) {
  const titleNode =
    titleMaxLength == null ? (
      <Typography variant="h5">{title}</Typography>
    ) : (
      <TruncatedTextWithTooltip text={title} maxLength={titleMaxLength} variant="h5" component="h5" />
    );

  return (
    <Box sx={{minWidth: 0, flex: '1 1 auto'}}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          mb: badges ? 1 : undefined,
          flexWrap: 'wrap',
          minWidth: 0,
        }}
      >
        <Box sx={{minWidth: 0}}>{titleNode}</Box>
        {badges}
      </Box>
      {subtitle ? (
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      ) : null}
    </Box>
  );
}
```

Note that the untruncated title renders as `<Typography variant="h5">`, which MUI maps to an `<h5>` element. The truncated branch passes `component="h5"` to match. If those two ever disagree the heading level of a page changes when its title gets long, which is an a11y bug that no test outside this file would catch.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @bohardlabs/admin-ui test PageHeader`
Expected: PASS, 5 tests.

- [ ] **Step 5: Export it**

```ts
export {PageHeader} from './PageHeader';
export type {PageHeaderProps} from './PageHeader';
```

- [ ] **Step 6: Hand off for commit**

```
feat(admin-ui): PageHeader
```

---

### Task 4: ConfirmDialog and UnsavedChangesDialog

**Files:**

- Create: `packages/admin-ui/src/dialogs/dialogSx.ts`
- Create: `packages/admin-ui/src/dialogs/ConfirmDialog.tsx`
- Create: `packages/admin-ui/src/dialogs/UnsavedChangesDialog.tsx`
- Test: `packages/admin-ui/src/dialogs/ConfirmDialog.test.tsx`
- Test: `packages/admin-ui/src/dialogs/UnsavedChangesDialog.test.tsx`
- Modify: `packages/admin-ui/src/index.ts`

**Interfaces:**

- Consumes: `useLabels` from Task 1.
- Produces:
  - `dialogSx`: the shared paper, title, content and actions `sx` objects the five dialogs all repeat today.
  - `<ConfirmDialog open onClose onConfirm title message confirmLabel? cancelLabel? confirmColor? isLoading? />`.
  - `<UnsavedChangesDialog open onDiscard onCancel title? message? />`.

The five dialogs repeat the same twelve lines of `sx` five times. Extract that once here; Tasks 5 uses it too.

- [ ] **Step 1: Write the shared sx module**

`packages/admin-ui/src/dialogs/dialogSx.ts`:

```ts
import type {SxProps, Theme} from '@mui/material/styles';

/**
 * The spacing and type scale every dialog in this package shares.
 *
 * Extracted rather than repeated because five copies of the same numbers is five chances
 * for one dialog to drift a quarter of a spacing unit off the others, which nobody
 * notices in review and everybody notices side by side.
 */
export const dialogSx = {
  paper: {borderRadius: 2, m: {xs: 2, sm: 3}} satisfies SxProps<Theme>,
  title: {
    fontSize: {xs: '1rem', sm: '1.125rem'},
    fontWeight: 600,
    pb: 1,
    pt: {xs: 2, sm: 2.5},
    px: {xs: 2, sm: 2.5},
  } satisfies SxProps<Theme>,
  content: {px: {xs: 2, sm: 2.5}, py: 1} satisfies SxProps<Theme>,
  actions: {px: {xs: 2, sm: 2.5}, pb: {xs: 2, sm: 2.5}, pt: 1.5, gap: 1} satisfies SxProps<Theme>,
  actionButton: {minWidth: 80, fontSize: '0.8125rem'} satisfies SxProps<Theme>,
} as const;
```

- [ ] **Step 2: Write the failing ConfirmDialog test**

```tsx
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {AdminUiLabelsProvider} from '../i18n';
import {ConfirmDialog} from './ConfirmDialog';

const BASE = {open: true, title: 'Delete building', message: 'This cannot be undone.'} as const;

describe('ConfirmDialog', () => {
  it('renders the title, message and default action labels', () => {
    render(<ConfirmDialog {...BASE} onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByText('Delete building')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Confirm'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
  });

  it('prefers an explicit label over the one from context', () => {
    render(
      <AdminUiLabelsProvider labels={{confirm: 'Bestätigen'}}>
        <ConfirmDialog {...BASE} confirmLabel="Delete" onClose={vi.fn()} onConfirm={vi.fn()} />
      </AdminUiLabelsProvider>,
    );

    expect(screen.getByRole('button', {name: 'Delete'})).toBeInTheDocument();
  });

  it('falls back to the context label when no explicit one is given', () => {
    render(
      <AdminUiLabelsProvider labels={{confirm: 'Bestätigen'}}>
        <ConfirmDialog {...BASE} onClose={vi.fn()} onConfirm={vi.fn()} />
      </AdminUiLabelsProvider>,
    );

    expect(screen.getByRole('button', {name: 'Bestätigen'})).toBeInTheDocument();
  });

  it('calls onConfirm when confirm is pressed', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...BASE} onClose={vi.fn()} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('disables both buttons while an async onConfirm is in flight', async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    render(<ConfirmDialog {...BASE} onClose={vi.fn()} onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
    });

    release?.();
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeEnabled();
    });
  });

  it('re-enables the buttons when onConfirm rejects', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(() => Promise.reject(new Error('server said no')));

    render(<ConfirmDialog {...BASE} onClose={vi.fn()} onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeEnabled();
    });
  });

  it('ignores a close attempt while loading', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ConfirmDialog {...BASE} isLoading onClose={onClose} onConfirm={vi.fn()} />);
    await user.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(onClose).not.toHaveBeenCalled();
  });
});
```

The rejection case is the one the app version gets right by accident: `finally` resets the submitting flag whether `onConfirm` resolves or throws. Pinning it in a test means a later refactor to `.then()` cannot quietly leave a failed dialog stuck disabled. Note the unhandled rejection is caught by the component's `try/finally` only for the flag; add `.catch()` handling in the implementation so the promise itself does not surface as an unhandled rejection in the test run.

- [ ] **Step 3: Run and watch it fail**

Run: `pnpm --filter @bohardlabs/admin-ui test ConfirmDialog`
Expected: FAIL, module not found.

- [ ] **Step 4: Write ConfirmDialog**

```tsx
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import {useState} from 'react';

import {useLabels} from '../i18n';
import {dialogSx} from './dialogSx';

export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void | Promise<void>;
  readonly title: string;
  readonly message: string;
  /** Overrides the `confirm` label from context, for a verb specific to this action. */
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly confirmColor?: 'primary' | 'error' | 'warning' | 'success';
  /** For a caller that already tracks its own pending state, such as a mutation. */
  readonly isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmColor = 'primary',
  isLoading = false,
}: Readonly<ConfirmDialogProps>) {
  const labels = useLabels();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loading = isLoading || isSubmitting;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
    } catch {
      // The caller owns error reporting. Swallowing here only prevents an unhandled
      // rejection; the `finally` below is what re-enables the dialog either way.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth slotProps={{paper: {sx: dialogSx.paper}}}>
      <DialogTitle sx={dialogSx.title}>{title}</DialogTitle>

      <DialogContent sx={dialogSx.content}>
        <Typography variant="body2" color="text.secondary" sx={{fontSize: {xs: '0.8125rem', sm: '0.875rem'}}}>
          {message}
        </Typography>
      </DialogContent>

      <DialogActions sx={dialogSx.actions}>
        <Button onClick={handleClose} disabled={loading} size="small" sx={dialogSx.actionButton}>
          {cancelLabel ?? labels.cancel}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={confirmColor}
          disabled={loading}
          size="small"
          sx={dialogSx.actionButton}
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : (confirmLabel ?? labels.confirm)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @bohardlabs/admin-ui test ConfirmDialog`
Expected: PASS, 7 tests.

If "disables both buttons while an async onConfirm is in flight" fails because the confirm button is queried by name and the name is now a spinner, that is the point of asserting on Cancel instead. Do not change the assertion to look for the confirm button by its label.

- [ ] **Step 6: Write the failing UnsavedChangesDialog test**

```tsx
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {UnsavedChangesDialog} from './UnsavedChangesDialog';

describe('UnsavedChangesDialog', () => {
  it('renders the default copy', () => {
    render(<UnsavedChangesDialog open onDiscard={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText('Discard changes?')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Discard changes'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Keep editing'})).toBeInTheDocument();
  });

  it('calls onDiscard from the destructive action', async () => {
    const user = userEvent.setup();
    const onDiscard = vi.fn();
    render(<UnsavedChangesDialog open onDiscard={onDiscard} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', {name: 'Discard changes'}));

    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it('calls onCancel from the safe action', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<UnsavedChangesDialog open onDiscard={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', {name: 'Keep editing'}));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('takes a per-instance title and message', () => {
    render(
      <UnsavedChangesDialog
        open
        title="Leave this form?"
        message="Your draft is not saved."
        onDiscard={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Leave this form?')).toBeInTheDocument();
    expect(screen.getByText('Your draft is not saved.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Write UnsavedChangesDialog**

```tsx
import {useLabels} from '../i18n';
import {ConfirmDialog} from './ConfirmDialog';

export interface UnsavedChangesDialogProps {
  readonly open: boolean;
  readonly onDiscard: () => void;
  readonly onCancel: () => void;
  readonly title?: string;
  readonly message?: string;
}

/**
 * The "you have unsaved changes" prompt, as a named component rather than a `ConfirmDialog`
 * with the right props: the destructive action is the confirm and the safe action is the
 * cancel, which is the inversion every caller gets backwards at least once.
 */
export function UnsavedChangesDialog({open, onDiscard, onCancel, title, message}: Readonly<UnsavedChangesDialogProps>) {
  const labels = useLabels();

  return (
    <ConfirmDialog
      open={open}
      onClose={onCancel}
      onConfirm={onDiscard}
      title={title ?? labels.unsavedChangesTitle}
      message={message ?? labels.unsavedChangesMessage}
      confirmLabel={labels.discardChanges}
      cancelLabel={labels.keepEditing}
      confirmColor="error"
    />
  );
}
```

- [ ] **Step 8: Run the tests and export both**

Run: `pnpm --filter @bohardlabs/admin-ui test dialogs`
Expected: PASS, 11 tests.

Add to `packages/admin-ui/src/index.ts`:

```ts
export {ConfirmDialog} from './dialogs/ConfirmDialog';
export type {ConfirmDialogProps} from './dialogs/ConfirmDialog';
export {UnsavedChangesDialog} from './dialogs/UnsavedChangesDialog';
export type {UnsavedChangesDialogProps} from './dialogs/UnsavedChangesDialog';
```

`dialogSx` stays unexported. It is a layout detail, and exporting it makes every spacing tweak a semver-major.

- [ ] **Step 9: Hand off for commit**

```
feat(admin-ui): ConfirmDialog and UnsavedChangesDialog
```

---

### Task 5: DeletionErrorDialog, SignOutDialog, WelcomeDialog

**Files:**

- Create: `packages/admin-ui/src/dialogs/DeletionErrorDialog.tsx`
- Create: `packages/admin-ui/src/dialogs/SignOutDialog.tsx`
- Create: `packages/admin-ui/src/dialogs/WelcomeDialog.tsx`
- Test: `packages/admin-ui/src/dialogs/DeletionErrorDialog.test.tsx`
- Test: `packages/admin-ui/src/dialogs/SignOutDialog.test.tsx`
- Test: `packages/admin-ui/src/dialogs/WelcomeDialog.test.tsx`
- Modify: `packages/admin-ui/src/index.ts`

**Interfaces:**

- Consumes: `useLabels` (Task 1), `dialogSx` (Task 4).
- Produces:
  - `interface DeletionError {id: string; name: string; reason: string}`.
  - `<DeletionErrorDialog open onClose title successCount errors showSuccessMessage? />`.
  - `<SignOutDialog open onClose onConfirm />` where `onConfirm: (allSessions: boolean) => Promise<void>`.
  - `<WelcomeDialog open onClose icon? />`.

Three dialogs in one task because none of them is more than a hundred lines and none is independently rejectable: they are the same shape with different bodies.

- [ ] **Step 1: Write the failing DeletionErrorDialog test**

```tsx
import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import {DeletionErrorDialog} from './DeletionErrorDialog';
import type {DeletionError} from './DeletionErrorDialog';

const ERRORS: DeletionError[] = [
  {id: '1', name: 'Building A', reason: 'Has 3 active bookings'},
  {id: '2', name: 'Building B', reason: 'Referenced by a route'},
];

describe('DeletionErrorDialog', () => {
  it('lists every failure with its reason', () => {
    render(<DeletionErrorDialog open title="Delete failed" successCount={0} errors={ERRORS} onClose={vi.fn()} />);

    expect(screen.getByText('Building A')).toBeInTheDocument();
    expect(screen.getByText('Has 3 active bookings')).toBeInTheDocument();
    expect(screen.getByText('Building B')).toBeInTheDocument();
    expect(screen.getByText('Referenced by a route')).toBeInTheDocument();
  });

  it('summarises the failures with a count', () => {
    render(<DeletionErrorDialog open title="Delete failed" successCount={0} errors={ERRORS} onClose={vi.fn()} />);

    expect(screen.getByText('2 item(s) could not be deleted:')).toBeInTheDocument();
  });

  it('shows a success alert only when something succeeded', () => {
    const {rerender} = render(
      <DeletionErrorDialog open title="Delete failed" successCount={0} errors={ERRORS} onClose={vi.fn()} />,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    rerender(<DeletionErrorDialog open title="Delete failed" successCount={5} errors={ERRORS} onClose={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Successfully deleted 5 item(s)');
  });

  it('hides the success alert when asked to, even with successes', () => {
    render(
      <DeletionErrorDialog
        open
        title="Delete failed"
        successCount={5}
        errors={ERRORS}
        showSuccessMessage={false}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders an empty error list without crashing', () => {
    render(<DeletionErrorDialog open title="Delete failed" successCount={2} errors={[]} onClose={vi.fn()} />);

    expect(screen.getByText('0 item(s) could not be deleted:')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm --filter @bohardlabs/admin-ui test DeletionError`
Expected: FAIL, module not found.

- [ ] **Step 3: Write DeletionErrorDialog**

Three changes from the app version: `DeletionError` is declared here rather than imported from `@/types/deletion`, the two `successMessageKey`/`errorSummaryKey` props are gone because the labels context now covers that, and the `rgba(255, 0, 0, …)` list background becomes `alpha(theme.palette.error.main, …)`. The hardcoded red was also the wrong red in any theme whose error colour is not pure red.

```tsx
import ErrorOutline from '@mui/icons-material/ErrorOutline';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import {alpha} from '@mui/material/styles';

import {useLabels} from '../i18n';
import {dialogSx} from './dialogSx';

export interface DeletionError {
  readonly id: string;
  /** What the user recognises the item by: a name, an email, a reference. */
  readonly name: string;
  readonly reason: string;
}

export interface DeletionErrorDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly successCount: number;
  readonly errors: readonly DeletionError[];
  readonly showSuccessMessage?: boolean;
}

/**
 * The result of a bulk delete where some rows failed.
 *
 * It reports both halves in one place, because "3 deleted, 2 refused, here is why" is one
 * outcome and splitting it across a toast and a dialog loses the pairing.
 */
export function DeletionErrorDialog({
  open,
  onClose,
  title,
  successCount,
  errors,
  showSuccessMessage = true,
}: Readonly<DeletionErrorDialogProps>) {
  const labels = useLabels();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{paper: {sx: dialogSx.paper}}}>
      <DialogTitle sx={dialogSx.title}>{title}</DialogTitle>

      <DialogContent sx={{px: {xs: 2, sm: 2.5}, py: 2}}>
        {showSuccessMessage && successCount > 0 && (
          <Alert severity="success" sx={{mb: 2}}>
            {labels.deletionSuccess(successCount)}
          </Alert>
        )}

        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 2}}>
          <ErrorOutline color="error" />
          <Typography variant="body2" color="text.secondary">
            {labels.deletionErrorSummary(errors.length)}
          </Typography>
        </Box>

        <List
          sx={{
            bgcolor: (theme) => alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.08 : 0.04),
            borderRadius: 1,
            border: (theme) => `1px solid ${theme.palette.divider}`,
            maxHeight: 300,
            overflow: 'auto',
          }}
        >
          {errors.map((error, index) => (
            <ListItem
              key={error.id}
              divider={index < errors.length - 1}
              sx={{py: 1.5, px: 2, flexDirection: 'column', alignItems: 'flex-start'}}
            >
              <ListItemText
                primary={error.name}
                secondary={error.reason}
                slotProps={{
                  primary: {fontSize: '0.875rem', fontWeight: 500},
                  secondary: {fontSize: '0.8125rem', color: 'error.main', mt: 0.5},
                }}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>

      <DialogActions sx={{...dialogSx.actions, gap: 0}}>
        <Button onClick={onClose} variant="contained" size="small" sx={dialogSx.actionButton}>
          {labels.close}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 4: Write the failing SignOutDialog test**

```tsx
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {SignOutDialog} from './SignOutDialog';

describe('SignOutDialog', () => {
  it('confirms for this session only by default', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(() => Promise.resolve());
    render(<SignOutDialog open onClose={vi.fn()} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', {name: 'Sign out'}));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(false));
  });

  it('passes true when all sessions is ticked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(() => Promise.resolve());
    render(<SignOutDialog open onClose={vi.fn()} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('checkbox', {name: 'Sign out of all sessions'}));
    await user.click(screen.getByRole('button', {name: 'Sign out'}));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(true));
  });

  it('resets the checkbox when reopened after a cancel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const {rerender} = render(<SignOutDialog open onClose={onClose} onConfirm={vi.fn()} />);

    await user.click(screen.getByRole('checkbox', {name: 'Sign out of all sessions'}));
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(onClose).toHaveBeenCalledOnce();

    rerender(<SignOutDialog open={false} onClose={onClose} onConfirm={vi.fn()} />);
    rerender(<SignOutDialog open onClose={onClose} onConfirm={vi.fn()} />);

    expect(screen.getByRole('checkbox', {name: 'Sign out of all sessions'})).not.toBeChecked();
  });

  it('locks the dialog while signing out', async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    render(<SignOutDialog open onClose={vi.fn()} onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', {name: 'Sign out'}));

    await waitFor(() => {
      expect(screen.getByRole('checkbox', {name: 'Sign out of all sessions'})).toBeDisabled();
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
    });

    release?.();
  });
});
```

The reset test is the one behaviour change from the app version. The app resets `logoutAll` inside `handleClose`, which misses the case where the parent closes the dialog without going through the cancel button. Reset on `open` transitioning to `false` instead, in a `useEffect`.

- [ ] **Step 5: Write SignOutDialog**

Port the app file, with these differences: every `t(...)` becomes a `labels.*` read, the shared `sx` comes from `dialogSx`, and the reset moves out of `handleClose`:

```tsx
useEffect(() => {
  if (!open) {
    setLogoutAll(false);
  }
}, [open]);
```

`handleClose` keeps only the guard:

```tsx
const handleClose = () => {
  if (!isSubmitting) {
    onClose();
  }
};
```

`handleConfirm` gets the same `catch {}` as `ConfirmDialog`, for the same reason.

- [ ] **Step 6: Write the failing WelcomeDialog test**

```tsx
import Waving from '@mui/icons-material/WavingHand';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {WelcomeDialog} from './WelcomeDialog';

describe('WelcomeDialog', () => {
  it('renders the default copy and action', () => {
    render(<WelcomeDialog open onClose={vi.fn()} />);

    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Get started'})).toBeInTheDocument();
  });

  it('calls onClose from the action', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<WelcomeDialog open onClose={onClose} />);

    await user.click(screen.getByRole('button', {name: 'Get started'}));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('takes a replacement icon', () => {
    render(<WelcomeDialog open icon={<Waving data-testid="custom-icon" />} onClose={vi.fn()} />);

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Write WelcomeDialog**

Port the app file with `t(...)` replaced by `labels.*`, `dialogSx` for spacing, and one new prop: `icon?: ReactNode`, defaulting to the `Celebration` icon the app uses. The circular badge behind it keeps `bgcolor: 'primary.main'` and `color: 'primary.contrastText'`, both already tokens.

```tsx
export interface WelcomeDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Replaces the default celebration icon in the badge above the title. */
  readonly icon?: ReactNode;
}
```

- [ ] **Step 8: Run every dialog test**

Run: `pnpm --filter @bohardlabs/admin-ui test dialogs`
Expected: PASS, 23 tests across five files.

- [ ] **Step 9: Export the three**

```ts
export {DeletionErrorDialog} from './dialogs/DeletionErrorDialog';
export type {DeletionError, DeletionErrorDialogProps} from './dialogs/DeletionErrorDialog';
export {SignOutDialog} from './dialogs/SignOutDialog';
export type {SignOutDialogProps} from './dialogs/SignOutDialog';
export {WelcomeDialog} from './dialogs/WelcomeDialog';
export type {WelcomeDialogProps} from './dialogs/WelcomeDialog';
```

- [ ] **Step 10: Hand off for commit**

```
feat(admin-ui): deletion, sign-out and welcome dialogs
```

---

### Task 6: ListPagination

**Files:**

- Create: `packages/admin-ui/src/ListPagination.tsx`
- Test: `packages/admin-ui/src/ListPagination.test.tsx`
- Modify: `packages/admin-ui/src/index.ts`

**Interfaces:**

- Consumes: `useLabels` from Task 1.
- Produces: `<ListPagination pageIndex pageSize totalRows onPageIndexChange onPageSizeChange pageSizeOptions? showRowsPerPage? showPageInfo? showFirstLastButtons? sx? />` and `ListPaginationProps`. `pageSizeOptions` defaults to `[12, 24, 48]`.

This is the pager for card grids and lists, not for the table. `@bohardlabs/datatable` has its own, wired to TanStack's pagination state. Overlapping labels are a nuisance but not a reason to couple two packages: a consumer that uses both passes the same strings twice, which is cheaper than either package depending on the other.

- [ ] **Step 1: Write the failing test**

```tsx
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {ListPagination} from './ListPagination';

const BASE = {pageIndex: 1, pageSize: 12, totalRows: 100} as const;

function setup(overrides: Partial<React.ComponentProps<typeof ListPagination>> = {}) {
  const onPageIndexChange = vi.fn();
  const onPageSizeChange = vi.fn();
  render(
    <ListPagination
      {...BASE}
      onPageIndexChange={onPageIndexChange}
      onPageSizeChange={onPageSizeChange}
      {...overrides}
    />,
  );
  return {onPageIndexChange, onPageSizeChange};
}

describe('ListPagination', () => {
  it('reports the total and the visible range', () => {
    setup();

    expect(screen.getByText('100 item(s) total.')).toBeInTheDocument();
    expect(screen.getByText('13-24 of 100')).toBeInTheDocument();
  });

  it('reports 0-0 for an empty result', () => {
    setup({pageIndex: 0, totalRows: 0});

    expect(screen.getByText('0-0 of 0')).toBeInTheDocument();
  });

  it('caps the end of the range at the total on a partial last page', () => {
    setup({pageIndex: 8, pageSize: 12, totalRows: 100});

    expect(screen.getByText('97-100 of 100')).toBeInTheDocument();
  });

  it('moves forward and back by one page', async () => {
    const user = userEvent.setup();
    const {onPageIndexChange} = setup();

    await user.click(screen.getByRole('button', {name: 'Next page'}));
    expect(onPageIndexChange).toHaveBeenCalledWith(2);

    await user.click(screen.getByRole('button', {name: 'Previous page'}));
    expect(onPageIndexChange).toHaveBeenCalledWith(0);
  });

  it('jumps to the first and last page', async () => {
    const user = userEvent.setup();
    const {onPageIndexChange} = setup();

    await user.click(screen.getByRole('button', {name: 'First page'}));
    expect(onPageIndexChange).toHaveBeenCalledWith(0);

    await user.click(screen.getByRole('button', {name: 'Last page'}));
    expect(onPageIndexChange).toHaveBeenCalledWith(8);
  });

  it('disables backward navigation on the first page', () => {
    setup({pageIndex: 0});

    expect(screen.getByRole('button', {name: 'First page'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Previous page'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Next page'})).toBeEnabled();
  });

  it('disables forward navigation on the last page', () => {
    setup({pageIndex: 8});

    expect(screen.getByRole('button', {name: 'Next page'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Last page'})).toBeDisabled();
  });

  it('disables everything when there are no rows', () => {
    setup({pageIndex: 0, totalRows: 0});

    for (const name of ['First page', 'Previous page', 'Next page', 'Last page']) {
      expect(screen.getByRole('button', {name})).toBeDisabled();
    }
  });

  it('reports a new page size as a number, not a string', async () => {
    const user = userEvent.setup();
    const {onPageSizeChange} = setup();

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', {name: '48'}));

    expect(onPageSizeChange).toHaveBeenCalledWith(48);
  });

  it('hides the page size control when asked', () => {
    setup({showRowsPerPage: false});

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('hides the first and last buttons when asked', () => {
    setup({showFirstLastButtons: false});

    expect(screen.queryByRole('button', {name: 'First page'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next page'})).toBeInTheDocument();
  });
});
```

The "no rows" case is a real bug in the app version: with `totalRows: 0` the page count is `0`, so `canNextPage` is `0 < -1`, false, and the buttons happen to disable correctly. Pin it before touching the arithmetic.

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm --filter @bohardlabs/admin-ui test ListPagination`
Expected: FAIL, module not found.

- [ ] **Step 3: Port the component**

Copy the app file and make four changes:

1. Every `t('dataTable.X', …)` becomes `labels.X(…)`. The three call sites map to `labels.totalItems(totalRows)`, `labels.itemsPerPage`, and `labels.rowsDisplayed(from, to, totalRows)`.
2. The four `aria-label` literals ("First page", and so on) become `labels.firstPage` / `previousPage` / `nextPage` / `lastPage`. Icon-only buttons whose accessible name is a hardcoded English string are exactly what the no-hardcoded-strings rule exists for.
3. `bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)'` becomes `bgcolor: 'action.hover'`. That token is already a low-alpha overlay that flips with the mode.
4. Icons import per-icon rather than from the barrel, which the app version already does.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @bohardlabs/admin-ui test ListPagination`
Expected: PASS, 11 tests.

- [ ] **Step 5: Export it**

```ts
export {ListPagination} from './ListPagination';
export type {ListPaginationProps} from './ListPagination';
```

- [ ] **Step 6: Hand off for commit**

```
feat(admin-ui): ListPagination
```

---

### Task 7: BrandedLoader

**Files:**

- Create: `packages/admin-ui/src/BrandedLoader.tsx`
- Test: `packages/admin-ui/src/BrandedLoader.test.tsx`
- Modify: `packages/admin-ui/src/index.ts`

**Interfaces:**

- Consumes: `useLabels` from Task 1.
- Produces: `<BrandedLoader logo? label? fullScreen? animate? />` and `BrandedLoaderProps`.

The app's `Loader` imports two Skipwash SVGs and renders the word "Skipwash". Both leave. What is worth keeping is the layout: a full-screen overlay or an in-flow block, a slot for a mark, a caption under it, and the drive-across animation that makes the wait feel deliberate.

- [ ] **Step 1: Write the failing test**

```tsx
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {BrandedLoader} from './BrandedLoader';

describe('BrandedLoader', () => {
  it('announces itself to assistive technology', () => {
    render(<BrandedLoader />);

    expect(screen.getByRole('status')).toHaveAccessibleName('Loading');
  });

  it('renders the label as visible text', () => {
    render(<BrandedLoader label="Acme" />);

    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  it('renders no caption when the label is empty', () => {
    render(<BrandedLoader label="" />);

    expect(screen.getByRole('status')).toHaveAccessibleName('Loading');
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });

  it('renders the logo node it is given', () => {
    render(<BrandedLoader logo={<svg data-testid="mark" />} />);

    expect(screen.getByTestId('mark')).toBeInTheDocument();
  });

  it('falls back to a spinner when given no logo', () => {
    render(<BrandedLoader />);

    expect(screen.getByRole('status').querySelector('.MuiCircularProgress-root')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm --filter @bohardlabs/admin-ui test BrandedLoader`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the component**

```tsx
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import {keyframes} from '@mui/material/styles';
import type {ReactNode} from 'react';

import {useLabels} from './i18n';

/** The mark travels left to right and repeats, like a vehicle crossing a window. */
const driveAcross = keyframes`
  0% { transform: translateX(-60px); }
  100% { transform: translateX(160px); }
`;

export interface BrandedLoaderProps {
  /**
   * The consumer's mark: an `<img>`, an inline `<svg>`, anything. Omit it and a plain
   * spinner appears instead, which is the right default for a package that has no brand.
   */
  readonly logo?: ReactNode;
  /** Caption under the mark. Pass an empty string for no caption. */
  readonly label?: string;
  readonly fullScreen?: boolean;
  /** Set false to hold the mark still, for a reduced-motion preference the app tracks. */
  readonly animate?: boolean;
}

/**
 * The whole-screen wait: a brand mark, a caption, and enough movement that the screen does
 * not read as broken.
 *
 * `role="status"` rather than a bare div, so a screen reader announces the wait once
 * instead of leaving the user on a silent page.
 */
export function BrandedLoader({logo, label, fullScreen = true, animate = true}: Readonly<BrandedLoaderProps>) {
  const labels = useLabels();
  const caption = label ?? labels.loading;

  return (
    <Box
      role="status"
      aria-label={labels.loading}
      aria-live="polite"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        minHeight: fullScreen ? '100vh' : '100%',
        bgcolor: 'background.default',
        ...(fullScreen && {position: 'fixed', inset: 0, zIndex: (theme) => theme.zIndex.modal + 1}),
      }}
    >
      <Box sx={{width: 160, height: 48, overflow: 'hidden', position: 'relative'}}>
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            display: 'flex',
            alignItems: 'center',
            height: 48,
            ...(animate && {animation: `${driveAcross} 2.5s linear infinite`}),
            ...(!animate && {left: '50%', transform: 'translateX(-50%)'}),
          }}
        >
          {logo ?? <CircularProgress size={40} />}
        </Box>
      </Box>
      {caption ? (
        <Typography sx={{fontWeight: 600, fontSize: '1.5rem', color: 'text.secondary', letterSpacing: '0.05em'}}>
          {caption}
        </Typography>
      ) : null}
    </Box>
  );
}
```

Two things changed from the app version beyond the de-branding. `zIndex: 9999` becomes `theme.zIndex.modal + 1`, so the loader sits above a consumer's dialogs rather than at a number chosen to beat one app's stack. And `aria-label` uses `labels.loading` rather than `caption`, so the announced name stays stable when a consumer passes their company name as the caption.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @bohardlabs/admin-ui test BrandedLoader`
Expected: PASS, 5 tests.

- [ ] **Step 5: Export it**

```ts
export {BrandedLoader} from './BrandedLoader';
export type {BrandedLoaderProps} from './BrandedLoader';
```

- [ ] **Step 6: Hand off for commit**

```
feat(admin-ui): BrandedLoader, de-branded from the app Loader
```

---

### Task 8: Stories

**Files:**

- Create: `packages/admin-ui/src/dialogs/Dialogs.stories.tsx`
- Create: `packages/admin-ui/src/PageHeader.stories.tsx`
- Create: `packages/admin-ui/src/ListPagination.stories.tsx`
- Create: `packages/admin-ui/src/BrandedLoader.stories.tsx`
- Modify: `apps/storybook/package.json`

**Interfaces:**

- Consumes: the full public surface from Tasks 2 through 7.
- Produces: stories the showcase picks up with no registration, every one with a `play`.

- [ ] **Step 1: Add the package to the showcase**

In `apps/storybook/package.json`, under `dependencies`:

```json
    "@bohardlabs/admin-ui": "workspace:*"
```

Then `pnpm install`. The `stories` glob in `.storybook/main.ts` already covers `../../../packages/*/src/**/*.stories.@(ts|tsx)`.

- [ ] **Step 2: Write the dialog stories**

One file for all five, each as its own export. Dialogs render into a portal, so every `play` queries `canvasElement.ownerDocument.body`, not the canvas.

```tsx
import Button from '@mui/material/Button';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {useState} from 'react';
import {expect, userEvent, within} from 'storybook/test';

import {ConfirmDialog} from './ConfirmDialog';
import {DeletionErrorDialog} from './DeletionErrorDialog';
import {SignOutDialog} from './SignOutDialog';
import {UnsavedChangesDialog} from './UnsavedChangesDialog';
import {WelcomeDialog} from './WelcomeDialog';

const meta = {
  title: 'Admin UI/Dialogs',
  parameters: {layout: 'centered'},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Confirm: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    const [done, setDone] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open</Button>
        {done && <p data-testid="done">confirmed</p>}
        <ConfirmDialog
          open={open}
          title="Delete building"
          message="This cannot be undone."
          confirmLabel="Delete"
          confirmColor="error"
          onClose={() => setOpen(false)}
          onConfirm={async () => {
            await new Promise((r) => setTimeout(r, 300));
            setDone(true);
            setOpen(false);
          }}
        />
      </>
    );
  },
  play: async ({canvasElement}) => {
    const body = within(canvasElement.ownerDocument.body);

    await userEvent.click(await body.findByRole('button', {name: 'Delete'}));
    // The dialog locks while the promise is in flight.
    await expect(body.getByRole('button', {name: 'Cancel'})).toBeDisabled();
    await expect(await body.findByTestId('done')).toBeVisible();
  },
};

export const UnsavedChanges: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return <UnsavedChangesDialog open={open} onDiscard={() => setOpen(false)} onCancel={() => setOpen(false)} />;
  },
  play: async ({canvasElement}) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('Discard changes?')).toBeVisible();
    await expect(body.getByRole('button', {name: 'Keep editing'})).toBeVisible();
  },
};

export const DeletionErrors: Story = {
  render: () => (
    <DeletionErrorDialog
      open
      title="Some items could not be deleted"
      successCount={3}
      errors={[
        {id: '1', name: 'Building A', reason: 'Has 3 active bookings'},
        {id: '2', name: 'Building B', reason: 'Referenced by route R-19'},
      ]}
      onClose={() => {}}
    />
  ),
  play: async ({canvasElement}) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('Successfully deleted 3 item(s)')).toBeVisible();
    await expect(body.getByText('Referenced by route R-19')).toBeVisible();
  },
};

export const SignOut: Story = {
  render: () => <SignOutDialog open onClose={() => {}} onConfirm={async () => {}} />,
  play: async ({canvasElement}) => {
    const body = within(canvasElement.ownerDocument.body);
    const all = await body.findByRole('checkbox', {name: 'Sign out of all sessions'});
    await expect(all).not.toBeChecked();
    await userEvent.click(all);
    await expect(all).toBeChecked();
  },
};

export const Welcome: Story = {
  render: () => <WelcomeDialog open onClose={() => {}} />,
  play: async ({canvasElement}) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole('button', {name: 'Get started'})).toBeVisible();
  },
};
```

- [ ] **Step 3: Write the other three story files**

`PageHeader.stories.tsx`: a `Default`, a `WithBadges` rendering two `Chip`s, and a `LongTitle` with `titleMaxLength={20}` whose `play` asserts the visible text is truncated while the heading's accessible name is not.

`ListPagination.stories.tsx`: a `Default` at `pageIndex: 1` of 100 rows whose `play` clicks Next and asserts the range text changes (hold `pageIndex` in `useState` in the render function so it actually does), an `Empty` at `totalRows: 0` whose `play` asserts all four buttons are disabled, and a `Minimal` with `showRowsPerPage={false} showFirstLastButtons={false}`.

`BrandedLoader.stories.tsx`: a `Default` (no logo, spinner fallback), a `WithLogo` passing an inline SVG, and a `Inline` with `fullScreen={false}`. Each `play` asserts `getByRole('status')` is present. Use `fullScreen={false}` in every story except one: a fixed full-screen overlay covers the Storybook chrome and makes the other stories awkward to look at.

- [ ] **Step 4: Run the story tests**

Run: `pnpm --filter @bohardlabs/storybook test`
Expected: PASS. Every story also runs axe, because `.storybook/preview.tsx` sets `parameters.a11y.test = 'error'`.

- [ ] **Step 5: Check both themes**

Run: `pnpm storybook`. Switch the theme toolbar between light and dark and look at all four story groups. The `alpha(error.main)` list background in `DeletionErrorDialog`, the `action.hover` bar in `ListPagination`, and the `background.default` field in `BrandedLoader` are the three places a hardcoded colour was replaced, so they are the three places to check.

- [ ] **Step 6: Hand off for commit**

```
feat(admin-ui): stories, interaction tests, a11y
```

---

### Task 9: README, changeset, and close the plan

**Files:**

- Create: `packages/admin-ui/README.md`
- Create: `.changeset/<generated-name>.md`
- Modify: `README.md` (the root package table)
- Modify: `docs/roadmap.md`
- Move: this file from `docs/superpowers/plans/open/` to `docs/superpowers/plans/done/`

- [ ] **Step 1: Write the package README**

Open with what the package is for: the small things every admin screen renders, extracted once so four apps stop keeping four copies. Then the peer table, then a section per component with its props table and a short example, then the labels contract with a worked `AdminUiLabelsProvider` wrapping an app.

Say the two things a reader will otherwise get wrong:

- `UnsavedChangesDialog` inverts the usual button roles. Its confirm is destructive.
- `BrandedLoader` renders a spinner if you pass no `logo`. That is a fallback, not the intended look.

- [ ] **Step 2: Add the row to the root README**

```
| `packages/admin-ui` | Dialogs, page headers, pagination and loaders for MUI admin screens | ported, not published |
```

- [ ] **Step 3: Write the changeset**

Run: `pnpm changeset`, select `@bohardlabs/admin-ui`, choose **minor**, and describe the surface rather than the move:

```
Initial release. Nine MUI components for admin screens: ConfirmDialog,
UnsavedChangesDialog, DeletionErrorDialog, SignOutDialog, WelcomeDialog, PageHeader,
TruncatedTextWithTooltip, ListPagination and BrandedLoader. Every string is overridable
through AdminUiLabelsProvider.
```

- [ ] **Step 4: Run the full gate**

Run: `pnpm validate:ci`
Expected: PASS.

- [ ] **Step 5: Close the plan**

```bash
mv docs/superpowers/plans/open/2026-08-28-admin-ui-kit-package.md \
   docs/superpowers/plans/done/2026-08-28-admin-ui-kit-package.md
```

In `docs/roadmap.md`, section "New packages": set the admin-ui row to `done (today's date)`, fix its link to `done/`, and change the form-kit and admin-shell rows from `blocked` to `ready`, since plan 2 no longer blocks them.

- [ ] **Step 6: Hand off for commit**

```
feat(admin-ui): README, changeset, first release prep
```

---

## Out of scope

**Adopting the package in the apps.** Same as plan 1: it needs the package published, which needs the npm org. When it lands, the app keeps a thin `Loader.tsx` that renders `<BrandedLoader logo={<img src={logo} />} label="Skipwash" />`, and deletes the other eight files.

**The other dialogs in the app.** `ForceDeleteDialog`, `ForceDeactivateWarningDialog` and `HolidayFormDialog` all carry domain types (`DeletionMode`, holiday shapes) and stay where they are. `StripeConnectDialogs` is a vendor integration and is not a candidate.

**A shared `Labels` package.** `@bohardlabs/datatable` and `@bohardlabs/admin-ui` both define `totalItems` and `itemsPerPage`, and a consumer using both translates them twice. That is annoying and it is still the right call: a shared labels package would make every string addition in either package a coordinated release of three.
