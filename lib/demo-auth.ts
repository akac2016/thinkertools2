import "server-only";

import { env } from "@/lib/env";

export const DEMO_USER_ID_HEADER = "x-demo-user-id";

export type DemoActor = {
  userId: string | null;
  source: "header" | "default" | "none";
};

export function getDemoActor(headers: Headers): DemoActor {
  const headerValue = headers.get(DEMO_USER_ID_HEADER)?.trim();
  if (headerValue) {
    return { userId: headerValue, source: "header" };
  }

  if (env.DEMO_DEFAULT_USER_ID) {
    return { userId: env.DEMO_DEFAULT_USER_ID, source: "default" };
  }

  return { userId: null, source: "none" };
}

export function getDemoActorFromRequest(request: Request): DemoActor {
  return getDemoActor(request.headers);
}
