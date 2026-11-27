// Walks dist/ from each entry along relative imports and checks every bare import it reaches.
// The build marks every bare specifier external, so what this sees is exactly what a
// consumer's bundler will be asked to resolve. The core entry runs on a server and must
// reach no package at all. The root entry gains the Nest peers with the module, and its
// allowance is added here then.
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const {peerDependencies = {}} = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

// Rolldown emits one import or export statement per line in the lib output, at the start of
// the line. This is a scanner for that output, not a general JS parser; anchoring at the line
// start keeps a class name such as "np-mail-from" from reading as an import.
const STATIC = /^(?:import|export)\b[^"'\n]*["']([^"'\n]+)["']/gm;
const DYNAMIC = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

const packageName = (specifier) =>
  specifier
    .split('/')
    .slice(0, specifier.startsWith('@') ? 2 : 1)
    .join('/');

const failures = [];

function walk(entryFile, allowed) {
  const entry = join(root, 'dist', entryFile);
  if (!existsSync(entry)) {
    failures.push(`dist/${entryFile} is missing. Run the build first.`);
    return 0;
  }
  const seen = new Set();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    const where = file.slice(root.length + 1);
    for (const [, specifier] of [...source.matchAll(STATIC), ...source.matchAll(DYNAMIC)]) {
      if (specifier.startsWith('.')) {
        queue.push(resolve(dirname(file), specifier));
        continue;
      }
      if (!allowed(packageName(specifier))) failures.push(`${where} (from ${entryFile}): imports ${specifier}`);
    }
  }
  return seen.size;
}

const core = walk('core/index.js', () => false);
const entry = walk('index.js', (name) => name in peerDependencies);

if (failures.length > 0) {
  console.error(`check-graph: ${failures.length} problem(s)\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `check-graph: core/index.js reaches ${core} files and no package; index.js reaches ${entry} files and only peers`,
);
