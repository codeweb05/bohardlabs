/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 120],
    // Prose subjects are allowed. This is a library repo, not a JIRA board.
    'subject-case': [0],
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
  ignores: [
    (message) => message.startsWith('Merge '),
    (message) => message.startsWith('Revert '),
    (message) => message.startsWith('Initial commit'),
  ],
};
