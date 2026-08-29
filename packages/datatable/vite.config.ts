import react from '@vitejs/plugin-react';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  // The table's components are written against the React Compiler: several of them read a
  // derived signature out of context purely so the compiler invalidates their cached
  // output (see the comments in `core/TableHeader.tsx`). Tests that run without it
  // observe a different number of renders, so the plugin is not optional here.
  plugins: [react({babel: {plugins: ['babel-plugin-react-compiler']}})],
  build: {
    target: 'es2022',
    sourcemap: true,
    emptyOutDir: true,
    lib: {
      entry: {index: 'src/index.ts', server: 'src/server.ts'},
      formats: ['es'],
    },
    rollupOptions: {
      // Every bare specifier is a peer or an optional peer. Nothing from node_modules
      // belongs in the output.
      external: (id) => !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0'),
      output: {
        // One output module per source module rather than one rolled-up chunk, so a
        // consumer's bundler can drop the parts of the table they never import (the
        // export menu, the mobile card view).
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
    // A 50-row render plus a few MUI transition cycles takes well under a second alone
    // and several times that when 52 files compete for the CPU. The 5s default turns
    // that contention into failures on tests that pass in isolation.
    testTimeout: 15000,
    hookTimeout: 15000,
    // One jsdom worker per core costs ~400MB each and starves the rest; half the cores
    // keeps the suite deterministic on a laptop and still uses a big machine.
    pool: 'forks',
    maxWorkers: process.env.VITEST_MAX_WORKERS ? Number(process.env.VITEST_MAX_WORKERS) : '50%',
    maxConcurrency: 5,
  },
});
