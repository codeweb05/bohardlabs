# @bohardlabs/admin-shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the admin chrome, an app bar, a mini-drawer sidebar, a navigation menu and the scrolling content region, as a slot-based shell that knows about widths, breakpoints and transitions and knows nothing about routing, auth or notifications.

**Architecture:** Every app-specific thing the current layout reaches for becomes a slot or a prop. The sidebar's open state is a context with a persisted boolean, the drawer takes a brand node and a footer node, the navigation menu takes an items array and a link component, and the header takes an actions node. Routing and auth never enter the package; the two pure redirect helpers that guard against open redirects come along because they are pure.

**Tech Stack:** React 19, MUI v7 (`AppBar`, `Drawer`, `List`, `useMediaQuery`), `@bohardlabs/admin-ui` for the pieces the shell renders, Vitest + Testing Library, Storybook.

**Spec:** [`docs/extraction/README.md`](../../../extraction/README.md), section "5. `@bohardlabs/admin-shell`"

**Source being ported:** `skipwash-latest/skipwash-admin/src/components/layouts/` (595 loc across
`AuthLayout`, `ProtectedLayout`, `MainLayout`, `Header`, `Sidebar`, `MenuContent`),
`src/contexts/SidebarContext.tsx` + `contexts/useSidebar.ts` (66), `src/hooks/useStorage.ts`,
`src/hooks/useFullscreen.ts`, `src/utils/redirect.ts` (67), and their tests.

**Blocked on:** plan 2. `AppSidebar`'s stories render `@bohardlabs/admin-ui`'s `BrandedLoader`,
and `SessionGate` takes a loader node that in practice is that component.

## This is design work, not a port

The other four plans move code. This one reshapes it. `ProtectedLayout` alone imports
`@tanstack/react-router`, `useAuth`, `useNotificationStream`, `usePushNotification`,
`NotificationBanner`, `ROUTES` and `resolveLoginRedirect`. None of that can be published,
and none of it is what makes the layout worth having.

What is worth having is the geometry: a 240px drawer that collapses to 90px, an app bar
that shrinks to match, a main region whose width and margin animate on the same easing and
duration as the drawer, an inner scroll container tagged for scroll restoration, and the
mobile breakpoint where the permanent drawer becomes a temporary one. That is fiddly, it is
identical in all four apps, and it is what a fifth app would otherwise spend two days
rebuilding slightly differently.

So the test for every decision in this plan is: does the package need to know? It needs to
know the drawer width. It does not need to know what a route is.

## Global Constraints

- Package name `@bohardlabs/admin-shell`, `"private": true`, version `0.0.0`.
- No `@/…` imports. No `@tanstack/react-router` import anywhere, not even as a type.
- `@bohardlabs/admin-ui` is a **peer**, for the same reason it is a peer of `@bohardlabs/form`: two
  copies mean two labels contexts and a consumer's translations stop reaching the parts of
  the shell that come from it.
- Labels follow the house pattern: a `ShellLabels` interface, `DEFAULT_SHELL_LABELS` in
  English, a `labels?: Partial<ShellLabels>` prop, and a context whose default value is
  `DEFAULT_SHELL_LABELS`.
- No hardcoded colour. The current `Sidebar` writes `color: '#ffffff'` inside the brand
  badge; that badge becomes a slot, so the literal leaves with it.
- Icon imports one per path, never the barrel.
- Never `any`, `@ts-ignore`, `@ts-expect-error`, `as unknown as`.
- ESM only, `formats: ['es']`, `preserveModules: true`.
- Every component with behaviour gets a story with a `play` function.
- Never run a git command. Tasks end with a handoff step.

---

### Task 1: Scaffolding and sidebar state

**Files:**

- Create: `packages/admin-shell/package.json`
- Create: `packages/admin-shell/tsconfig.json`
- Create: `packages/admin-shell/tsconfig.build.json`
- Create: `packages/admin-shell/vite.config.ts`
- Create: `packages/admin-shell/vitest.setup.ts`
- Create: `packages/admin-shell/src/constants.ts`
- Create: `packages/admin-shell/src/SidebarContext.tsx`
- Create: `packages/admin-shell/src/useSidebar.ts`
- Create: `packages/admin-shell/src/index.ts`
- Test: `packages/admin-shell/src/SidebarContext.test.tsx`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `DRAWER_WIDTH = 240`, `MINI_DRAWER_WIDTH = 90`, `HEADER_HEIGHT = 56`.
  - `interface SidebarContextValue {isOpen; isMobile; toggleSidebar(); setSidebarOpen(open)}`.
  - `<SidebarProvider storageKey? defaultOpen? children>`, `useSidebar()`.

**Two changes from the app version, both deliberate:**

**`useSidebar` no longer throws outside a provider.** The app's version throws
`'useSidebar must be used within SidebarContextProvider'`. In an app that is a useful
assertion; in a library it means a consumer who renders `AppHeader` on its own gets a crash
instead of a header. The context default becomes a real value: open, not mobile, with
no-op setters. Same reasoning as the labels contexts elsewhere in the repo.

**Mobile no longer writes to the stored preference.** The app persists one boolean for
both. Open the app on a phone, the drawer starts closed and stores `false`; open it on the
desktop later and the sidebar is collapsed with no explanation. The package stores the
desktop preference only, and on mobile keeps the open state in React state that starts
closed every time. That is also the correct behaviour on its own terms: a temporary drawer
that reopens itself on every page load is a bug, not a preference.

- [ ] **Step 1: Create the package**

