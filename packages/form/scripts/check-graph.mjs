// Walks dist/ from each entry along relative imports and checks every bare import it
// reaches. The build marks every bare specifier external, so what this sees is exactly
// what a consumer's bundler will be asked to resolve. Decision 0009 has the reasoning.
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const {peerDependencies = {}} = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const PICKERS = '@mui/x-date-pickers';
const PHONE = 'mui-tel-input';
const FORBIDDEN_BY_ENTRY = {
  index: [PICKERS, PHONE],
  pickers: [PHONE],
  phone: [PICKERS],
  maps: [PICKERS, PHONE],
};
// Never, from any entry: the MUI barrel, an icon pack, a date library, phone metadata.
const FORBIDDEN_EVERYWHERE = [
  /^@mui\/material$/,
  /^@mui\/icons-material$/,
  /^date-fns/,
  /^dayjs/,
  /^libphonenumber-js/,
];

// Rolldown emits one import or export statement per line in the lib output. This is a
// scanner for that output, not a general JS parser.
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;

const packageName = (specifier) =>
  specifier
    .split('/')
    .slice(0, specifier.startsWith('@') ? 2 : 1)
    .join('/');

function reachable(entryFile) {
  const seen = new Set();
  const bare = new Set();
  const queue = [entryFile];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const [, specifier] of readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
      if (specifier.startsWith('.')) queue.push(resolve(dirname(file), specifier));
      else bare.add(specifier);
    }
  }
  return bare;
}

const failures = [];
for (const [entry, forbidden] of Object.entries(FORBIDDEN_BY_ENTRY)) {
  const file = join(dist, `${entry}.js`);
  if (!existsSync(file)) {
    failures.push(`${entry}: dist/${entry}.js is missing. Run the build first.`);
    continue;
  }
  for (const specifier of reachable(file)) {
    const name = packageName(specifier);
    if (forbidden.includes(name)) failures.push(`${entry}: reaches ${specifier}, which belongs to another entry`);
    if (FORBIDDEN_EVERYWHERE.some((pattern) => pattern.test(specifier)))
      failures.push(`${entry}: imports ${specifier}`);
    if (!(name in peerDependencies))
      failures.push(`${entry}: imports ${specifier}, and ${name} is not a peer dependency`);
  }
}

function declarationFiles(dir) {
  return readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return declarationFiles(path);
    return entry.name.endsWith('.d.ts') ? [path] : [];
  });
}
for (const file of declarationFiles(dist)) {
  if (readFileSync(file, 'utf8').includes('google.maps')) {
    failures.push(`${file.slice(root.length + 1)}: mentions google.maps; consumers do not have those types`);
  }
}

if (failures.length > 0) {
  console.error(`check-graph: ${failures.length} problem(s)\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('check-graph: every entry reaches only its own peers');
