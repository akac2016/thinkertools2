type InMemoryRateLimitEntry = {
  count: number;
  resetAtMs: number;
};

type InMemoryRateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
  nowMs?: number;
};

type InMemoryRateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAtMs: number;
};

const store = new Map<string, InMemoryRateLimitEntry>();

function pruneExpired(nowMs: number) {
  for (const [key, entry] of store.entries()) {
    if (entry.resetAtMs <= nowMs) {
      store.delete(key);
    }
  }
}

export function takeInMemoryRateLimit(input: InMemoryRateLimitInput): InMemoryRateLimitResult {
  const nowMs = input.nowMs ?? Date.now();

  if (store.size > 5000) {
    pruneExpired(nowMs);
  }

  const existing = store.get(input.key);
  if (!existing || existing.resetAtMs <= nowMs) {
    const resetAtMs = nowMs + input.windowMs;
    store.set(input.key, { count: 1, resetAtMs });

    return {
      allowed: true,
      remaining: Math.max(0, input.limit - 1),
      retryAfterSeconds: Math.max(1, Math.ceil(input.windowMs / 1000)),
      resetAtMs,
    };
  }

  if (existing.count >= input.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1000)),
      resetAtMs: existing.resetAtMs,
    };
  }

  existing.count += 1;
  store.set(input.key, existing);

  return {
    allowed: true,
    remaining: Math.max(0, input.limit - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1000)),
    resetAtMs: existing.resetAtMs,
  };
}