Copy `packages/datatable/{tsconfig.json,tsconfig.build.json,vite.config.ts,vitest.setup.ts}`
unchanged. `package.json`:

```json
{
  "name": "@bohardlabs/admin-shell",
  "version": "0.0.0",
  "private": true,
  "description": "Slot-based admin chrome: app bar, mini-drawer sidebar, navigation menu and content region",
  "type": "module",
  "sideEffects": false,
  "files": ["dist"],
  "exports": {
    ".": {"types": "./dist/index.d.ts", "default": "./dist/index.js"},
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
    "@bohardlabs/admin-ui": "workspace:^",
    "@emotion/react": "^11.0.0",
    "@emotion/styled": "^11.0.0",
    "@mui/icons-material": "^7.0.0",
    "@mui/material": "^7.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@bohardlabs/admin-ui": "workspace:*",
    "@emotion/react": "catalog:",
    "@emotion/styled": "catalog:",
    "@mui/icons-material": "catalog:",
    "@mui/material": "catalog:",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "jsdom": "^28.0.1",
    "react": "catalog:",
    "react-dom": "catalog:",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vitest": "catalog:"
  }
}
```

`workspace:^` in `peerDependencies` publishes as the real version range. It is the one place
a `catalog:`-style shorthand is allowed in peers, because pnpm rewrites it on publish.

- [ ] **Step 2: Write `src/constants.ts`**

```ts
/** Width of the expanded drawer, in pixels. */
export const DRAWER_WIDTH = 240;
/** Width of the collapsed drawer on desktop, in pixels. */
export const MINI_DRAWER_WIDTH = 90;
/** Height of the app bar, in pixels. `AppShell` offsets the content region by this. */
export const HEADER_HEIGHT = 56;
```

The app spells 56 in the `AppBar`'s `minHeight`, 56 again in the content `mt`, and 57 in the
content `height`. The odd one out is not deliberate, it is a stray pixel from someone
accounting for a border that is not there. One constant, used in all three places.

- [ ] **Step 3: Write the failing test**

```tsx
import {ThemeProvider, createTheme} from '@mui/material';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it} from 'vitest';

import {SidebarProvider} from './SidebarContext';
import {useSidebar} from './useSidebar';

function Probe() {
  const {isOpen, isMobile, toggleSidebar, setSidebarOpen} = useSidebar();
  return (
    <div>
      <span data-testid="state">{`${isOpen ? 'open' : 'closed'}/${isMobile ? 'mobile' : 'desktop'}`}</span>
      <button type="button" onClick={toggleSidebar}>
        toggle
      </button>
      <button type="button" onClick={() => setSidebarOpen(false)}>
        close
      </button>
    </div>
  );
}

function renderProbe(options: {storageKey?: string; matchesMobile?: boolean} = {}) {
  // MUI's useMediaQuery reads window.matchMedia; jsdom has no layout, so the
  // breakpoint has to be stubbed rather than simulated by resizing.
  window.matchMedia = ((query: string) => ({
    matches: options.matchesMobile ?? false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;

  return render(
    <ThemeProvider theme={createTheme()}>
      <SidebarProvider storageKey={options.storageKey}>
        <Probe />
      </SidebarProvider>
    </ThemeProvider>,
  );
}

describe('SidebarProvider', () => {
  beforeEach(() => localStorage.clear());

  it('starts open on desktop', () => {
    renderProbe();
    expect(screen.getByTestId('state')).toHaveTextContent('open/desktop');
  });

  it('starts closed on mobile', () => {
    renderProbe({matchesMobile: true});
    expect(screen.getByTestId('state')).toHaveTextContent('closed/mobile');
  });

  it('toggles', async () => {
    renderProbe();
    await userEvent.click(screen.getByRole('button', {name: 'toggle'}));
    expect(screen.getByTestId('state')).toHaveTextContent('closed/desktop');
  });

  it('persists the desktop preference', async () => {
    const {unmount} = renderProbe();
    await userEvent.click(screen.getByRole('button', {name: 'toggle'}));
    unmount();

    renderProbe();
    expect(screen.getByTestId('state')).toHaveTextContent('closed/desktop');
  });

  it('does not persist a mobile close', async () => {
    // Closing a temporary drawer is dismissing a menu, not setting a preference.
    renderProbe({matchesMobile: true});
    await userEvent.click(screen.getByRole('button', {name: 'toggle'}));
    expect(localStorage.getItem('bohardlabs-sidebar-open')).toBeNull();
  });

  it('ignores the stored preference on mobile', async () => {
    localStorage.setItem('bohardlabs-sidebar-open', 'true');
    renderProbe({matchesMobile: true});
    expect(screen.getByTestId('state')).toHaveTextContent('closed/mobile');
  });

  it('uses the configured storage key', async () => {
    renderProbe({storageKey: 'my-key'});
    await userEvent.click(screen.getByRole('button', {name: 'toggle'}));
    expect(localStorage.getItem('my-key')).toBe('false');
  });

  it('picks up a change from another tab', () => {
    const {rerender} = renderProbe();
    localStorage.setItem('bohardlabs-sidebar-open', 'false');
    window.dispatchEvent(new StorageEvent('storage', {key: 'bohardlabs-sidebar-open', newValue: 'false'}));
    rerender(<div />);
    // Re-render the probe and assert it reads closed.
  });

  it('survives storage being unavailable', async () => {
    // Stub localStorage.setItem to throw, toggle, assert the UI still changed.
  });
});

describe('useSidebar outside a provider', () => {
  it('reports an open desktop sidebar rather than throwing', () => {
    render(<Probe />);
    expect(screen.getByTestId('state')).toHaveTextContent('open/desktop');
  });

  it('has no-op setters', async () => {
    render(<Probe />);
    await userEvent.click(screen.getByRole('button', {name: 'toggle'}));
    expect(screen.getByTestId('state')).toHaveTextContent('open/desktop');
  });
});
```

