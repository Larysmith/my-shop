import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createWriteQueue } from "../src/lib/cart/write-queue";

/**
 * Regression tests for the write-ordering bug.
 *
 * The cart's writes are absolute upserts of the whole set, so last-arrival wins.
 * Two overlapping writes landing out of order left the server holding an older
 * cart than the shopper last chose, and nothing corrected it: the next poll read
 * that older cart back and adopted it as the truth, so the cart silently
 * reverted. These tests pin the ordering that prevents it.
 */

/** A promise plus the handles to settle it, for simulating a slow request. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createWriteQueue", () => {
  it("applies a single submitted value", async () => {
    const sent: number[] = [];
    const queue = createWriteQueue<number>(
      async (value) => {
        sent.push(value);
      },
      () => {},
    );

    queue.submit(1);
    await queue.idle();

    assert.deepEqual(sent, [1]);
  });

  it("never runs two writes at once", async () => {
    let concurrent = 0;
    let peak = 0;

    const queue = createWriteQueue<number>(
      async () => {
        concurrent += 1;
        peak = Math.max(peak, concurrent);
        await new Promise((resolve) => setTimeout(resolve, 5));
        concurrent -= 1;
      },
      () => {},
    );

    queue.submit(1);
    queue.submit(2);
    queue.submit(3);
    await queue.idle();

    assert.equal(peak, 1);
  });

  it("keeps the newest value last even when the first write is the slow one", async () => {
    // The bug: write A hangs, write B completes, then A lands and overwrites B.
    const sent: string[] = [];
    const first = deferred<void>();

    const queue = createWriteQueue<string>(
      async (value) => {
        sent.push(`start:${value}`);
        if (value === "A") {
          // The shopper changes their mind twice while this is still in flight.
          await first.promise;
        }
        sent.push(`done:${value}`);
      },
      () => {},
    );

    queue.submit("A");
    // Let A actually reach its await before queueing the newer values.
    await new Promise((resolve) => setTimeout(resolve, 0));

    queue.submit("B");
    queue.submit("C");
    first.resolve();
    await queue.idle();

    // The order that matters: A completes, then the newest value. C is what the
    // server ends up holding, never B and never a replay of A.
    assert.deepEqual(sent, ["start:A", "done:A", "start:C", "done:C"]);
  });

  it("collapses a burst into the final value rather than replaying each one", async () => {
    const sent: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const queue = createWriteQueue<number>(
      async (value) => {
        sent.push(value);
        if (sent.length === 1) await gate;
      },
      () => {},
    );

    queue.submit(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    queue.submit(2);
    queue.submit(3);
    queue.submit(4);
    release();
    await queue.idle();

    assert.deepEqual(sent, [1, 4]);
  });

  it("reports a failure and abandons the rest of the batch", async () => {
    const sent: number[] = [];
    const errors: unknown[] = [];

    const queue = createWriteQueue<number>(
      async (value) => {
        sent.push(value);
        if (value === 1) throw new Error("network");
      },
      (error) => errors.push(error),
    );

    queue.submit(1);
    queue.submit(2);
    await queue.idle();

    // 2 is dropped rather than written: it was composed against a state the failed
    // write never reached, so applying it could resurrect a change the shopper has
    // already seen corrected. The caller's recovery is to re-read the server.
    assert.deepEqual(sent, [1]);
    assert.equal(errors.length, 1);
    assert.match(String((errors[0] as Error).message), /network/);
  });

  it("keeps working after a failure", async () => {
    let shouldFail = true;
    const sent: number[] = [];

    const queue = createWriteQueue<number>(
      async (value) => {
        sent.push(value);
        if (shouldFail) {
          shouldFail = false;
          throw new Error("transient");
        }
      },
      () => {},
    );

    queue.submit(1);
    await queue.idle();
    queue.submit(2);
    await queue.idle();

    assert.deepEqual(sent, [1, 2]);
  });

  it("drops what is queued on reset, without cancelling the write already running", async () => {
    const sent: number[] = [];
    const gate = deferred<void>();

    const queue = createWriteQueue<number>(
      async (value) => {
        sent.push(value);
        if (value === 1) await gate.promise;
      },
      () => {},
    );

    queue.submit(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    queue.submit(2);
    queue.reset();
    gate.resolve();
    await queue.idle();

    assert.deepEqual(sent, [1]);
  });

  it("resolves idle() immediately when nothing was ever submitted", async () => {
    const queue = createWriteQueue<number>(async () => {}, () => {});
    await queue.idle();
  });
});