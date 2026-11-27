// @vitest-environment node
/**
 * The root entry is the contract an app codes against: the core and the Nest module. Its list is
 * pinned, so a rename or a dropped export fails here instead of in someone else's build.
 */
import {describe, expect, it} from 'vitest';

import * as root from './index.js';

describe('root entry', () => {
  it('exports exactly the pinned list', () => {
    expect(Object.keys(root).sort()).toEqual([
      'InvalidValuesError',
      'NotificationPreviewModule',
      'UnregisteredNotificationError',
      'createNotificationPreview',
    ]);
  });
});
