/**
 * The entry point is the contract a consumer codes against, so its list is pinned: a rename
 * or an accidentally dropped export fails here instead of in someone else's build. Types
 * are erased at runtime and are covered by `pnpm typecheck` instead.
 */
import {describe, expect, it} from 'vitest';

import * as root from './index.js';

describe('public surface', () => {
  it('exports exactly the pinned list', () => {
    expect(Object.keys(root).sort()).toEqual([
      'InvalidValuesError',
      'UnregisteredNotificationError',
      'createNotificationPreview',
    ]);
  });
});