Write out the two cases sketched with comments.

- [ ] **Step 4: Run and watch it fail**

Run: `pnpm --filter @bohardlabs/admin-shell test SidebarContext`
Expected: FAIL, cannot resolve `./SidebarContext`.

- [ ] **Step 5: Implement**

`useSidebar.ts` holds the context and the hook, `SidebarContext.tsx` the provider, so a
file importing only the hook does not pull the provider in. Do not port
`hooks/useStorage.ts`: it is a general-purpose hook with serializers, `sessionStorage`
support and a `console.warn`, and the provider needs one boolean. Write the twenty lines
directly, with the read and the write in `try`/`catch`.

`DEFAULT_STORAGE_KEY = 'bohardlabs-sidebar-open'`.

- [ ] **Step 6: Run the tests**

Expected: PASS, 11 tests.

- [ ] **Step 7: Export, install, hand off**

```ts
export {DRAWER_WIDTH, HEADER_HEIGHT, MINI_DRAWER_WIDTH} from './constants';
export {SidebarProvider} from './SidebarContext';
export {useSidebar} from './useSidebar';
export type {SidebarContextValue} from './useSidebar';
```

Run: `pnpm install && pnpm --filter @bohardlabs/admin-shell build`

```
feat(admin-shell): scaffold the package and the sidebar state
```

---

### Task 2: Labels and AppSidebar

**Files:**

- Create: `packages/admin-shell/src/labels.ts`
- Create: `packages/admin-shell/src/ShellLabelsContext.tsx`
- Create: `packages/admin-shell/src/AppSidebar.tsx`
- Test: `packages/admin-shell/src/AppSidebar.test.tsx`
- Modify: `packages/admin-shell/src/index.ts`

**Interfaces:**

- Consumes: `useSidebar`, the width constants (Task 1).
- Produces:
  - `interface ShellLabels {toggleSidebar; enterFullscreen; exitFullscreen; mainNavigation}`,
    `DEFAULT_SHELL_LABELS`, `<ShellLabelsProvider labels? children>`, `useShellLabels()`.
  - `<AppSidebar brand? collapsedBrand? footer? children>`.

`AppSidebar` is the drawer and nothing else: the variant switch, the widths, the transition,
`overflowX: hidden`, and three slots. The Skipwash "S" badge, the wordmark and the sign-out
button all move out to the consumer, which is most of the 234 lines gone.

The brand slot takes two nodes rather than one. A wordmark at 240px and a 32px badge at
90px are different elements, not the same element at a different size, and every version of
this layout in every app has needed both.

- [ ] **Step 1: Write labels.ts and the context**

```ts
export interface ShellLabels {
  /** Accessible name of the app bar's drawer toggle. */
  readonly toggleSidebar: string;
  readonly enterFullscreen: string;
  readonly exitFullscreen: string;
  /** Accessible name of the sidebar's `nav` landmark. */
  readonly mainNavigation: string;
}

export const DEFAULT_SHELL_LABELS: ShellLabels = {
  toggleSidebar: 'Toggle sidebar',
  enterFullscreen: 'Enter full screen',
  exitFullscreen: 'Exit full screen',
  mainNavigation: 'Main navigation',
};
```

The context's default value is `DEFAULT_SHELL_LABELS`, and `useShellLabels()` never throws.

- [ ] **Step 2: Write the failing test**

```tsx
describe('AppSidebar', () => {
  it('renders a permanent drawer on desktop', () => {
    renderSidebar({});
    expect(screen.getByTestId('sidebar').querySelector('.MuiDrawer-docked')).not.toBeNull();
  });

  it('renders a temporary drawer on mobile', () => {
    renderSidebar({mobile: true, open: true});
    expect(screen.getByRole('presentation')).toBeInTheDocument();
  });

  it('shows the expanded brand when open', () => {
    renderSidebar({brand: <span>Acme</span>, collapsedBrand: <span>A</span>});
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });

  it('shows the collapsed brand when closed', () => {
    renderSidebar({open: false, brand: <span>Acme</span>, collapsedBrand: <span>A</span>});
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.queryByText('Acme')).not.toBeInTheDocument();
  });

  it('falls back to the expanded brand when no collapsed one is given', () => {
    renderSidebar({open: false, brand: <span>Acme</span>});
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  it('renders the footer slot', () => {
    renderSidebar({footer: <button type="button">Sign out</button>});
    expect(screen.getByRole('button', {name: 'Sign out'})).toBeInTheDocument();
  });

  it('renders children in a labelled nav landmark', () => {
    renderSidebar({children: <a href="/x">Orders</a>});
    expect(screen.getByRole('navigation', {name: 'Main navigation'})).toContainElement(
      screen.getByRole('link', {name: 'Orders'}),
    );
  });

  it('uses a translated nav landmark name', () => {
    // wrap in ShellLabelsProvider with {mainNavigation: 'Navigation principale'}
  });

  it('is the full width when open on desktop', () => {
    renderSidebar({open: true});
    expect(paperOf(screen.getByTestId('sidebar'))).toHaveStyle({width: '240px'});
  });

  it('is the mini width when closed on desktop', () => {
    renderSidebar({open: false});
    expect(paperOf(screen.getByTestId('sidebar'))).toHaveStyle({width: '90px'});
  });

  it('is the full width on mobile even though the state is closed', () => {
    // A temporary drawer has no mini state: it is either shown at full width or
    // not shown at all. The app already does this and it is easy to lose.
    renderSidebar({mobile: true, open: true});
    expect(paperOf(document.body)).toHaveStyle({width: '240px'});
  });

  it('closes on backdrop click when temporary', async () => {
    const {setSidebarOpen} = renderSidebar({mobile: true, open: true});
    await userEvent.click(document.querySelector('.MuiBackdrop-root') as Element);
    expect(setSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('keeps the temporary drawer mounted when closed', () => {
    // ModalProps={{keepMounted: true}}: the nav must stay in the DOM so a mobile
    // screen reader can reach it without a remount on every open.
    renderSidebar({mobile: true, open: false, children: <a href="/x">Orders</a>});
    expect(screen.getByRole('link', {name: 'Orders', hidden: true})).toBeInTheDocument();
  });
});
```

