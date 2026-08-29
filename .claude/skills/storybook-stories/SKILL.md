---
name: storybook-stories
description: Use when adding or editing a *.stories.tsx file, an MDX guide, or anything under apps/storybook/.storybook. Covers the story-is-the-test rule, play functions, the a11y gate, control narrowing, portal queries, the theme presets and the per-story source block.
---

# Stories

A story here is three things at once: the demo, the interaction test, and the accessibility
check. `@storybook/addon-vitest` runs every one of them in a real Chromium.

- the `play` function is the interaction test (`vitest run --project storybook`);
- `parameters.a11y.test = 'error'` in `.storybook/preview.tsx` turns an axe violation into a
  failing test, not a panel warning.

**A story with no `play` asserts nothing and will drift.** Write one for anything with
behaviour. A pure visual variant can skip it; a variant with a click, a filter, a menu or a
loading state cannot.

Stories live **next to the source** inside `packages/<name>/src/`, never in the app. The app
only aggregates them, so a story imports its component the way a consumer would. No
registration step; the glob picks the file up.

## The shape

```tsx
const meta = {
  title: 'DataTable/DataTable',
  component: DataTable,
  tags: ['autodocs'],
  parameters: {docs: {description: {component: '…what this component is, for the docs page'}}},
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The sentence that appears under this story. Say what it demonstrates and why. */
export const Default: Story = {
  parameters: showcase('columns', 'data', 'enableSorting'),
  play: async ({canvasElement}) => { … },
};
```

`satisfies Meta<typeof X>` rather than `: Meta<typeof X>`, so `StoryObj<typeof meta>` infers
the real arg types and a typo in `args` is a compile error.

## Narrow the controls

`DataTable` takes 77 props. A panel listing all 77 on every story says nothing about which
three the story is about. `DataTable.stories.tsx` has a `showcase(...props)` helper that
returns both keys that matter:

```ts
{controls: {include: [...props]}, docs: {controls: {include: [...props]}}}
```

Both are needed. The Controls _panel_ reads `parameters.controls`; the Controls _block_ on a
docs page defaults from `parameters.docs.controls`, so setting only the first leaves the docs
page unfiltered. Spread it when a story has other parameters: `{...showcase('a', 'b'), layout: 'centered'}`.

The full prop list belongs on the component's own docs page, and it is already there.

## Writing a `play` function

- Query by role and accessible name. `getByRole('button', {name: 'Delete'})` fails loudly when
  the accessible name breaks; `container.querySelector('.MuiButton-root')` does not.
- `within(canvasElement)` for anything inside the story root. **`screen` for anything in a
  portal**: dialogs, menus, popovers, tooltips and the date picker all render to
  `document.body`, outside `canvasElement`, and `within` will not find them.
- `findBy*` after an action that opens something; `waitFor` for a state that settles.
  A bare `getBy*` right after a click is the most common flake here.
- Assert the consequence, not the click. `await expect(args.onConfirm).toHaveBeenCalled()`
  and a check that the dialog closed, rather than "the button existed".
- `fn()` from `storybook/test` for every callback in `args`, so the panel logs it and the test
  can assert on it.
- Do not reuse a label an existing `play` queries loosely. The canvas already contains
  **Show code**, **Hide code**, **Copy** and **Copied** buttons from the source block, plus
  whatever the story renders.

## Accessibility is a gate, not a panel

`test: 'error'` means an axe violation fails `pnpm test`. Fix the component. Turning a rule
off for one story needs a comment saying which rule, why it does not apply here, and what
would make it apply again:

```tsx
parameters: {a11y: {config: {rules: [{id: 'color-contrast', enabled: false}]}}},
```

Only the stock light theme is exercised by the a11y run (`initialGlobals: {theme: 'light'}`).
Contrast under Nord or Dracula is not covered by a test; check it by eye in the toolbar.

## What `preview.tsx` gives every story

- **The theme picker**, driven by `THEME_PRESETS` in `.storybook/themes.ts`: stock light and
  dark, then Nord, Dracula, Tokyo Night, Solarized Light, Catppuccin Latte and High contrast.
  Adding a preset is one entry in that array; nothing else changes. Presets use system font
  stacks only, because a webfont would silently fall back in CI.
- **The story note.** A JSDoc block above an exported story becomes the paragraph under it in
  the canvas. Write it as prose for a reader, not as a changelog line.
- **The source block.** `csf-plugin` writes each story's raw source into
  `parameters.docs.source.originalSource` at build time, and the decorator renders it under
  the story in the canvas behind **Show code** / **Copy**, with the Storybook-only keys
  (`parameters`, `tags`, `globals`, `name`, `storyName`) stripped by `toSnippet`. It stays
  collapsed with `unmountOnExit`, which is load-bearing: an expanded code block would put the
  story's own source text inside the root that `within(canvasElement)` and axe read.

Both extras render in the canvas only (`viewMode !== 'docs'`); the docs page already prints
the description and the source itself.

## MDX guides

`packages/<name>/src/docs/*.mdx` for guides that belong to a package, `apps/storybook/src/`
for the introduction. A guide is prose plus links to stories, not a second copy of the prop
table. Keep it true: an MDX file that lists what a theme can override is a promise, and a
wrong one is worse than none. When a component's `sx` changes what a consumer can reach, the
theming guide changes in the same edit.

## Checklist

- [ ] Story file sits next to its source, imports by package name.
- [ ] `satisfies Meta<typeof X>`; `StoryObj<typeof meta>`.
- [ ] `play` on anything with behaviour, asserting the consequence.
- [ ] `screen` for portalled UI, `within(canvasElement)` for the rest.
- [ ] Controls narrowed with `showcase(...)`.
- [ ] JSDoc above the story: what it demonstrates and why.
- [ ] `vitest run --project storybook` green, a11y included.
- [ ] Looked at it under at least one dark preset.
