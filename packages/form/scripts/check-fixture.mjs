// Builds fixtures/consumer against dist/ with Vite and inspects the chunks. The sign-in
// form's initial load (the entry chunk and everything it imports statically) must hold no
// date picker, phone input or date library, and the lazily registered date field must
// land in a chunk of its own.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import react from '@vitejs/plugin-react';
import {build} from 'vite';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');

const result = await build({
  root: resolve(root, 'fixtures/consumer'),
  configFile: false,
  logLevel: 'warn',
  plugins: [react()],
  resolve: {
    alias: [
      {find: /^@vt-labs\/form\/(pickers|phone|maps)$/, replacement: `${dist}/$1.js`},
      {find: /^@vt-labs\/form$/, replacement: `${dist}/index.js`},
    ],
  },
  build: {write: false, modulePreload: false, minify: false},
});

const outputs = (Array.isArray(result) ? result : [result]).flatMap((bundle) => bundle.output);
const chunks = new Map(outputs.filter((output) => output.type === 'chunk').map((chunk) => [chunk.fileName, chunk]));

function staticClosure(fileName, seen = new Set()) {
  if (seen.has(fileName)) return seen;
  seen.add(fileName);
  for (const imported of chunks.get(fileName)?.imports ?? []) staticClosure(imported, seen);
  return seen;
}

const entry = [...chunks.values()].find((chunk) => chunk.isEntry);
const initial = [...staticClosure(entry.fileName)].flatMap((fileName) => chunks.get(fileName)?.moduleIds ?? []);

const MUST_NOT_LOAD_UP_FRONT = [
  [/node_modules\/@mui\/x-date-pickers\//, 'MUI X date pickers'],
  [/node_modules\/mui-tel-input\//, 'mui-tel-input'],
  [/node_modules\/libphonenumber-js\//, 'libphonenumber-js'],
  [/node_modules\/date-fns\//, 'date-fns'],
  // MUI 9 ships the barrel as index.mjs; earlier majors used esm/index.js.
  [/node_modules\/@mui\/material\/(esm\/)?index\.m?js$/, 'the @mui/material barrel'],
  [/\/dist\/(pickers|phone|maps)\//, 'another entry of @vt-labs/form'],
];

const failures = MUST_NOT_LOAD_UP_FRONT.flatMap(([pattern, what]) => {
  const hits = initial.filter((id) => pattern.test(id));
  return hits.length > 0 ? [`the initial load includes ${what} (${hits.length} modules, first: ${hits[0]})`] : [];
});

const lazyHasPickers = [...chunks.values()].some(
  (chunk) =>
    !staticClosure(entry.fileName).has(chunk.fileName) &&
    chunk.moduleIds.some((id) => /node_modules\/@mui\/x-date-pickers\//.test(id)),
);
if (!lazyHasPickers) failures.push('no lazily loaded chunk holds the date picker; lazyField did not split');

// SignIn.tsx is the README's sign-in example as printed, so the example a reader copies is
// the one measured here. An edit to either has to be made to both.
const readmeExample = readFileSync(resolve(root, 'README.md'), 'utf8')
  .split('## A form')[1]
  ?.match(/```tsx\n([\s\S]*?)```/)?.[1];
if (readmeExample !== readFileSync(resolve(root, 'fixtures/consumer/src/SignIn.tsx'), 'utf8')) {
  failures.push('fixtures/consumer/src/SignIn.tsx no longer matches the sign-in example in README.md');
}

if (failures.length > 0) {
  console.error(`check-fixture: ${failures.length} problem(s)\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-fixture: initial load is ${initial.length} modules, none of them pickers, phone or date code`);
