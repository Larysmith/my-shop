import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveProvider } from "../src/lib/server/email/config";
import {
  HttpStatusError,
  isRetryableStatus,
  postWithRetry,
} from "../src/lib/server/email/provider";

describe("resolveProvider", () => {
  it("refuses to guess when EMAIL_PROVIDER is unset", () => {
    // Guessing could send real customer email from an unintended account.
    assert.throws(() => resolveProvider({}), /EMAIL_PROVIDER/);
  });

  it("treats none as an explicit off switch rather than an error", () => {
    assert.equal(resolveProvider({ EMAIL_PROVIDER: "none" }), null);
    assert.equal(resolveProvider({ EMAIL_PROVIDER: "NONE" }), null);
  });

  it("selects each provider and its own sender variable", () => {
    const brevo = resolveProvider({
      EMAIL_PROVIDER: "brevo",
      BREVO_FROM_NAME: "Lary Shop",
    });
    assert.equal(brevo?.name, "Brevo");
    assert.equal(brevo?.fromEmailVariable, "BREVO_FROM_EMAIL");
    assert.equal(brevo?.fromName, "Lary Shop");

    const mailgun = resolveProvider({
      EMAIL_PROVIDER: "mailgun",
      MAILGUN_FROM_NAME: "Lary Shop",
    });
    assert.equal(mailgun?.name, "Mailgun");
    assert.equal(mailgun?.fromEmailVariable, "MAILGUN_FROM_EMAIL");
  });

  it("is case and whitespace insensitive", () => {
    const resolved = resolveProvider({ EMAIL_PROVIDER: "  Mailgun " });
    assert.equal(resolved?.name, "Mailgun");
  });

  it("rejects an unknown provider instead of falling back", () => {
    assert.throws(
      () => resolveProvider({ EMAIL_PROVIDER: "sendgrid" }),
      /not a known provider/,
    );
  });
});

describe("isRetryableStatus", () => {
  it("repeats rate limits and server faults but not client mistakes", () => {
    assert.equal(isRetryableStatus(429), true);
    assert.equal(isRetryableStatus(500), true);
    assert.equal(isRetryableStatus(503), true);
    // A 400 or 401 means the request itself is wrong; repeating it only delays
    // the failure row.
    assert.equal(isRetryableStatus(400), false);
    assert.equal(isRetryableStatus(401), false);
    assert.equal(isRetryableStatus(422), false);
  });
});

describe("postWithRetry", () => {
  it("returns the first successful response without retrying", async () => {
    let calls = 0;
    const response = await postWithRetry({
      label: "test",
      idempotencyKey: "key",
      send: async () => {
        calls += 1;
        return new Response("{}", { status: 200 });
      },
    });

    assert.equal(response.status, 200);
    assert.equal(calls, 1);
  });

  it("retries a 429 and succeeds", async () => {
    let calls = 0;
    const response = await postWithRetry({
      label: "test",
      idempotencyKey: "key",
      send: async () => {
        calls += 1;
        return calls < 3
          ? new Response("rate limited", { status: 429 })
          : new Response("{}", { status: 200 });
      },
    });

    assert.equal(response.status, 200);
    assert.equal(calls, 3);
  });

  it("gives up immediately on a non-retryable status", async () => {
    let calls = 0;
    await assert.rejects(
      postWithRetry({
        label: "test",
        idempotencyKey: "key",
        send: async () => {
          calls += 1;
          return new Response("bad request", { status: 400 });
        },
      }),
      (error: unknown) => error instanceof HttpStatusError && error.status === 400,
    );
    assert.equal(calls, 1);
  });

  it("does not retry a transport failure when the provider cannot de-duplicate", async () => {
    // The Mailgun case: an ambiguous timeout must not become a second email.
    let calls = 0;
    await assert.rejects(
      postWithRetry({
        label: "test",
        idempotencyKey: "",
        retryOnTransportError: false,
        send: async () => {
          calls += 1;
          throw new Error("socket hang up");
        },
      }),
      /transport error/,
    );
    assert.equal(calls, 1);
  });

  it("retries a transport failure when the provider de-duplicates by key", async () => {
    // The Brevo case: Idempotency-Key makes the retry safe.
    let calls = 0;
    const response = await postWithRetry({
      label: "test",
      idempotencyKey: "key",
      retryOnTransportError: true,
      send: async () => {
        calls += 1;
        if (calls < 2) throw new Error("socket hang up");
        return new Response("{}", { status: 200 });
      },
    });

    assert.equal(response.status, 200);
    assert.equal(calls, 2);
  });

  it("respects a caller-supplied retry policy", async () => {
    // Mailgun retries only 429: a 5xx may already have been queued.
    let calls = 0;
    await assert.rejects(
      postWithRetry({
        label: "test",
        idempotencyKey: "",
        isRetryable: (status) => status === 429,
        retryOnTransportError: false,
        send: async () => {
          calls += 1;
          return new Response("boom", { status: 500 });
        },
      }),
      HttpStatusError,
    );
    assert.equal(calls, 1);
  });
});