/**
 * Turns what Storybook knows about a story into the code a reader would copy.
 *
 * Storybook has two strings for a story. One is the JSX `jsxDecorator` renders from the
 * story's args; the other is the story object itself, as `csf-plugin` wrote it at build
 * time. Neither is enough alone: the JSX of a story built on a demo component is one line
 * naming a component the reader cannot see, and the story object is mostly the `play` test.
 * So the code shown is the JSX (or the story object without its Storybook-only keys),
 * followed by every declaration in the story file it leans on.
 */

/**
 * Keys that describe the story to Storybook rather than the component to a reader.
 * `parameters` narrows the Controls panel, `tags` drives autodocs, and `play` is the
 * interaction test: all three are noise in an app, and `play` is the longest of them.
 */
const STORYBOOK_ONLY = new Set([
  'parameters',
  'tags',
  'globals',
  'name',
  'storyName',
  'play',
  'loaders',
  'beforeEach',
  'decorators',
]);

/** A top-level key of an object printed at two-space indentation, a spread included. */
const TOP_LEVEL_KEY = /^ {2}(?:async )?([A-Za-z_$][\w$]*)\s*[:(]|^ {2}(\.\.\.)/;

/**
 * Keeps the top-level keys of a printed object that `keep` accepts. A key owns every line
 * up to the next key or the closing brace, which is what lets a value span lines however
 * it likes: a `play` whose parameter list wraps is still one key.
 *
 * `csf-plugin` prints a story's source at two-space indentation for a top-level key, and
 * the formatter does the same for a `meta` object, so the scan holds for both.
 */
function keepKeys(printed: string, keep: (key: string) => boolean): string {
  const kept: string[] = [];
  let dropping = false;

  for (const line of printed.split('\n')) {
    const key = TOP_LEVEL_KEY.exec(line);
    if (key) dropping = !keep(key[1] ?? key[2] ?? '');
    else if (/^\S/.test(line)) dropping = false;
    if (!dropping) kept.push(line);
  }

  return kept.join('\n').trim();
}

/** An object with every key dropped still prints its braces. */
function isEmptyObject(code: string): boolean {
  return code.replace(/[\s{},;]/g, '') === '';
}

/** A story object that is nothing but `render: () => <jsx>`, as `csf-plugin` prints it. */
const ONLY_A_RENDER = /^\{\n {2}render: \(\) => (<[\s\S]*>),?\n\}$/;

/**
 * A story's own source, without the keys only Storybook reads. Empty when nothing is left.
 * When all that is left is a `render` with no arguments, its JSX is the code, and the object
 * around it is Storybook's.
 */
export function toSnippet(originalSource: string): string {
  const snippet = keepKeys(originalSource, (key) => !STORYBOOK_ONLY.has(key));
  if (isEmptyObject(snippet)) return '';

  const jsx = ONLY_A_RENDER.exec(snippet)?.[1];
  // The printer indents the JSX under the key, four spaces past where a reader wants it.
  return jsx === undefined ? snippet : jsx.replace(/^ {4}/gm, '');
}

interface Declaration {
  readonly name: string;
  readonly text: string;
  readonly isExported: boolean;
}

const DECLARATION = /^(export )?(?:async )?(?:function|const|let|class|interface|type|enum) ([A-Za-z_$][\w$]*)/;

/**
 * The top-level declarations of a formatted source file. The formatter puts each one at
 * column zero and closes it at column zero, so a declaration runs until its closing line,
 * or until the next line at column zero when it has none.
 */
function declarationsOf(file: string): Declaration[] {
  const found: Declaration[] = [];
  let open: {name: string; isExported: boolean; lines: string[]} | null = null;

  const close = () => {
    if (open) found.push({name: open.name, isExported: open.isExported, text: open.lines.join('\n').trimEnd()});
    open = null;
  };

  for (const line of file.split('\n')) {
    const start = DECLARATION.exec(line);
    if (start) {
      close();
      open = {name: start[2] ?? '', isExported: start[1] !== undefined, lines: [line]};
    } else if (open && (line === '' || /^\s/.test(line))) {
      open.lines.push(line);
    } else if (open && /^[)\]}]/.test(line)) {
      open.lines.push(line);
      // `}) {` closes a wrapped parameter list and opens the body, so it ends nothing.
      if (!/(?:[{([]|=>)$/.test(line)) close();
    } else {
      // A comment or an import at column zero: whatever was open ended on the line before.
      close();
    }
  }
  close();

  return found;
}

function mentions(code: string, name: string): boolean {
  return new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(code);
}

/**
 * The story file's own declarations that `code` leans on, in file order, following one
 * declaration into the next. Exports are the stories and `meta`, which a reader does not
 * copy, so they are never part of the answer.
 */
function definitionsFor(code: string, file: string): string[] {
  const local = declarationsOf(file).filter(({name, isExported}) => !isExported && name !== 'meta' && name !== 'Story');
  const used = new Set<Declaration>();
  let reach = code;

  for (let grew = true; grew;) {
    grew = false;
    for (const declaration of local) {
      if (used.has(declaration) || !mentions(reach, declaration.name)) continue;
      used.add(declaration);
      reach += `\n${declaration.text}`;
      grew = true;
    }
  }

  return local.filter((declaration) => used.has(declaration)).map(({text}) => text);
}

/** What `meta` renders, for a story that leaves the rendering to it. */
function metaRender(file: string): string {
  const meta = declarationsOf(file).find(({name}) => name === 'meta');
  return meta ? keepKeys(meta.text, (key) => key === 'component' || key === 'render') : '';
}

/** A data URL or a token in an arg can run to megabytes. Its first characters say what it is. */
const LONG_STRING = /(["'`])([^"'`\s]{160,})\1/g;

/** How many lines an array literal may run before the rest of its items are summarised. */
const LONG_ARRAY = 40;

/**
 * Cuts an array literal that runs past `LONG_ARRAY` lines down to its first item. The JSX
 * snippet prints a `data` prop in full, which for the virtualized table is five thousand
 * lines of rows above the one prop the story is about.
 */
function shortenArrays(code: string): string {
  const lines = code.split('\n');
  const kept: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    kept.push(line);
    const cut = line.endsWith('[') ? longArrayAt(lines, index) : null;
    if (cut) {
      kept.push(
        ...lines.slice(index + 1, cut.firstEnd + 1),
        `${cut.item}// … ${cut.end - cut.firstEnd - 1} more lines`,
      );
      index = cut.end;
    } else {
      index += 1;
    }
  }

  return kept.join('\n');
}

/** Where the array opened on line `start` closes and where its first item ends, when it is long. */
function longArrayAt(lines: readonly string[], start: number) {
  const indent = /^ */.exec(lines[start] ?? '')?.[0] ?? '';
  const end = lines.findIndex((line, at) => at > start && line.startsWith(`${indent}]`));
  if (end === -1 || end - start <= LONG_ARRAY) return null;

  const item = `${indent}  `;
  // The first item ends at the first line back at item depth, counting from its second line.
  const firstEnd = lines.findIndex(
    (line, at) => at > start + 1 && at < end && line.startsWith(item) && line[item.length] !== ' ',
  );
  return firstEnd === -1 ? null : {end, firstEnd, item};
}

function shorten(code: string): string {
  return shortenArrays(code).replace(
    LONG_STRING,
    (_match, quote: string, value: string) => `${quote}${value.slice(0, 60)}…${quote}`,
  );
}

export interface StoryCode {
  /** The JSX snippet when Storybook rendered one, or `null`. */
  readonly snippet: string | null;
  /** The story object as `csf-plugin` wrote it. */
  readonly originalSource: string;
  /** The story file's source, or `null` while it is loading or when it cannot be found. */
  readonly file: string | null;
}

/** The code to show for a story: its JSX or its trimmed object, then what that leans on. */
export function describeStory({snippet, originalSource, file}: StoryCode): string {
  const own = snippet ?? toSnippet(originalSource);
  if (file === null) return shorten(own || originalSource.trim());

  // The story's JSX names what it renders. A story object does only when it has a `render`
  // of its own; otherwise `meta` decides, so that is where the search starts.
  const rendersItself = snippet !== null || /^ {2}render\b/m.test(originalSource);
  const reach = rendersItself ? own : `${own}\n${metaRender(file)}`;
  const parts = [own, ...definitionsFor(reach, file)].filter(Boolean);

  return shorten(parts.length > 0 ? parts.join('\n\n') : originalSource.trim());
}

// Lazy, so a story file's text is fetched when someone asks for its code and not before.
const STORY_FILES = import.meta.glob<string>('../../../packages/*/src/**/*.stories.tsx', {
  query: '?raw',
  import: 'default',
});

/** The source of the file a story lives in, from the `fileName` Storybook puts in its parameters. */
export async function loadStoryFile(fileName: string): Promise<string | null> {
  const fromPackages = fileName.slice(fileName.indexOf('packages/'));
  const key = Object.keys(STORY_FILES).find((path) => path.endsWith(fromPackages));
  const load = key === undefined ? undefined : STORY_FILES[key];
  if (!load) return null;
  try {
    return await load();
  } catch {
    // The code panel falls back to the story's own source; a failed fetch is not worth an error.
    return null;
  }
}