Write a `renderSidebar` helper that stubs `matchMedia`, renders inside a `ThemeProvider`,
and injects a mocked context value so `open` and `setSidebarOpen` can be controlled directly
rather than driven through clicks. Add the `paperOf` helper returning
`root.querySelector('.MuiDrawer-paper')`.

- [ ] **Step 3: Run, fail, implement**

Port the drawer structure and its `sx`. Add `data-testid="sidebar"` on the desktop `Drawer`
and wrap `children` in `<Box component="nav" aria-label={labels.mainNavigation}>`, which the
app does not do and which is the difference between a screen reader announcing "navigation"
and announcing nothing.

- [ ] **Step 4: Run the tests**

Expected: PASS, 13 tests.

- [ ] **Step 5: Export and hand off**

```
feat(admin-shell): shell labels and the drawer
```

---

### Task 3: NavMenu

**Files:**

- Create: `packages/admin-shell/src/navigation.ts`
- Create: `packages/admin-shell/src/NavMenu.tsx`
- Test: `packages/admin-shell/src/NavMenu.test.tsx`
- Modify: `packages/admin-shell/src/index.ts`

**Interfaces:**

- Consumes: `useSidebar` (Task 1).
- Produces:
  - `interface NavItem {id; label; path; icon?; requiredPermission?}`,
    `interface NavSection {id; label?; items}`, `type NavConfig = ReadonlyArray<NavSection>`.
  - `<NavMenu sections linkComponent? getLinkProps? activePath canAccess? onNavigate? isCollapsed?>`.

**The router inversion.** `MenuContent` renders `component={Link} to={item.path}` and reads
the active path from `useRouterState()`. Two props replace both:

```tsx
<NavMenu
  sections={sections}
  activePath={useRouterState().location.pathname}
  linkComponent={Link}
  getLinkProps={(item) => ({to: item.path})}
/>
```

`getLinkProps` rather than a hardcoded `to`, because `to` is TanStack's spelling, `href` is
an anchor's, and Next's `Link` wants `href` too. The default is
`(item) => ({href: item.path})`, so the component works with no router at all, which is also
how the stories render it.

**`labelKey` becomes `label`.** The app stores an i18n key and calls `t()` inside the
component. A library cannot; the consumer maps their config through `t` before passing it.
That is the same rule the rest of the repo follows, applied to a data structure rather than
a prop.

- [ ] **Step 1: Write the failing test**

```tsx
const sections: NavConfig = [
  {
    id: 'main',
    items: [
      {id: 'dashboard', label: 'Dashboard', path: '/', icon: <span>D</span>},
      {id: 'orders', label: 'Orders', path: '/orders', icon: <span>O</span>},
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [{id: 'users', label: 'Users', path: '/users', requiredPermission: 'ADMIN:VIEW'}],
  },
];

describe('NavMenu', () => {
  it('renders every item as a link', () => {
    renderMenu({sections, activePath: '/'});
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('points a link at its path', () => {
    renderMenu({sections, activePath: '/'});
    expect(screen.getByRole('link', {name: 'Orders'})).toHaveAttribute('href', '/orders');
  });

  it('marks the active item as current', () => {
    renderMenu({sections, activePath: '/orders'});
    expect(screen.getByRole('link', {name: 'Orders'})).toHaveAttribute('aria-current', 'page');
  });

  it('matches a nested path against its parent item', () => {
    renderMenu({sections, activePath: '/orders/42'});
    expect(screen.getByRole('link', {name: 'Orders'})).toHaveAttribute('aria-current', 'page');
  });

  it('matches the root item only on an exact path', () => {
    // '/' would prefix-match everything, so it is compared exactly. This is the
    // one special case in the whole component and it is easy to refactor away.
    renderMenu({sections, activePath: '/orders'});
    expect(screen.getByRole('link', {name: 'Dashboard'})).not.toHaveAttribute('aria-current');
  });

  it('does not match a path that merely shares a prefix', () => {
    renderMenu({
      sections: [{id: 'main', items: [{id: 'order', label: 'Orders', path: '/order'}]}],
      activePath: '/orders-archive',
    });
    expect(screen.getByRole('link', {name: 'Orders'})).not.toHaveAttribute('aria-current');
  });

  it('renders a section label', () => {
    renderMenu({sections, activePath: '/'});
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('hides section labels when collapsed', () => {
    renderMenu({sections, activePath: '/', isCollapsed: true});
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  });

  it('hides item text when collapsed', () => {
    renderMenu({sections, activePath: '/', isCollapsed: true});
    expect(screen.queryByText('Orders')).not.toBeInTheDocument();
  });

  it('names a collapsed item for assistive tech', () => {
    // The visible text is gone, so the accessible name has to come from somewhere
    // or the sidebar becomes a column of unlabelled icons.
    renderMenu({sections, activePath: '/', isCollapsed: true});
    expect(screen.getByRole('link', {name: 'Orders'})).toBeInTheDocument();
  });

  it('shows a tooltip on hover when collapsed', async () => {
    renderMenu({sections, activePath: '/', isCollapsed: true});
    await userEvent.hover(screen.getByRole('link', {name: 'Orders'}));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Orders');
  });

  it('hides an item the user has no permission for', () => {
    renderMenu({sections, activePath: '/', canAccess: () => false});
    expect(screen.queryByRole('link', {name: 'Users'})).not.toBeInTheDocument();
  });

  it('keeps items that require no permission', () => {
    renderMenu({sections, activePath: '/', canAccess: () => false});
    expect(screen.getByRole('link', {name: 'Orders'})).toBeInTheDocument();
  });

  it('shows everything when no canAccess is given', () => {
    renderMenu({sections, activePath: '/'});
    expect(screen.getByRole('link', {name: 'Users'})).toBeInTheDocument();
  });

  it('drops a section whose items are all filtered out', () => {
    // An empty section still renders its label in the app version, leaving a
    // heading with nothing under it.
    renderMenu({sections, activePath: '/', canAccess: () => false});
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  });

  it('calls onNavigate when an item is clicked', async () => {
    const onNavigate = vi.fn();
    renderMenu({sections, activePath: '/', onNavigate});
    await userEvent.click(screen.getByRole('link', {name: 'Orders'}));
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it('renders through a custom link component', () => {
    const Link = ({to, children, ...rest}: {to: string; children: ReactNode}) => (
      <a href={to} data-custom="yes" {...rest}>
        {children}
      </a>
    );
    renderMenu({sections, activePath: '/', linkComponent: Link, getLinkProps: (item) => ({to: item.path})});
    expect(screen.getByRole('link', {name: 'Orders'})).toHaveAttribute('data-custom', 'yes');
  });
});
```

