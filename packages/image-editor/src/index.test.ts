/**
 * The entry point is the contract a consumer codes against, so its list is pinned: a rename
 * or an accidentally dropped export fails here instead of in someone else's build. Types
 * are erased at runtime and are covered by `pnpm typecheck` instead.
 */
import {describe, expect, it} from 'vitest';

import * as root from './index.js';

describe('public surface', () => {
  it('exports exactly the pinned list', () => {
    expect(Object.keys(root).sort()).toEqual(['DEFAULT_IMAGE_EDITOR_LABELS', 'ImageEditor']);
  });

  it('has an English default for every label', () => {
    const empty = Object.entries(root.DEFAULT_IMAGE_EDITOR_LABELS)
      .filter(([, value]) => {
        const text: unknown = typeof value === 'function' ? value(1, 1) : value;
        return typeof text !== 'string' || text.length === 0;
      })
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });
});
