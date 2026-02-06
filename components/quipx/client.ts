"use client";

export const DEMO_USER_HEADER = "x-demo-user-id";
const DEMO_USER_STORAGE_KEY = "quipx-demo-user-id";
const FALLBACK_DEMO_USER_ID = "11111111-1111-4111-8111-111111111111";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { message?: string } };

export type FetchState<T> = {
  loading: boolean;
  error: string | null;
  data: T | null;
};

export function getDemoUserId(): string {
  if (typeof window === "undefined") {
    return FALLBACK_DEMO_USER_ID;
  }

  const saved = window.localStorage.getItem(DEMO_USER_STORAGE_KEY)?.trim();
  if (saved && isUuid(saved)) {
    return saved;
  }

  if (saved && !isUuid(saved)) {
    window.localStorage.setItem(DEMO_USER_STORAGE_KEY, FALLBACK_DEMO_USER_ID);
  }

  return FALLBACK_DEMO_USER_ID;
}

export function setDemoUserId(userId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = userId.trim();
  const next = isUuid(normalized) ? normalized : FALLBACK_DEMO_USER_ID;
  window.localStorage.setItem(DEMO_USER_STORAGE_KEY, next);
}

function makeHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  if (!headers.has(DEMO_USER_HEADER)) {
    headers.set(DEMO_USER_HEADER, getDemoUserId());
  }

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

export async function apiFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: makeHeaders(init?.headers),
    cache: "no-store",
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      getEnvelopeError(payload) ?? `Request failed (${response.status})`;
    throw new Error(message);
  }

  if (isApiEnvelope(payload)) {
    if (payload.ok) {
      return payload.data as T;
    }

    throw new Error(payload.error?.message ?? "Request failed");
  }

  return payload as T;
}

function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return "ok" in value;
}

function getEnvelopeError(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return null;
  }

  const candidate = (value as { error?: { message?: unknown } }).error?.message;
  return typeof candidate === "string" ? candidate : null;
}

export function parseString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function parseObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }

  return null;
}

export function parseArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
