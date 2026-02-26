"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export const ACTOR_ID_STORAGE_KEY = "tt-auth-actor-id";
export const WOI_ANON_SESSION_ID_STORAGE_KEY = "woi-anon-session-id";
export const WOI_ANON_SESSION_ID_HEADER = "x-woi-anon-session-id";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ANON_SESSION_PATTERN = /^[A-Za-z0-9_-]{8,120}$/;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { message?: string; code?: string; details?: unknown } };

export class ApiRequestError extends Error {
  status: number;
  code: string | null;
  details: unknown;

  constructor(input: {
    message: string;
    status?: number;
    code?: string | null;
    details?: unknown;
  }) {
    super(input.message);
    this.name = "ApiRequestError";
    this.status = input.status ?? 500;
    this.code = input.code ?? null;
    this.details = input.details;
  }
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

export type FetchState<T> = {
  loading: boolean;
  error: string | null;
  data: T | null;
};

export function getDemoUserId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const saved = window.localStorage.getItem(ACTOR_ID_STORAGE_KEY)?.trim();
  if (saved && isUuid(saved)) {
    return saved;
  }

  return "";
}

export function setDemoUserId(userId: string) {
  setActorId(userId);
}

export function setActorId(userId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = userId?.trim() ?? "";
  if (!normalized) {
    window.localStorage.removeItem(ACTOR_ID_STORAGE_KEY);
    return;
  }

  if (isUuid(normalized)) {
    window.localStorage.setItem(ACTOR_ID_STORAGE_KEY, normalized);
  }
}

export function getWoiAnonSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage
    .getItem(WOI_ANON_SESSION_ID_STORAGE_KEY)
    ?.trim();
  if (!stored || !ANON_SESSION_PATTERN.test(stored)) {
    return null;
  }

  return stored;
}

export function setWoiAnonSessionId(sessionId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = sessionId?.trim() ?? "";
  if (!normalized) {
    window.localStorage.removeItem(WOI_ANON_SESSION_ID_STORAGE_KEY);
    return;
  }

  if (ANON_SESSION_PATTERN.test(normalized)) {
    window.localStorage.setItem(WOI_ANON_SESSION_ID_STORAGE_KEY, normalized);
  }
}

async function makeHeaders(init?: RequestInit): Promise<Headers> {
  const headers = new Headers(init?.headers);

  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const actorId = session?.user?.id ?? null;
  setActorId(actorId);

  if (session?.access_token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const method = init?.method?.toUpperCase() ?? "GET";
  const shouldSetJsonContentType =
    method !== "GET" &&
    method !== "HEAD" &&
    init?.body !== undefined &&
    !headers.has("Content-Type");

  if (shouldSetJsonContentType) {
    headers.set("Content-Type", "application/json");
  }

  const anonSessionId = getWoiAnonSessionId();
  if (anonSessionId && !headers.has(WOI_ANON_SESSION_ID_HEADER)) {
    headers.set(WOI_ANON_SESSION_ID_HEADER, anonSessionId);
  }

  return headers;
}

export async function apiFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const headers = await makeHeaders(init);

  const response = await fetch(input, {
    ...init,
    headers,
    cache: "no-store",
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const envelopeError = getEnvelopeError(payload);
    throw new ApiRequestError({
      message: envelopeError?.message ?? `Request failed (${response.status})`,
      status: response.status,
      code: envelopeError?.code ?? null,
      details: envelopeError?.details,
    });
  }

  if (isApiEnvelope(payload)) {
    if (payload.ok) {
      return payload.data as T;
    }

    throw new ApiRequestError({
      message: payload.error?.message ?? "Request failed",
      status: response.status,
      code: payload.error?.code ?? null,
      details: payload.error?.details,
    });
  }

  return payload as T;
}

function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return "ok" in value;
}

function getEnvelopeError(value: unknown): {
  message: string | null;
  code: string | null;
  details: unknown;
} | null {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return null;
  }

  const error = (value as {
    error?: {
      message?: unknown;
      code?: unknown;
      details?: unknown;
    };
  }).error;

  const candidateMessage = error?.message;
  const candidateCode = error?.code;

  return {
    message: typeof candidateMessage === "string" ? candidateMessage : null,
    code: typeof candidateCode === "string" ? candidateCode : null,
    details: error?.details,
  };
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
