import '@testing-library/jest-dom/vitest';
import {cleanup} from '@testing-library/react';
import {afterEach, vi} from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // The Nest tests run in node, which has no browser storage.
  if (typeof localStorage !== 'undefined') localStorage.clear();
});
