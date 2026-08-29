/** @type {import('lint-staged').Configuration} */
export default {
  // oxlint is the on-type pass. ESLint runs here only on the files you staged, not the
  // whole repo, so the slow rules (sonarjs, react-hooks v7) show up before the commit
  // without sitting on every keystroke. oxfmt last so a fixer cannot un-format a file.
  '*.{ts,tsx}': ['oxlint --fix', 'eslint --fix', 'oxfmt'],
  '*.{json,md,mdx,yml,yaml,css}': ['oxfmt'],
};
