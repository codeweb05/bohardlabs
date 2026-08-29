// @ts-check

/**
 * The slow pass.
 *
 * Day-to-day linting is oxlint (`pnpm lint`, and the editor extension): it reads the same
 * source in a fraction of a second and covers correctness, rules-of-hooks, exhaustive-deps,
 * jsx-a11y, imports, and (under `pnpm lint:types`) the type-aware promise rules. This
 * config holds only what oxlint has no equivalent for, so the two passes do not duplicate
 * each other:
 *
 *   - sonarjs, which oxlint does not implement at all
 *   - testing-library and jest-dom, on test files only (oxlint has neither)
 *   - the storybook plugin
 *   - react-hooks v7's deeper analysis (refs read during render, state set in an effect,
 *     libraries the React Compiler cannot memoize)
 *
 * Run it on the files you commit (lint-staged), then on the whole tree at push and in
 * CI (`pnpm lint:eslint`). Not on every keystroke.
 * See docs/repo/tooling.md.
 */
import jestDom from 'eslint-plugin-jest-dom';
import reactHooks from 'eslint-plugin-react-hooks';
import sonarjs from 'eslint-plugin-sonarjs';
import storybook from 'eslint-plugin-storybook';
import testingLibrary from 'eslint-plugin-testing-library';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/storybook-static/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '**/*.config.{js,ts}',
    ],
  },

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {ecmaFeatures: {jsx: true}},
    },
    plugins: {'react-hooks': reactHooks, sonarjs},
    rules: {
      ...sonarjs.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // Route and endpoint strings trip the password heuristic.
      'sonarjs/no-hardcoded-passwords': 'off',
      'sonarjs/todo-tag': 'warn',
    },
  },

  {
    files: ['**/*.test.{ts,tsx}'],
    plugins: {'testing-library': testingLibrary, 'jest-dom': jestDom},
    rules: {
      // The same set the SkipWash admin app runs, so a test ported between the two lints
      // the same way in both.
      ...testingLibrary.configs['flat/react'].rules,
      ...jestDom.configs['flat/recommended'].rules,

      // Test harnesses call `useReactTable` to build a table instance. That is not
      // production compiler output, and wrapping every harness in `'use no memo'` is
      // noise. The production call in `useTableInstance` is the one that matters.
      'react-hooks/incompatible-library': 'off',
    },
  },

  ...storybook.configs['flat/recommended'],
);
