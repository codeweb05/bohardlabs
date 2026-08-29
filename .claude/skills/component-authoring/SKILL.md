---
name: component-authoring
description: Use when writing or editing a React component, hook, or MUI-facing code inside packages/*/src — anything with styling, user-facing text, props, icons, or state. Covers theme tokens instead of colours, strings as props with English defaults, why sx beats theme styleOverrides here, slots, and the prop shapes this repo uses.
---

# Authoring a component

A component here is rendered under a theme you have not seen, in a language you have not
read, next to components you did not write. Every rule below exists because one of those
three is true.

## Never a literal colour, radius or font

Read theme tokens so the component follows the consumer's palette:

```tsx
// wrong
sx={{borderBottom: '1px solid #e0e0e0', color: '#666'}}

// right
sx={{borderBottom: 1, borderColor: 'divider', color: 'text.secondary'}}
```

The tokens worth knowing: `primary.main`, `error.main`, `text.primary`, `text.secondary`,
`divider`, `background.paper`, `action.hover`, `action.selected`. For radius, `borderRadius: 1`
is `shape.borderRadius`, not a pixel value. For type, inherit rather than setting a family.

A literal colour is invisible in this repo's light and dark previews only until somebody
loads it under Nord or Solarized. `apps/storybook/.storybook/themes.ts` has eight presets for
exactly this, and the theme picker is the fastest way to catch a hardcoded value.

## Never a user-facing string inside a component

Take it as a prop with an English default, so a consumer can translate it. There is no i18n
framework here; that is the consumer's job.

The table's pattern is `i18n/labels.ts` (a `DEFAULT_LABELS` object) plus `LabelsContext`, so a
subcomponent reads `useLabels()` and a consumer overrides the whole map through one `labels`
prop. A standalone component (`ConfirmDialog`) falls back to `DEFAULT_LABELS` when there is no
provider above it, and per-string props (`confirmLabel`, `cancelLabel`) override either way.
Follow that shape rather than inventing a second one.

An `aria-label` is a user-facing string. So is a date format, a currency symbol, and the text
in a `title` attribute.

## `sx` wins over theme `styleOverrides`

Non-obvious and it has already cost a rewrite. `sx` compiles to an emotion class on the
element itself; a consumer's `components.MuiTableCell.styleOverrides.head` lands earlier in
the cascade at the same specificity. So anything the component sets through `sx` cannot be
themed away.

That makes `sx` a decision about what is fixed and what is the consumer's. On the table, cell
padding, body font size, row height and header capitalisation are set through `sx` because
they are driven by the `density` and `headerCase` props; the palette, divider, hover, radius
and the header's background and font are left to the theme. Before adding an `sx` rule, ask
which side of that line it belongs on. If a consumer might reasonably want it different, it is
a prop or a token, not an `sx` literal.

Descendant selectors compound the problem. `'& .MuiTableRow-root:nth-of-type(odd)'` is
specificity 0,3,0 and beats the row's own selection highlight at 0,2,0, which is why the table
has no zebra striping.

## Icons

Deep import, always:

```tsx
import CheckIcon from '@mui/icons-material/Check'; // yes
import {Check} from '@mui/icons-material'; // no: the whole pack, for every consumer
```

## Props

- `Readonly<Props>` on the parameter, `readonly` on every field. The compiler then catches a
  mutation of something the consumer still owns.
- Keep `| null` and `?` on anything that came from an API. See `library-boundaries`.
- A callback is `onX`, past tense of what happened, not what to do: `onSortChange`, not
  `sortHandler`.
- A boolean reads true by default in its name: `enableSorting`, `isLoading`, `showToolbar`.
- Anything the consumer might replace wholesale is a `slots` entry taking a documented props
  type (`slots.confirmDialog` takes `DataTableConfirmProps`), not a `render*` callback and not
  a `children` position. Define the slot's props type and export it: it is the contract.
- A `slots` object built inline re-mounts the slot on every render. Say so in the JSDoc, and
  show a module constant in the example.

## Hooks and the React Compiler

The React Compiler is on ([decision 0003](../../../docs/decisions/0003-react-compiler.md)), so
do not hand-write `useMemo` and `useCallback` for referential stability the compiler already
provides. Keep them where the value is genuinely expensive or where identity is part of an API
contract, and say which in a comment.

`react-hooks` runs in the ESLint pass, not oxlint. `pnpm lint` will not catch a dependency
array mistake; `pnpm lint:eslint` will.

## JSDoc is the documentation

The docs page is generated from the types. A JSDoc block on a prop becomes its row in the prop
table, and a block above a story becomes the note under it. Write the sentence you would want
to read when the prop's name is not enough, and write it for someone who has not read the
component.

## Checklist

- [ ] No literal colour, radius or font family. Checked under a dark preset and Solarized.
- [ ] No user-facing string baked in. Labels through `labels` / `DEFAULT_LABELS`, or a prop
      with an English default.
- [ ] Every `sx` rule is something a consumer should not be able to change.
- [ ] Icons deep-imported.
- [ ] Props `readonly`, boundary types keep their `| null` / `?`.
- [ ] JSDoc on every public prop, and on anything whose reason is not obvious.
- [ ] `pnpm lint:eslint` run, not just `pnpm lint`.
