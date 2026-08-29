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
 *   - the storybook plugin
 *   - react-hooks v7's deeper analysis (refs read during render, state set in an effect,
 *     libraries the React Compiler cannot memoize)
 *
 * Run it before a commit or a push (`pnpm lint:eslint`), not on every keystroke.
 * See docs/repo/tooling.md.
 */
import reactHooks from 'eslint-plugin-react-hooks';
import sonarjs from 'eslint-plugin-sonarjs';
import storybook from 'eslint-plugin-storybook';
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

      // New in react-hooks v7 and worth reading, but the table was written against v5 and
      // every hit is in code that ships and works. Warnings so they stay visible without
      // blocking the gate; see docs/packages/datatable/port.md for the list.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/incompatible-library': 'warn',
    },
  },

  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      // Both are about how an assertion is phrased. Worth knowing, not worth failing a
      // push over.
      'sonarjs/prefer-specific-assertions': 'warn',
      'sonarjs/parameterized-tests': 'warn',
    },
  },

  ...storybook.configs['flat/recommended'],
);
