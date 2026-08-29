import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {scheduleMeasure} from './scheduleMeasure';

/**
 * Every truncating cell measures itself once after mount. One timer per cell (600 at 50x12)
 * let each cell's `setState` commit in its own macrotask, and each commit invalidated layout
 * for the next cell's `scrollWidth` read. The queue puts every read of a task behind one
 * timer, so React batches the resulting updates into a single render.
 */
describe('scheduleMeasure', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    // Before `useRealTimers`: the `setTimeout` spy wraps the fake, and restoring it afterwards
    // would put the dead fake back on the global.
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('runs every job queued in the same task from a single timer', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const jobs = Array.from({length: 600}, () => vi.fn());

    for (const job of jobs) scheduleMeasure(job);

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    for (const job of jobs) expect(job).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    for (const job of jobs) expect(job).toHaveBeenCalledTimes(1);
  });

  it('skips a job cancelled before the flush and still runs the rest', () => {
    const kept = vi.fn();
    const cancelled = vi.fn();

    scheduleMeasure(kept);
    const cancel = scheduleMeasure(cancelled);
    cancel();
    vi.runOnlyPendingTimers();

    expect(kept).toHaveBeenCalledTimes(1);
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('defers a job queued during a flush to the next timer', () => {
    const late = vi.fn();
    scheduleMeasure(() => {
      scheduleMeasure(late);
    });

    vi.runOnlyPendingTimers();
    expect(late).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('still runs a job after a fake timer was discarded without running', async () => {
    // A consumer test renders under fake timers, unmounts, and restores real timers without
    // flushing. The unmount cancels the queued job; the next job must arm a real timer.
    const cancel = scheduleMeasure(vi.fn());
    cancel();
    vi.useRealTimers();

    const job = vi.fn();
    scheduleMeasure(job);
    await vi.waitFor(() => expect(job).toHaveBeenCalledTimes(1));

    vi.useFakeTimers();
  });

  it('arms a fresh timer for jobs queued after a flush', () => {
    const first = vi.fn();
    const second = vi.fn();

    scheduleMeasure(first);
    vi.runOnlyPendingTimers();
    scheduleMeasure(second);
    vi.runOnlyPendingTimers();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
