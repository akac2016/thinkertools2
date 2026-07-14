import "server-only";

import type { PostgrestError, User } from "@supabase/supabase-js";
import { z } from "zod";

import { getDemoActorFromRequest } from "@/lib/demo-auth";
import { jsonError } from "@/lib/http";
import { validateUsername } from "@/lib/auth/username-rules";
import { supabaseAdmin } from "@/lib/supabase/admin";

const uuidSchema = z.string().uuid();
const bearerTokenRegex = /^Bearer\s+(.+)$/i;

type RequiredActorSuccess = {
  ok: true;
  actorId: string;
  actorSource: "supabase" | "header" | "default";
};

type RequiredActorFailure = {
  ok: false;
  response: ReturnType<typeof jsonError>;
};

function parseBearerToken(headers: Headers): string | null {
  const authorization = headers.get("authorization")?.trim();
  if (!authorization) {
    return null;
  }

  const matched = authorization.match(bearerTokenRegex);
  if (!matched) {
    return null;
  }

  const token = matched[1]?.trim();
  return token ? token : null;
}

function deriveAuthUsername(user: User): string {
  const metadata = user.user_metadata ?? {};
  const candidateValues = [
    metadata.username,
    metadata.user_name,
    metadata.preferred_username,
  ];

  for (const candidate of candidateValues) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

function deriveDisplayName(user: User, username: string): string {
  const metadata = user.user_metadata ?? {};
  const candidateNames = [
    metadata.full_name,
    metadata.name,
    metadata.display_name,
    username,
  ];

  for (const candidate of candidateNames) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim().slice(0, 120);
    }
  }

  return "Thinkertools User";
}

type EnsureAppUserResult =
  | { ok: true }
  | {
      ok: false;
      code: "USERNAME_INVALID";
      message: string;
    }
  | {
      ok: false;
      code: "USERNAME_TAKEN";
      message: string;
    }
  | {
      ok: false;
      code: "DB_ERROR";
      error: PostgrestError;
    };

async function ensureAppUserFromAuthUser(user: User): Promise<EnsureAppUserResult> {
  let usernameValidation = validateUsername(deriveAuthUsername(user));

  if (!usernameValidation.ok) {
    const { data: existingUser, error: existingUserError } = await supabaseAdmin
      .from("users")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();

    if (existingUserError) {
      return {
        ok: false,
        code: "DB_ERROR",
        error: existingUserError,
      };
    }

    usernameValidation = validateUsername(
      typeof existingUser?.username === "string" ? existingUser.username : "",
    );
    if (!usernameValidation.ok) {
      return {
        ok: false,
        code: "USERNAME_INVALID",
        message: usernameValidation.message,
      };
    }
  }

  const { error } = await supabaseAdmin.from("users").upsert(
    {
      id: user.id,
      username: usernameValidation.username,
      name: deriveDisplayName(user, usernameValidation.username),
      email: user.email ?? null,
    },
    {
      onConflict: "id",
    },
  );

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        code: "USERNAME_TAKEN",
        message: "Username is already taken.",
      };
    }

    return {
      ok: false,
      code: "DB_ERROR",
      error,
    };
  }

  return { ok: true };
}

async function resolveSupabaseActor(request: Request): Promise<RequiredActorSuccess | RequiredActorFailure | null> {
  const token = parseBearerToken(request.headers);
  if (!token) {
    return null;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return {
      ok: false,
      response: jsonError("Invalid or expired auth token", {
        status: 401,
        code: "AUTH_INVALID",
      }),
    };
  }

  const parsedUserId = uuidSchema.safeParse(data.user.id);
  if (!parsedUserId.success) {
    return {
      ok: false,
      response: jsonError("Invalid authenticated user id", {
        status: 500,
        code: "AUTH_USER_ID_INVALID",
        details: parsedUserId.error.flatten(),
      }),
    };
  }

  const ensuredUser = await ensureAppUserFromAuthUser(data.user);
  if (!ensuredUser.ok && ensuredUser.code === "USERNAME_INVALID") {
    return {
      ok: false,
      response: jsonError("A valid username is required for this account", {
        status: 400,
        code: "AUTH_USERNAME_INVALID",
        details: {
          message: ensuredUser.message,
        },
      }),
    };
  }

  if (!ensuredUser.ok && ensuredUser.code === "USERNAME_TAKEN") {
    return {
      ok: false,
      response: jsonError("Username is already taken", {
        status: 409,
        code: "AUTH_USERNAME_TAKEN",
      }),
    };
  }

  if (!ensuredUser.ok && ensuredUser.code === "DB_ERROR") {
    return {
      ok: false,
      response: jsonError("Failed to sync authenticated user profile", {
        status: 500,
        code: "AUTH_PROFILE_SYNC_FAILED",
        details: {
          dbCode: ensuredUser.error.code ?? null,
          dbMessage: ensuredUser.error.message,
          dbDetails: ensuredUser.error.details ?? null,
          dbHint: ensuredUser.error.hint ?? null,
        },
      }),
    };
  }

  return {
    ok: true,
    actorId: parsedUserId.data,
    actorSource: "supabase",
  };
}

async function resolveLegacyActor(request: Request): Promise<RequiredActorSuccess | RequiredActorFailure> {
  const actor = getDemoActorFromRequest(request);

  if (!actor.userId) {
    return {
      ok: false,
      response: jsonError("Authentication is required", {
        status: 401,
        code: "AUTH_REQUIRED",
        details: {
          header: "authorization",
          legacyHeader: "x-demo-user-id",
        },
      }),
    };
  }

  const parsedUserId = uuidSchema.safeParse(actor.userId);
  if (!parsedUserId.success) {
    return {
      ok: false,
      response: jsonError("Invalid actor id", {
        status: 400,
        code: "INVALID_ACTOR_ID",
        details: parsedUserId.error.flatten(),
      }),
    };
  }

  return {
    ok: true,
    actorId: parsedUserId.data,
    actorSource: actor.source === "header" ? "header" : "default",
  };
}

export async function requireActorIdFromRequest(
  request: Request,
): Promise<RequiredActorSuccess | RequiredActorFailure> {
  const supabaseActor = await resolveSupabaseActor(request);
  if (supabaseActor) {
    return supabaseActor;
  }

  return resolveLegacyActor(request);
}

export async function getOptionalActorIdFromRequest(request: Request): Promise<string | null> {
  const actor = await requireActorIdFromRequest(request);
  if (!actor.ok) {
    return null;
  }

  return actor.actorId;
}
