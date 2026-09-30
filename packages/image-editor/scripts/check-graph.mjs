// Walks dist/ from the entry along relative imports and checks every bare import it reaches.
// The build marks every bare specifier external, so what this sees is exactly what a
// consumer's bundler will be asked to resolve. cropperjs registers custom elements when it
// loads, so it must only ever arrive through the dynamic import in the engine: a static
// import would define them in every page that imports the package, editor open or not.
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const entry = join(root, 'dist', 'index.js');
const {peerDependencies = {}} = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const CROPPER = 'cropperjs';
// Never: the MUI barrel or the icon pack barrel.
const FORBIDDEN = [/^@mui\/material$/, /^@mui\/icons-material$/];

// Rolldown emits one import or export statement per line in the lib output. This is a
// scanner for that output, not a general JS parser.
const STATIC = /\b(?:from|import)\s*["']([^"']+)["']/g;
const DYNAMIC = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

const packageName = (specifier) =>
  specifier
    .split('/')
    .slice(0, specifier.startsWith('@') ? 2 : 1)
    .join('/');

const failures = [];
if (!existsSync(entry)) {
  console.error('check-graph: dist/index.js is missing. Run the build first.');
  process.exit(1);
}

const seen = new Set();
const queue = [entry];
let lazyCropper = false;
while (queue.length > 0) {
  const file = queue.pop();
  if (seen.has(file)) continue;
  seen.add(file);
  const source = readFileSync(file, 'utf8');
  const where = file.slice(root.length + 1);
  for (const [, specifier] of source.matchAll(DYNAMIC)) {
    if (specifier === CROPPER) lazyCropper = true;
  }
  for (const [, specifier] of source.matchAll(STATIC)) {
    if (specifier.startsWith('.')) {
      queue.push(resolve(dirname(file), specifier));
      continue;
    }
    const name = packageName(specifier);
    if (name === CROPPER) failures.push(`${where}: imports ${specifier} statically`);
    if (FORBIDDEN.some((pattern) => pattern.test(specifier))) failures.push(`${where}: imports ${specifier}`);
    if (!(name in peerDependencies)) failures.push(`${where}: imports ${specifier}, which is not a peer dependency`);
  }
}
if (!lazyCropper) failures.push(`no file reached from dist/index.js has import('${CROPPER}')`);

if (failures.length > 0) {
  console.error(`check-graph: ${failures.length} problem(s)\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-graph: ${seen.size} files reach only peers, and ${CROPPER} loads lazily`);
