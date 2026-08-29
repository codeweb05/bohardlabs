# Open questions

Decisions not yet made. Nothing here is an oversight, and nothing here should be answered
by guessing. If work is blocked on one, ask.

---

## 1. npm scope (blocking first publish)

**Status:** decided (2026-08-28). `@bohar/*`.

The scope is the company name as well. Packages were renamed from the `@repo/*`
placeholder. They stay `"private": true` until a package is genuinely ready to publish.

Still to do before the first `changeset publish`:

- create the `bohar` org on npm and add the publishing account
- remove `"private": true` on the packages meant to publish

---

## 2. Module format: ESM-only

**Status:** decided provisionally, revisit on the first consumer complaint.

Packages ship ESM only. React 19 and MUI v7 already require a modern toolchain, so the
overlap between "can use this table" and "needs CJS" is thin, and dual-publishing doubles
the output surface and invites the dual-package hazard.

If a consumer on a CJS test runner does turn up, adding a second `build.lib` format in
`packages/datatable/vite.config.ts` plus a `require` condition in `exports` is a small
change. Don't do it speculatively.

---

## 3. React Compiler: compile here, or leave it to the consumer?

**Status:** decided (2026-08-28). Compile here.

The port settled it empirically: three tests fail without the compiler, because several
components depend on it for the memoization they are written against. So
`babel-plugin-react-compiler` runs in the test config and in the build, and the build moved
from tsup to `vite build` to get Babel into the pipeline at all. The rest of this entry is
the reasoning as it stood.

The table's source carries `'use no memo'` directives, which exist for the React Compiler.
Two options:

- **Compile at build time** (add `babel-plugin-react-compiler` to the package build). Every
  consumer gets the optimised output whether or not they run the compiler. The directives
  are consumed here and never ship.
- **Ship uncompiled** and let a consumer's compiler handle it. Smaller build, but the
  directives have to survive transpilation, and esbuild does not reliably preserve unknown
  top-of-file directives, so this needs a preserve-directives plugin to be safe.

Leaning toward compiling here. It makes the package's behaviour independent of the
consumer's build config, which is the whole argument for shipping a library at all.

---

## 4. `noUncheckedIndexedAccess`

**Status:** deliberately off, revisit after the port.

It is the right flag for library code. Turning it on during the port would have buried it in
several hundred new errors on `sorting[0].id`-shaped access. The port has landed, so this is
now ready to do, in its own change, so the diff is readable.

---

## 5. Where the DataTable roadmap lives

**Status:** resolved (2026-08-28). It lives here, at `docs/packages/datatable/roadmap.md`.

It describes the library, not the app, and the code is here now. The copy in
`skipwash-admin/docs/` is stale from this point on; delete it when the app switches to the
package.

---

## 6. MUI version: pinned to the app for now

**Status:** decided, with a scheduled follow-up (2026-08-28).

The catalog pins `@mui/material` and `@mui/icons-material` at `^7.3.7`, which is what
`skipwash-admin` runs. That is not a target, only a starting point: it keeps the port
honest while code is still moving between the two repos, since a component that compiles
here and not there would be noise, not signal.

**Upgrade to the latest MUI once the base setup is done.** That is the plan, not an open
question. When it happens, bump the catalog entry and widen the `peerDependencies` range in
each package, which are deliberately separate numbers: the peer range is what a consumer may
bring, the catalog is what this repo builds against.
