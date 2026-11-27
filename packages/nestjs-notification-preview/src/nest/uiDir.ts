import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

/**
 * Where the prebuilt page sits: `dist/ui`, beside this file's `dist/nest` once built. The tests
 * point it at a fixture instead. Written with `join` rather than `new URL('../ui/', …)`, which
 * Vite's build would try to resolve as an asset of its own.
 */
export const UI_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'ui');
