import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

// `loadCropper` remembers its import in module state, so each test takes a fresh copy.
beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.doUnmock('cropperjs');
});

describe('loadCropper', () => {
  it('imports cropperjs once, however often it is asked', async () => {
    const factory = vi.fn(() => ({}));
    vi.doMock('cropperjs', factory);
    const {loadCropper} = await import('./loadCropper.js');
    const first = loadCropper();
    expect(loadCropper()).toBe(first);
    await expect(first).resolves.toBeUndefined();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('forgets a failed import, so the next attempt retries', async () => {
    const factory = vi.fn(() => ({}));
    factory.mockImplementationOnce(() => {
      throw new Error('chunk lost');
    });
    vi.doMock('cropperjs', factory);
    const {loadCropper} = await import('./loadCropper.js');
    // Vitest wraps what a mock factory throws; the original error is the cause.
    await expect(loadCropper()).rejects.toMatchObject({cause: expect.objectContaining({message: 'chunk lost'})});
    await expect(loadCropper()).resolves.toBeUndefined();
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
