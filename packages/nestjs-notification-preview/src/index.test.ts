// @vitest-environment node
/**
 * The root entry is the contract an app codes against: the core and the Nest module. Its list is
 * pinned, so a rename or a dropped export fails here instead of in someone else's build.
 */
import {describe, expect, expectTypeOf, it} from 'vitest';

import * as root from './index.js';
import type {PageMount} from './index.js';

describe('root entry', () => {
  it('exports exactly the pinned list', () => {
    expect(Object.keys(root).sort()).toEqual([
      'InvalidValuesError',
      'NotificationPreviewModule',
      'UnregisteredNotificationError',
      'createNotificationPreview',
    ]);
  });

  it("exports the module constructor's parameter as the type PageMount", () => {
    expectTypeOf<ConstructorParameters<typeof root.NotificationPreviewModule>[0]>().toEqualTypeOf<PageMount | null>();
  });
});
