"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { setActorId } from "@/components/quipx/client";
import { PASSWORD_RULES, getUnmetPasswordRuleLabels } from "@/lib/auth/password-rules";
import { normalizeUsernameInput, validateUsername } from "@/lib/auth/username-rules";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuthMode = "sign-in" | "sign-up";

function normalizeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}

function deriveAccountLabel(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) {
  if (!user) {
    return null;
  }

  const metadata = user.user_metadata ?? {};
  const usernameCandidates = [
    metadata.username,
    metadata.user_name,
    metadata.preferred_username,
  ];

  for (const candidate of usernameCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  if (typeof user.email === "string" && user.email.trim()) {
    return user.email.trim();
  }

  return null;
}

async function fetchUsernameFromProfileApi(accessToken: string): Promise<string | null> {
  const response = await fetch("/api/auth/profile", {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    ok?: boolean;
    data?: { username?: string | null };
  };
  const username = typeof payload?.data?.username === "string" ? payload.data.username.trim() : "";
  return username || null;
}

export function AuthPanel() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [loadingSession, setLoadingSession] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedInLabel, setSignedInLabel] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    const resolveSignedInLabel = async (
      sessionUser: { email?: string | null; user_metadata?: Record<string, unknown> } | null,
      accessToken?: string,
    ) => {
      const metadataLabel = deriveAccountLabel(sessionUser);
      if (!sessionUser) {
        return null;
      }
      if (metadataLabel && metadataLabel !== sessionUser.email) {
        return metadataLabel;
      }
      if (accessToken) {
        const apiUsername = await fetchUsernameFromProfileApi(accessToken);
        if (apiUsername) {
          return apiUsername;
        }
      }

      return metadataLabel;
    };

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) {
        return;
      }

      const session = data.session ?? null;
      const sessionUser = session?.user ?? null;
      const label = await resolveSignedInLabel(sessionUser, session?.access_token);
      if (!active) {
        return;
      }
      setSignedInLabel(label);
      setActorId(sessionUser?.id ?? null);
      setLoadingSession(false);
    };

    void syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      void resolveSignedInLabel(sessionUser, session?.access_token).then((label) => {
        if (!active) {
          return;
        }
        setSignedInLabel(label);
      });
      setActorId(sessionUser?.id ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }

      if (!menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  const onAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const trimmedEmail = email.trim();
      const normalizedUsername = normalizeUsernameInput(username);
      const normalizedPassword = password.trim();

      if (!trimmedEmail || !normalizedPassword) {
        setError("Email and password are required.");
        return;
      }

      if (mode === "sign-up") {
        const usernameValidation = validateUsername(normalizedUsername);
        if (!usernameValidation.ok) {
          setError(usernameValidation.message);
          return;
        }

        const unmetRules = getUnmetPasswordRuleLabels(normalizedPassword);
        if (unmetRules.length > 0) {
          setError(`Password requirements: ${unmetRules.join(", ")}.`);
          return;
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password: normalizedPassword,
          options: {
            data: {
              username: usernameValidation.username,
              full_name: usernameValidation.username,
            },
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        if (data.session) {
          setMessage("Account created and signed in.");
        } else {
          setMessage("Account created. Check your email for a confirmation link.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: normalizedPassword,
        });

        if (signInError) {
          throw signInError;
        }

        setMessage("Signed in.");
      }
    } catch (authError) {
      setError(normalizeErrorMessage(authError, "Authentication failed."));
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        throw signOutError;
      }

      setMessage("Signed out.");
    } catch (signOutError) {
      setError(normalizeErrorMessage(signOutError, "Sign out failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm"
      >
        {loadingSession ? "Loading..." : signedInLabel ?? "Account"}
        <span className="ml-2 text-xs text-slate-500">▾</span>
      </button>
      {isOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          {signedInLabel ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Signed in
              </p>
              <p className="mt-1 truncate text-sm font-medium text-slate-900">{signedInLabel}</p>
              <button
                type="button"
                onClick={onSignOut}
                disabled={busy}
                className="mt-3 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {busy ? "Signing out..." : "Sign out"}
              </button>
            </>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode("sign-in")}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${
                    mode === "sign-in" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setMode("sign-up")}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${
                    mode === "sign-up" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Sign up
                </button>
                <Link href="/" className="ml-auto text-xs text-slate-500 hover:text-slate-700">
                  Home
                </Link>
              </div>
              <form onSubmit={onAuthSubmit}>
                <label className="mb-2 block text-xs text-slate-700">
                  <span className="mb-1 block font-medium">Email</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                {mode === "sign-up" ? (
                  <label className="mb-2 block text-xs text-slate-700">
                    <span className="mb-1 block font-medium">Username</span>
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={32}
                      autoComplete="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                    />
                    <span className="mt-1 block text-[11px] text-slate-500">
                      3-32 chars. Use lowercase letters, numbers, dots, underscores, or hyphens.
                    </span>
                  </label>
                ) : null}
                <label className="mb-3 block text-xs text-slate-700">
                  <span className="mb-1 block font-medium">Password</span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                {mode === "sign-up" ? (
                  <ul className="mb-3 space-y-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
                    {PASSWORD_RULES.map((rule) => {
                      const met = rule.test(password);
                      return (
                        <li
                          key={rule.id}
                          className={`text-[11px] ${met ? "text-emerald-700" : "text-slate-600"}`}
                        >
                          {met ? "✓" : "•"} {rule.label}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  {busy ? "Working..." : mode === "sign-up" ? "Create account" : "Sign in"}
                </button>
              </form>
            </>
          )}
          {message ? <p className="mt-2 text-xs text-emerald-700">{message}</p> : null}
          {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
