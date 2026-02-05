import { z } from "zod";

import { getDemoActorFromRequest } from "@/lib/demo-auth";
import { jsonError } from "@/lib/http";

type ValidationTarget = "body" | "query" | "params" | "header";

type DbErrorCodeMap = {
  status: number;
  code: string;
};

const DB_ERROR_CODE_MAP: Record<string, DbErrorCodeMap> = {
  "22P02": { status: 400, code: "INVALID_TEXT_REPRESENTATION" },
  "23503": { status: 400, code: "FOREIGN_KEY_VIOLATION" },
  "23505": { status: 409, code: "UNIQUE_VIOLATION" },
  "23514": { status: 400, code: "CHECK_VIOLATION" },
  PGRST116: { status: 404, code: "NOT_FOUND" },
};

const uuidSchema = z.string().uuid();

type ParseSuccess<T> = {
  ok: true;
  data: T;
};

type ParseFailure = {
  ok: false;
  response: ReturnType<typeof jsonError>;
};

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export type DbErrorLike = {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

function formatZodIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    code: issue.code,
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export function validationError(target: ValidationTarget, error: z.ZodError) {
  return jsonError(`Invalid ${target}`, {
    status: 400,
    code: `INVALID_${target.toUpperCase()}`,
    details: {
      issues: formatZodIssues(error),
    },
  });
}

export function parseWithSchema<T>(
  value: unknown,
  schema: z.ZodType<T>,
  target: ValidationTarget,
): ParseResult<T> {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    return {
      ok: false,
      response: validationError(target, parsed.error),
    };
  }

  return {
    ok: true,
    data: parsed.data,
  };
}

export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<ParseResult<T>> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return {
      ok: false,
      response: jsonError("Request body must be valid JSON", {
        status: 400,
        code: "INVALID_JSON",
      }),
    };
  }

  return parseWithSchema(payload, schema, "body");
}

export function parseQuery<T>(
  request: Request,
  schema: z.ZodType<T>,
): ParseResult<T> {
  const url = new URL(request.url);
  const queryObject = Object.fromEntries(url.searchParams.entries());
  return parseWithSchema(queryObject, schema, "query");
}

export function requireDemoActorId(request: Request) {
  const actor = getDemoActorFromRequest(request);

  if (!actor.userId) {
    return {
      ok: false as const,
      response: jsonError("A demo actor is required", {
        status: 401,
        code: "DEMO_ACTOR_REQUIRED",
        details: {
          header: "x-demo-user-id",
        },
      }),
    };
  }

  const parsedUserId = uuidSchema.safeParse(actor.userId);
  if (!parsedUserId.success) {
    return {
      ok: false as const,
      response: validationError("header", parsedUserId.error),
    };
  }

  return {
    ok: true as const,
    actorId: parsedUserId.data,
    actorSource: actor.source,
  };
}

export function databaseError(
  message: string,
  error: DbErrorLike,
  fallback?: {
    status?: number;
    code?: string;
  },
) {
  const mapped = error.code ? DB_ERROR_CODE_MAP[error.code] : undefined;

  return jsonError(message, {
    status: mapped?.status ?? fallback?.status ?? 500,
    code: mapped?.code ?? fallback?.code ?? "DB_ERROR",
    details: {
      dbCode: error.code ?? null,
      dbMessage: error.message,
      dbDetails: error.details ?? null,
      dbHint: error.hint ?? null,
    },
  });
}

export function unexpectedError(message: string, error: unknown) {
  return jsonError(message, {
    status: 500,
    code: "UNEXPECTED_ERROR",
    details: {
      reason: error instanceof Error ? error.message : "Unknown error",
    },
  });
}
