/**
 * Serializes async writes so that the most recently queued value is the last one
 * applied.
 *
 * This exists because of a specific failure. The cart's writes are absolute
 * upserts of the whole set rather than increments, which makes them idempotent —
 * and also means last-arrival wins. Two overlapping writes can therefore land in
 * the wrong order and leave the server holding an older state than the shopper
 * last chose, with nothing to correct it: the next poll reads that older state
 * back and treats it as the truth. The cart silently reverts. A single request
 * that takes longer than the debounce window is enough to cause it, which on a
 * phone is not an unusual thing.
 *
 * The fix is to never have two writes in flight. A value submitted while one is
 * running replaces whatever was queued — so a burst of edits collapses to the
 * final state rather than replaying every intermediate one — and is sent as soon
 * as the running write settles.
 *
 * Pure and framework-free, so both the website and the Expo app use this one and
 * `tests/write-queue.test.ts` can prove the ordering without a React renderer.
 */
export type WriteQueue<T> = {
  /**
   * Queues a value to be written. Returns immediately; the write happens once any
   * in-flight write has settled.
   */
  submit: (value: T) => void;
  /** Resolves when nothing is in flight and nothing is queued. */
  idle: () => Promise<void>;
  /** Discards anything queued. Does not cancel a write already running. */
  reset: () => void;
};

export function createWriteQueue<T>(
  send: (value: T) => Promise<void>,
  onError: (error: unknown) => void,
): WriteQueue<T> {
  let inFlight = false;
  let queued: { value: T } | null = null;
  let running: Promise<void> | null = null;

  async function drain(): Promise<void> {
    try {
      while (queued !== null) {
        const next = queued.value;
        queued = null;
        await send(next);
      }
    } catch (error) {
      // One failed write abandons the rest of the batch. The caller's recovery is
      // to re-read the server, which is the state that actually matters; retrying
      // the queued values here could apply them on top of a state nobody has seen.
      queued = null;
      onError(error);
    } finally {
      inFlight = false;
      running = null;
    }
  }

  return {
    submit(value: T) {
      queued = { value };
      if (inFlight) return;

      inFlight = true;
      running = drain();
    },
    idle() {
      return running ?? Promise.resolve();
    },
    reset() {
      queued = null;
    },
  };
}