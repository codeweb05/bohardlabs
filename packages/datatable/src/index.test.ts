/**
 * The entry points are the contract a consumer codes against, so this list is pinned:
 * a rename or an accidentally dropped export fails here instead of breaking someone
 * else's project after a release.
 *
 * Types are absent on purpose. They are erased at runtime, so a test cannot see them, and
 * `pnpm typecheck` already fails on a type export that stops resolving.
 */
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {describe, expect, it} from 'vitest';

import * as dataTable from './index';
import * as server from './server';

/** Every runtime export of the main entry, alphabetical. Add to this list only with intent. */
const PUBLIC_API = [
  'DEFAULT_HEADER_CASE',
  'DEFAULT_LABELS',
  'DEFAULT_PAGE_SIZE',
  'DEFAULT_PAGE_SIZE_OPTIONS',
  'DEFAULT_STORAGE_PREFIX',
  'DENSITY_CONFIG',
  'DataTable',
  'VIRTUALIZATION_THRESHOLD',
  'getInitialServerState',
  'getTableStateStorageKey',
  'useDataTable',
  'useDataTableContext',
  'useInlineEdit',
  'useTableCore',
  'useTableDensity',
  'useTableEditing',
  'useTableEditingContext',
  'useTableMobile',
  'useTableServerState',
  'useTableUI',
] as const;

/**
 * The React Query-backed subpath. One hook, kept separate so the peer stays optional and
 * so nothing on the main entry can import it by accident.
 */
const SERVER_API = ['useServerSidePagination'] as const;

describe('public API', () => {
  it('exports exactly the documented main surface', () => {
    expect(Object.keys(dataTable).sort()).toEqual([...PUBLIC_API]);
  });

  it('exports exactly the documented server surface', () => {
    expect(Object.keys(server).sort()).toEqual([...SERVER_API]);
  });

  it('does not leak internal components', () => {
    for (const internal of ['ResizeHandle', 'TableHeader', 'TableRow', 'DateFilter', 'ExportMenu', 'ConfirmDialog']) {
      expect(dataTable).not.toHaveProperty(internal);
    }
  });
});

/**
 * Walks the relative-import graph from an entry file and returns every bare specifier it
 * reaches. Crude by design: a regex over source text, no bundler, no resolution of
 * conditional exports. It only has to answer one question, which is whether a package name
 * appears anywhere in the graph at all.
 */
function bareImportsFrom(entry: string): Set<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const seen = new Set<string>();
  const bare = new Set<string>();
  const queue = [resolve(here, entry)];

  while (queue.length > 0) {
    const file = queue.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);

    // Try the extensions this package actually uses, plus the directory's index.
    const candidates = [file, `${file}.ts`, `${file}.tsx`, `${file}/index.ts`, `${file}/index.tsx`];
    const found = candidates.find((candidate) => {
      try {
        readFileSync(candidate);
        return true;
      } catch {
        return false;
      }
    });
    if (!found || (!found.endsWith('.ts') && !found.endsWith('.tsx'))) continue;

    const source = readFileSync(found, 'utf8');
    for (const match of source.matchAll(/from\s+'([^']+)'|import\('([^']+)'\)/g)) {
      const specifier = match[1] ?? match[2];
      if (specifier.startsWith('.')) {
        queue.push(resolve(dirname(found), specifier));
      } else {
        bare.add(specifier);
      }
    }
  }

  return bare;
}

describe('peer isolation', () => {
  /**
   * The reason this test exists: React Query is an optional peer, so an app that never
   * installs it must still be able to `import {DataTable} from '@bohar/datatable'`. One
   * stray import anywhere in the graph turns that into a resolution failure at build time
   * for someone else, and nothing else in the suite would notice.
   */
  it('never reaches React Query from the main entry', () => {
    expect([...bareImportsFrom('./index.ts')]).not.toContain('@tanstack/react-query');
  });

  it('does reach it from the server entry, which is the point of the split', () => {
    expect([...bareImportsFrom('./server.ts')]).toContain('@tanstack/react-query');
  });

  /**
   * `write-excel-file` is the other optional peer. It may only be reached through the
   * dynamic import in the export path, so nothing loads until a user clicks XLSX and an
   * app that never installed it still builds. A type-only import is fine: it is erased.
   */
  it('only reaches write-excel-file through a dynamic import', () => {
    const excel = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'export/excel.ts'), 'utf8');
    expect(excel).not.toMatch(/^import (?!type )[^;]*write-excel-file/m);
    expect(excel).toMatch(/await import\('write-excel-file/);
  });
});
