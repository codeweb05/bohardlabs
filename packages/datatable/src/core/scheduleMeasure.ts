const pending = new Set<() => void>();
let timerId: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timerId = null;
  const jobs = [...pending];
  pending.clear();
  for (const job of jobs) job();
}

/**
 * Queues a layout read for the next macrotask, sharing one timer with every other read queued in
 * the same task. A table body mounts hundreds of cells in one commit; with a timer each, every
 * cell's `setState` committed in its own task and dirtied layout for the next cell's read. Flushed
 * together, the reads hit one layout and React batches the updates into a single render.
 *
 * Returns a cancel function, shaped to be returned straight from an effect.
 */
export function scheduleMeasure(job: () => void): () => void {
  pending.add(job);
  timerId ??= setTimeout(flush, 0);
  return () => {
    pending.delete(job);
    // Nothing left to flush, so drop the timer. A test that installs fake timers and swaps them
    // out without running them discards our timer too; without the reset, `timerId` stays set
    // and every later job in that module instance waits for a flush that never comes.
    if (pending.size === 0 && timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };
}