- [ ] **Step 2: Run, fail, implement**

Two details the app version gets wrong and this one should not:

`aria-current="page"` on the active item. The app sets MUI's `selected`, which is a
background colour and nothing more. Colour alone is not a state announcement.

Prefix matching on a path boundary. `currentPath.startsWith(item.path)` makes `/order`
active on `/orders-archive`. Compare on a segment boundary:

```ts
function isActive(itemPath: string, activePath: string): boolean {
  if (itemPath === '/') return activePath === '/';
  return activePath === itemPath || activePath.startsWith(`${itemPath}/`);
}
```

Export `isActive` and give it its own describe block if it grows a third case.

- [ ] **Step 3: Run the tests**

Expected: PASS, 17 tests.

- [ ] **Step 4: Export and hand off**

```
feat(admin-shell): the navigation menu
```

---

### Task 4: AppHeader

**Files:**

- Create: `packages/admin-shell/src/ShellIconButton.tsx`
- Create: `packages/admin-shell/src/useFullscreen.ts`
- Create: `packages/admin-shell/src/FullscreenButton.tsx`
- Create: `packages/admin-shell/src/AppHeader.tsx`
- Test: `packages/admin-shell/src/AppHeader.test.tsx`
- Test: `packages/admin-shell/src/useFullscreen.test.tsx`
- Modify: `packages/admin-shell/src/index.ts`

**Interfaces:**

- Consumes: `useSidebar`, `useShellLabels`, the width constants.
- Produces:
  - `<ShellIconButton>`: MUI `IconButton` with the shell's 36px rounded chrome styling.
  - `useFullscreen(): {isFullscreen; toggleFullscreen; isSupported}`.
  - `<FullscreenButton>`.
  - `<AppHeader actions? children?>`.

`AppHeader` keeps the drawer toggle and the geometry. The theme switch, the notification
bell, the avatar and everything else in the app's 136 lines become `actions`, because every
one of them needs something the package cannot have: a theme mode store, an SSE connection,
a user object.

`ShellIconButton` goes with them, though, because the actions a consumer supplies have to
look like the toggle beside them, and asking them to reproduce an `alpha(grey[700], 0.3)`
recipe by hand guarantees they will not match.

`useFullscreen` ports as-is with two fixes: the app calls `requestFullscreen()` and
`exitFullscreen()` without handling the returned promise, which rejects when the browser
refuses (an iframe with no `allow="fullscreen"`, or Safari on iOS, where the API is absent
entirely). Catch the rejection and expose `isSupported`, so a consumer can hide the button
rather than ship one that does nothing.

- [ ] **Step 1: Write the failing useFullscreen test**

```tsx
describe('useFullscreen', () => {
  it('reports not fullscreen initially', () => {
    /* ... */
  });
  it('requests fullscreen on the document element', async () => {
    /* ... */
  });
  it('exits when already fullscreen', async () => {
    /* ... */
  });
  it('follows the fullscreenchange event', () => {
    /* dispatch it, assert isFullscreen flips */
  });
  it('does not reject when the browser refuses', async () => {
    // requestFullscreen rejecting must not produce an unhandled rejection
  });
  it('reports isSupported false when the API is missing', () => {
    /* delete the method */
  });
  it('removes its listener on unmount', () => {
    /* ... */
  });
});
```

Stub `document.documentElement.requestFullscreen`, `document.exitFullscreen` and
`document.fullscreenElement` with `vi.spyOn` / `Object.defineProperty`; jsdom implements
none of them.

