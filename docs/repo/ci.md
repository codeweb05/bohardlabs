# CI, publishing and visual tests

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`.

## What runs

| Job                 | When             | What it does                                                    |
| ------------------- | ---------------- | --------------------------------------------------------------- |
| `validate`          | PRs and `main`   | `pnpm validate:ci`, then builds Storybook and uploads it        |
| `publish-storybook` | pushes to `main` | deploys that Storybook build to GitHub Pages                    |
| `visual-tests`      | PRs and `main`   | Chromatic, and skips itself when no project token is configured |

`validate:ci` is oxlint, then ESLint for the rules oxlint has no equivalent for, then the
formatter check, then `turbo run typecheck build`, then the tests. See
[`tooling.md`](./tooling.md) for why both linters are there, and why the tests run one
package at a time.

Two things the workflow does that are easy to miss:

- **Playwright Chromium is installed before the tests.** Every story runs as a real browser
  test through `@storybook/addon-vitest`, so the browser has to exist first. `--with-deps`
  pulls the system libraries the runner image does not ship.
- **The Storybook build is uploaded as an artifact** and the Pages job downloads it rather
  than building it a second time.

## Publishing the Storybook

The `publish-storybook` job deploys to GitHub Pages, which needs no third-party account. It
requires one manual step, once: **Settings → Pages → Source → GitHub Actions**. Until then
the job fails with a permissions error, which is GitHub asking for that switch.

The alternative is Chromatic, which publishes every build including branches. If you set up
the token below you get that for free and can drop the Pages job.

## Visual tests

`@chromatic-com/storybook` is installed and registered. It is inert until a project token
exists: the panel in the sidebar offers to set one up, and nothing runs in CI.

To turn it on:

1. Create a project at chromatic.com and point it at this repository.
2. Copy the project token.
3. Add it as `CHROMATIC_PROJECT_TOKEN` under **Settings → Secrets and variables → Actions**.

The `visual-tests` job picks it up on the next run. `onlyChanged: true` limits each build to
the stories the diff can reach, and `exitZeroOnChanges: true` makes a visual difference a
review comment rather than a red build, because most of them are intended.

Locally: `pnpm dlx chromatic --project-token=<token> --working-dir apps/storybook`.

This is the one part of the setup that cannot be finished from inside the repository. It
needs an account, and account credentials are not something to commit.

### Without an account

Vitest 4's browser mode has `toMatchScreenshot`, which would give screenshot diffing with no
service behind it. It is not wired up here, and the reason is worth knowing before someone
reaches for it: the baselines are byte-comparisons of a rendered page, so they differ between
a developer's macOS and CI's Linux, and keeping both green means either committing two sets
or running the baselines in a container. Chromatic exists because that problem is annoying.

Interaction tests and accessibility checks are not affected by any of this. They run in CI
already, on every story.
