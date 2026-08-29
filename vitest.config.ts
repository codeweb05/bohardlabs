import {fileURLToPath} from 'node:url';

import {storybookTest} from '@storybook/addon-vitest/vitest-plugin';
import {playwright} from '@vitest/browser-playwright';
import {defineConfig} from 'vitest/config';

// Resolved against this file rather than the cwd: the Storybook panel starts its runner
// from `apps/storybook`, and a relative path would resolve twice into
// `apps/storybook/apps/storybook/.storybook`.
const storybookConfigDir = fileURLToPath(new URL('./apps/storybook/.storybook', import.meta.url));
const storybookRoot = fileURLToPath(new URL('./apps/storybook', import.meta.url));

// This config exists at the root rather than in `apps/storybook` for one reason: coverage.
//
// Vitest scopes coverage collection to the project root, and neither the v8 nor the
// istanbul provider reports a file that sits outside it. With the story run rooted at
// `apps/storybook`, the only source file in scope was `.storybook/preview.tsx`, so the
// Storybook test panel reported coverage of its own config and nothing about the library.
// Rooting the run here puts `packages/*/src` in scope and merges the story run with each
// package's unit run into one number.
//
// `@storybook/addon-vitest` finds this file the same way: it walks up from the Storybook
// config dir looking for a vitest config that mentions `storybookTest`, and uses that
// directory as the root. That search only ever goes up, which is why the storybook project
// is declared inline here instead of being pointed at a config inside the app.
export default defineConfig({
  test: {
    projects: [
      // Each package brings its own test config (jsdom, setup files, pool sizing).
      'packages/*',
      {
        // The plugin resolves the story globs from `main.ts` against this root, so it has
        // to be the app rather than the repo root or nothing matches.
        root: storybookRoot,
        plugins: [storybookTest({configDir: storybookConfigDir})],
        // Vite discovering a new dependency mid-run reloads the page under the test, which
        // Vitest reports as a lost suite rather than as what it is. These are imported from
        // the preview config, which the scanner does not crawl, so they are named here.
        optimizeDeps: {include: ['storybook/viewport']},
        test: {
          // Overridden to `storybook:<configDir>` when the Storybook panel runs this; the
          // name here is what a CLI run and `--project` filtering see.
          name: 'storybook',
          // The package project pins `maxWorkers` to half the cores for its jsdom forks.
          // Vitest refuses to run projects with different worker counts in one group, and
          // a separate group is what we want anyway: one Chromium competing with 26 jsdom
          // forks is how the story timeouts start.
          sequence: {groupOrder: 1},
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{browser: 'chromium'}],
          },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // The published sources, and only those. Anything outside a package's `src` is
      // tooling rather than something a consumer runs.
      //
      // Absolute, and paired with `allowExternal`, because of how Vitest scopes coverage
      // when a run is filtered to one project (`--project storybook`, which is exactly what
      // the Storybook test panel does). In that case the provider replaces the config root
      // with the roots of the surviving projects, so the scope collapses to
      // `apps/storybook`: a relative glob is then resolved from there and finds nothing, and
      // every file that the stories did cover is dropped for sitting outside the root. An
      // absolute glob survives the first, `allowExternal` the second.
      include: [fileURLToPath(new URL('./packages/*/src/**/*.{ts,tsx}', import.meta.url))],
      allowExternal: true,
      exclude: [
        // The test suite is not its own subject.
        '**/test/**',
        '**/*.stories.tsx',
        '**/stories/**',
        // Barrels and type-only modules re-export and declare; they run no logic, so
        // counting them only moves the denominator.
        '**/index.ts',
        '**/server.ts',
        '**/types.ts',
      ],
    },
  },
});