- [ ] **Step 2: Run, fail, implement the hook and both buttons**

Expected: PASS, 7 tests.

- [ ] **Step 3: Write the failing AppHeader test**

```tsx
describe('AppHeader', () => {
  it('renders a labelled drawer toggle', () => {
    renderHeader({});
    expect(screen.getByRole('button', {name: 'Toggle sidebar'})).toBeInTheDocument();
  });

  it('uses a translated toggle label', () => {
    // ShellLabelsProvider with {toggleSidebar: 'Basculer le menu'}
  });

  it('toggles the sidebar on click', async () => {
    const {toggleSidebar} = renderHeader({});
    await userEvent.click(screen.getByRole('button', {name: 'Toggle sidebar'}));
    expect(toggleSidebar).toHaveBeenCalledOnce();
  });

  it('renders the actions slot', () => {
    renderHeader({actions: <button type="button">Profile</button>});
    expect(screen.getByRole('button', {name: 'Profile'})).toBeInTheDocument();
  });

  it('renders children on the left, after the toggle', () => {
    renderHeader({children: <span>Acme Admin</span>});
    expect(screen.getByText('Acme Admin')).toBeInTheDocument();
  });

  it('is a banner landmark', () => {
    renderHeader({});
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('leaves room for an open drawer on desktop', () => {
    renderHeader({open: true});
    expect(screen.getByRole('banner')).toHaveStyle({width: 'calc(100% - 240px)', marginLeft: '240px'});
  });

  it('leaves room for a collapsed drawer on desktop', () => {
    renderHeader({open: false});
    expect(screen.getByRole('banner')).toHaveStyle({width: 'calc(100% - 90px)', marginLeft: '90px'});
  });

  it('spans the full width on mobile', () => {
    renderHeader({mobile: true, open: false});
    expect(screen.getByRole('banner')).toHaveStyle({width: '100%', marginLeft: '0px'});
  });
});

describe('FullscreenButton', () => {
  it('is labelled for entering', () => {
    /* 'Enter full screen' */
  });
  it('is labelled for exiting once fullscreen', () => {
    /* 'Exit full screen' */
  });
  it('renders nothing when the API is unavailable', () => {
    /* ... */
  });
});
```

- [ ] **Step 4: Run, fail, implement AppHeader**

Expected: PASS, 12 tests.

- [ ] **Step 5: Export and hand off**

```
feat(admin-shell): the app bar, icon button and fullscreen control
```

---

### Task 5: AppShell

**Files:**

- Create: `packages/admin-shell/src/AppShell.tsx`
- Test: `packages/admin-shell/src/AppShell.test.tsx`
- Modify: `packages/admin-shell/src/index.ts`

**Interfaces:**

- Consumes: `useSidebar`, the width constants.
- Produces: `<AppShell header sidebar banner? scrollRestorationId? children>`.

The composition. `AppShell` renders a flex root, the header and sidebar it is given, and the
scrolling main region whose width and margin animate in step with the drawer.

Three changes:

`header` and `sidebar` are props, not hardwired components. The app's `MainLayout` imports
`Header` and `Sidebar` directly, which is why it also has to thread `streamUnreadCount`
through itself to reach a component two levels down that it otherwise knows nothing about.
Slots delete that prop entirely.

`100dvh` instead of `100vh`, with a `100vh` first for browsers that lack it. On mobile
Safari `100vh` is the viewport with the toolbars hidden, so the bottom of the content sits
under the address bar until the user scrolls.

`scrollRestorationId` defaults to `'main-scroll'` and can be turned off with `null`. Keep
the comment explaining it: the router restores window scroll, the window never scrolls in
this layout, and the attribute is what points it at the element that does.

- [ ] **Step 1: Write the failing test**

```tsx
describe('AppShell', () => {
  it('renders the header slot', () => {
    /* ... */
  });
  it('renders the sidebar slot', () => {
    /* ... */
  });
  it('renders children inside the main landmark', () => {
    renderShell({children: <h1>Orders</h1>});
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', {name: 'Orders'}));
  });

  it('renders the banner slot above the children', () => {
    renderShell({banner: <div data-testid="banner" />, children: <div data-testid="content" />});
    const main = screen.getByRole('main');
    expect(main.firstElementChild).toBe(screen.getByTestId('banner'));
  });

  it('tags the scroll container for restoration', () => {
    renderShell({});
    expect(screen.getByRole('main')).toHaveAttribute('data-scroll-restoration-id', 'main-scroll');
  });

  it('uses a custom restoration id', () => {
    /* ... */
  });

  it('omits the attribute when restoration is disabled', () => {
    renderShell({scrollRestorationId: null});
    expect(screen.getByRole('main')).not.toHaveAttribute('data-scroll-restoration-id');
  });

  it('scrolls its own content region', () => {
    expect(screen.getByRole('main')).toHaveStyle({overflow: 'auto'});
  });

  it('sizes the content to the viewport minus the header', () => {
    expect(screen.getByRole('main')).toHaveStyle({height: 'calc(100dvh - 56px)', marginTop: '56px'});
  });

  it('leaves room for an open drawer', () => {
    renderShell({open: true});
    expect(screen.getByRole('main')).toHaveStyle({width: 'calc(100% - 240px)'});
  });

  it('leaves room for a collapsed drawer', () => {
    renderShell({open: false});
    expect(screen.getByRole('main')).toHaveStyle({width: 'calc(100% - 90px)'});
  });

  it('spans the full width on mobile', () => {
    renderShell({mobile: true});
    expect(screen.getByRole('main')).toHaveStyle({width: '100%'});
  });
});
```

