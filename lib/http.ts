import { NextResponse } from "next/server";

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiError = {
  ok: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
};

type JsonErrorOptions = ResponseInit & {
  code?: string;
  details?: unknown;
};

export function jsonSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ ok: true, data }, init);
}

export function jsonError(message: string, options?: JsonErrorOptions) {
  const status = options?.status ?? 500;

  return NextResponse.json<ApiError>(
    {
      ok: false,
      error: {
        message,
        ...(options?.code ? { code: options.code } : {}),
        ...(options?.details !== undefined ? { details: options.details } : {}),
      },
    },
    {
      ...options,
      status,
    },
  );
}
