import react from '@vitejs/plugin-react';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
    emptyOutDir: true,
    lib: {
      entry: {index: 'src/index.ts'},
      formats: ['es'],
    },
    rolldownOptions: {
      // Every bare specifier is a peer. Nothing from node_modules belongs in the output,
      // and cropperjs above all: its custom elements live in one global registry, so the
      // consumer must own the only copy.
      external: (id) => !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0'),
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    testTimeout: 15000,
    hookTimeout: 15000,
    pool: 'forks',
    maxWorkers: process.env.VITEST_MAX_WORKERS ? Number(process.env.VITEST_MAX_WORKERS) : '50%',
    maxConcurrency: 5,
  },
});