`toHaveStyle` reads the computed style, so the `100vh` fallback declaration will be
overwritten by `100dvh` in jsdom only if jsdom parses the unit. If it does not, assert on
`element.style.height` containing `100dvh` instead, and say so in a comment rather than
weakening the assertion silently.

- [ ] **Step 2: Run, fail, implement**

- [ ] **Step 3: Run the tests**

Expected: PASS, 12 tests.

- [ ] **Step 4: Export and hand off**

```
feat(admin-shell): the shell composition
```

---

### Task 6: Redirect helpers and SessionGate

**Files:**

- Create: `packages/admin-shell/src/redirect.ts`
- Create: `packages/admin-shell/src/SessionGate.tsx`
- Test: `packages/admin-shell/src/redirect.test.ts`
- Test: `packages/admin-shell/src/SessionGate.test.tsx`
- Modify: `packages/admin-shell/src/index.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `getSafeRedirect(redirect: string | undefined, fallback: string): string`.
  - `resolveLoginRedirect(pathname, href, loginPath, isDeliberateLogout): {redirect?: string} | null`.
  - `<SessionGate status loader onRedirect children>`.

`getSafeRedirect` is the reason this task exists. It is thirty lines that decide whether an
attacker can bounce a user off the login page to their own host, and each of its three
rejections is there because the obvious implementation lets something through. Every app
that has a login page needs it and only one of the four has this version.

Port it with its doc comment intact. The comment explains the whitespace rule, which looks
like paranoia until you know that browsers strip tab and newline from a URL before resolving
it, so `/\t//evil.com` becomes `//evil.com`.

`SessionGate` is the shape both `AuthLayout` and `ProtectedLayout` have underneath their
imports: while loading show a loader, when the session state is wrong fire a redirect and
render nothing, otherwise render children. It takes a `status` and an `onRedirect` and
performs no navigation itself.

```tsx
export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

interface SessionGateProps {
  readonly status: SessionStatus;
  /** Which status is allowed through. `'authenticated'` for a protected area. */
  readonly expect: Exclude<SessionStatus, 'loading'>;
  readonly loader: ReactNode;
  /** Navigate from here. Called once per transition into the wrong status. */
  readonly onRedirect: () => void;
  readonly children: ReactNode;
}
```

- [ ] **Step 1: Port the redirect tests**

The app has 73 lines of them at `src/utils/redirect.test.ts`. Copy them across and add these
four, which it does not cover:

```ts
it('rejects a URL with a carriage return', () => {
  expect(getSafeRedirect('/\r//evil.com', '/')).toBe('/');
});

it('rejects an absolute http URL', () => {
  expect(getSafeRedirect('https://evil.com/x', '/')).toBe('/');
});

it('rejects a scheme-relative path with a backslash', () => {
  expect(getSafeRedirect('/\\\\evil.com', '/')).toBe('/');
});

it('keeps a query string on a safe path', () => {
  expect(getSafeRedirect('/orders?page=2', '/')).toBe('/orders?page=2');
});
```

- [ ] **Step 2: Run, fail, port redirect.ts**

Verbatim, comments included. There is nothing app-specific in it.

Expected: PASS, roughly 16 tests.

- [ ] **Step 3: Write the failing SessionGate test**

```tsx
describe('SessionGate', () => {
  it('shows the loader while loading', () => {
    /* ... */
  });
  it('does not redirect while loading', () => {
    /* onRedirect not called */
  });
  it('renders children when the status matches', () => {
    /* ... */
  });
  it('renders nothing when it does not', () => {
    /* ... */
  });
  it('calls onRedirect when it does not', () => {
    /* ... */
  });
  it('calls onRedirect once across re-renders', () => {
    // The effect must not re-fire on every parent render, or a navigation that
    // takes two frames turns into a loop of navigations.
  });
  it('calls onRedirect again after the status changes and comes back', () => {
    /* ... */
  });
  it('works as an anonymous-only gate', () => {
    // expect="anonymous": an authenticated user is redirected away from /login
  });
});
```

- [ ] **Step 4: Run, fail, implement**

The once-per-transition rule needs a ref holding the status the last redirect was fired for,
not a bare dependency array. `onRedirect` is a fresh closure on most renders, so putting it
in the deps re-fires it every time; leaving it out means a stale one runs.

Expected: PASS, 8 tests.

- [ ] **Step 5: Export and hand off**

```
feat(admin-shell): redirect helpers and the session gate
```

---

### Task 7: Entry point and stories

**Files:**

- Modify: `packages/admin-shell/src/index.ts`
- Create: `packages/admin-shell/src/AppShell.stories.tsx`
- Create: `packages/admin-shell/src/NavMenu.stories.tsx`
- Test: `packages/admin-shell/src/index.test.ts`

- [ ] **Step 1: Write the final entry point**

Grouped: the shell components, the sidebar state, labels, navigation types, the fullscreen
hook, the redirect helpers, the session gate, the constants.

- [ ] **Step 2: Pin the public surface**

Same `Object.keys(api).sort()` test as the other packages. Anything in this list is a
semver-major to remove, so the list should be a decision rather than an accident.

- [ ] **Step 3: Write the AppShell story**

One default story assembling the whole thing: `SidebarProvider` wrapping `AppShell` with an
`AppHeader` carrying a `FullscreenButton` and an avatar, an `AppSidebar` with a brand badge,
a `NavMenu` over six fake items and a sign-out button in the footer, and a page of filler
text long enough to scroll. This is the showcase piece for the package and the thing anyone
evaluating it looks at first, so make the fake navigation plausible rather than
`['Item 1', 'Item 2']`.

