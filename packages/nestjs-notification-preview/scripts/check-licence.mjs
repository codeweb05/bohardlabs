// The page bundles React, whose MIT licence asks that its notice travel with every copy. The page
// build keeps legal comments; this fails verify if a build ever drops React's from dist/ui.
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

const assets = join(resolve(import.meta.dirname, '..'), 'dist', 'ui', 'assets');
const scripts = existsSync(assets) ? readdirSync(assets).filter((name) => name.endsWith('.js')) : [];

if (scripts.length === 0) {
  console.error('check-licence: dist/ui/assets holds no script. Run the build first.');
  process.exit(1);
}

const kept = scripts.some((name) => {
  const code = readFileSync(join(assets, name), 'utf8');
  return /@license React\b/.test(code) && code.includes('This source code is licensed under the MIT license');
});

if (!kept) {
  console.error("check-licence: React's licence comment is missing from dist/ui/assets/*.js.");
  process.exit(1);
}
console.log(`check-licence: React's licence notice is kept in dist/ui (${String(scripts.length)} script(s) checked).`);
