import {fileURLToPath} from 'node:url';

import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

// The served page, built as an app: React bundled, the stylesheet linked from index.html
// bundled with it, and every file hashed under assets/. Links are relative (`./assets/…`) and
// the module writes them under its path when it serves the page. Runs after the library
// build, which empties dist/.
export default defineConfig({
  root: here('./src/page'),
  base: './',
  publicDir: false,
  plugins: [react()],
  build: {
    target: 'es2022',
    outDir: here('./dist/ui'),
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
  },
});
