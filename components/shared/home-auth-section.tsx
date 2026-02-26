"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { setActorId } from "@/components/quipx/client";
import { PASSWORD_RULES, getUnmetPasswordRuleLabels } from "@/lib/auth/password-rules";
import { normalizeUsernameInput, validateUsername } from "@/lib/auth/username-rules";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type HomeAuthSectionProps = {
  loginHeadClassName: string;
  loginTitleClassName: string;
  loginHintClassName: string;
};

export function HomeAuthSection({
  loginHeadClassName,
  loginTitleClassName,
  loginHintClassName,
}: HomeAuthSectionProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function normalizeErrorMessage(value: unknown, fallback: string) {
    if (value instanceof Error && value.message.trim()) {
      return value.message.trim();
    }

    return fallback;
  }

  useEffect(() => {
    let active = true;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) {
        return;
      }

      const sessionUser = data.session?.user ?? null;
      setSignedInEmail(sessionUser?.email ?? null);
      setActorId(sessionUser?.id ?? null);
    };

    void syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setSignedInEmail(sessionUser?.email ?? null);
      setActorId(sessionUser?.id ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

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

        setMessage(
          data.session
            ? "Account created and signed in."
            : "Account created. Check your email for confirmation.",
        );
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
    <div id="account" className={loginHeadClassName}>
      {!signedInEmail ? (
        <>
          <div className={loginTitleClassName}>Log in to get started</div>
          <div className={loginHintClassName}>
            Create an account or sign in below. No extra clicks required.
          </div>
          <form onSubmit={onAuthSubmit} className="mt-4 space-y-3 text-left">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode("sign-up")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  mode === "sign-up"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Create account
              </button>
              <button
                type="button"
                onClick={() => setMode("sign-in")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  mode === "sign-in"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Sign in
              </button>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                Email
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </label>

            {mode === "sign-up" ? (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                  Username
                </span>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={32}
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Username"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
                <span className="mt-1 block text-xs text-slate-500">
                  3-32 chars. Use lowercase letters, numbers, dots, underscores, or hyphens.
                </span>
              </label>
            ) : null}

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                Password
              </span>
              <input
                type="password"
                required
                minLength={8}
                autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </label>

            {mode === "sign-up" ? (
              <ul className="space-y-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                {PASSWORD_RULES.map((rule) => {
                  const met = rule.test(password);
                  return (
                    <li
                      key={rule.id}
                      className={`text-xs ${met ? "text-emerald-700" : "text-slate-600"}`}
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
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              {busy ? "Working..." : mode === "sign-up" ? "Create account" : "Sign in"}
            </button>
          </form>
        </>
      ) : (
        <div className="space-y-3">
          <div className={loginTitleClassName}>You&apos;re signed in</div>
          <div className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">
            {signedInEmail}
          </div>
          <button
            type="button"
            onClick={onSignOut}
            disabled={busy}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {busy ? "Signing out..." : "Sign out"}
          </button>
        </div>
      )}

      {message ? <p className="mt-2 text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}

type AuthMode = "sign-in" | "sign-up";