`play` function:

- click the toggle, assert the drawer paper is 90px wide and the item text is gone
- click again, assert it is back to 240
- tab from the toggle and assert focus lands in the navigation

A second story, `Mobile`, with `parameters: {viewport: {defaultViewport: 'mobile1'}}`, whose
`play` opens the temporary drawer, clicks a nav item and asserts the drawer closed. That is
the `onNavigate` path, which is invisible on desktop and broken often.

- [ ] **Step 4: Write the NavMenu story**

`Expanded` and `Collapsed`, side by side in one file, with a `canAccess` that hides one item
so the filtering is visible in the showcase.

- [ ] **Step 5: Check the a11y pass**

`parameters.a11y.test = 'error'` is set globally in the Storybook preview, so a violation
fails the story test rather than warning. Run:

Run: `pnpm --filter @bohardlabs/storybook test`
Expected: PASS.

Colour contrast on the collapsed drawer and the accessible name of every icon-only button
are the two that will fail first. Fix them in the component, not by relaxing the rule.

- [ ] **Step 6: Run everything and hand off**

Run: `pnpm --filter @bohardlabs/admin-shell test && pnpm --filter @bohardlabs/admin-shell build`
Expected: PASS, roughly 95 tests.

```
feat(admin-shell): public surface and stories
```

---

### Task 8: README, changeset, and close the plan

**Files:**

- Create: `packages/admin-shell/README.md`
- Create: `.changeset/<generated-name>.md`
- Modify: `README.md`
- Modify: `docs/roadmap.md`
- Move: this file to `docs/superpowers/plans/done/`

- [ ] **Step 1: Write the README**

Sections:

1. **What it is**, and what it is not: chrome, not a router and not an auth system.
2. **The whole thing in one file**, a complete `App.tsx` showing `SidebarProvider`,
   `AppShell`, `AppHeader`, `AppSidebar` and `NavMenu` assembled, with a TanStack Router
   `Link` wired through `linkComponent` and `getLinkProps`. Someone should be able to paste
   this and see a working admin layout.
3. **Slots**, a table of every slot on every component and what usually goes in it.
4. **Navigation**, the `NavConfig` shape, the permission filter, and the note that `label`
   is a translated string rather than a key.
5. **Sidebar state**, including why the mobile drawer is not persisted.
6. **Labels**, the `ShellLabels` table.
7. **Redirect safety**, with the `getSafeRedirect` contract and an example of the attack it
   blocks. Someone skimming will skip this section unless it says what goes wrong.
8. **Using another router**, showing the Next.js and plain-anchor spellings of
   `getLinkProps`.

- [ ] **Step 2: Add the row to the root README**

```
| `packages/admin-shell` | Slot-based admin chrome: app bar, mini-drawer sidebar, navigation menu and content region | ported, not published |
```

- [ ] **Step 3: Write the changeset**

`pnpm changeset`, `@bohardlabs/admin-shell`, **minor**:

```
Initial release. An admin layout with a collapsing mini-drawer, a matching app bar, a
permission-filtered navigation menu that works with any router, and a scrolling content
region wired for scroll restoration. Plus the open-redirect guard for post-login
navigation.
```

- [ ] **Step 4: Run the full gate**

Run: `pnpm validate:ci`
Expected: PASS.

- [ ] **Step 5: Close the plan**

```bash
mv docs/superpowers/plans/open/2026-08-28-admin-shell-package.md \
   docs/superpowers/plans/done/2026-08-28-admin-shell-package.md
```

In `docs/roadmap.md`, section "New packages", set this plan's row to `done (today's date)`
and fix its link, which now points at `done/`.
This is the last of the five, so also update the board's opening line, which currently
tells the reader to take them in order.

- [ ] **Step 6: Hand off for commit**

```
feat(admin-shell): README, changeset, first release prep
```

---

## Out of scope

**`AuthPageLayout`** (331 loc). The split-screen login page with the gradient panel, the
floating animation, the gold accent and the Canada flag. It is brand design, not chrome, and
a de-branded version would be a blank two-column box that nobody would install. If a second
app wants the same look, the thing to extract is the layout skeleton with slots for the
panel content, and that is its own decision.

**`ProtectedLayout` and `AuthLayout` themselves.** What survives of them is `SessionGate`
plus the two redirect helpers. The rest is `useAuth`, `useNotificationStream`,
`usePushNotification`, `NotificationBanner` and `ROUTES`, none of which can leave the app.
The app's versions become about fifteen lines each once they compose the package.

**Notifications.** `NotificationBell`, `NotificationToast`, `NotificationBanner` and their
hooks are roughly 1800 lines fused to domain types. They have their own proposal at
[`docs/extraction/notifications.md`](../../../extraction/notifications.md). In this package
they are `actions` and `banner` slots.

**`useStorage`.** The general-purpose hook stays in the app. The provider needs one
persisted boolean and writing those twenty lines is cheaper than publishing and versioning a
storage hook with serializer options.

**Nested navigation items.** `NavigationItem.children` exists in the app's type and is
rendered nowhere. The package's `NavItem` drops it rather than shipping a field that does
nothing. Add it when an app actually needs a second level, with the expand and collapse
behaviour designed rather than inferred.

**Adopting the package in the apps.** Needs the package published, and needs
`@bohardlabs/admin-ui` published first for the sign-out dialog the footer slot renders.
