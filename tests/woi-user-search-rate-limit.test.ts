import assert from "node:assert/strict";
import test from "node:test";

import { takeInMemoryRateLimit } from "../lib/api/in-memory-rate-limit.ts";

test("rate limiter allows requests under the limit", () => {
  const windowMs = 60_000;
  const now = 1_700_000_000_000;
  const key = `woi-user-search-${now}-allow`;

  const first = takeInMemoryRateLimit({
    key,
    limit: 2,
    windowMs,
    nowMs: now,
  });
  const second = takeInMemoryRateLimit({
    key,
    limit: 2,
    windowMs,
    nowMs: now + 10,
  });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);
});

test("rate limiter blocks requests beyond the limit and resets after the window", () => {
  const windowMs = 5_000;
  const now = 1_700_000_100_000;
  const key = `woi-user-search-${now}-block`;

  takeInMemoryRateLimit({
    key,
    limit: 1,
    windowMs,
    nowMs: now,
  });

  const blocked = takeInMemoryRateLimit({
    key,
    limit: 1,
    windowMs,
    nowMs: now + 10,
  });

  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSeconds >= 1);

  const reset = takeInMemoryRateLimit({
    key,
    limit: 1,
    windowMs,
    nowMs: now + windowMs + 1,
  });
  assert.equal(reset.allowed, true);
});
