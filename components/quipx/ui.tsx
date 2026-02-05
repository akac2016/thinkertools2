"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const phases = [
  { key: "discuss", label: "Discuss" },
  { key: "reflect", label: "Reflect" },
  { key: "improve", label: "Improve" },
  { key: "review", label: "Review" },
] as const;

export function QuipxShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Quipx Demo
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm text-slate-600">{subtitle}</p> : null}
      </header>
      {children}
    </main>
  );
}

export function PhaseNav({ sessionId }: { sessionId: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Session phases" className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-2">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {phases.map((phase) => {
          const href = `/quipx/sessions/${sessionId}/${phase.key}`;
          const active = pathname === href;

          return (
            <li key={phase.key}>
              <Link
                href={href}
                className={[
                  "block rounded-lg px-3 py-2 text-center text-sm font-medium transition",
                  active
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-100",
                ].join(" ")}
              >
                {phase.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function StatusCard({
  loading,
  error,
  emptyLabel,
}: {
  loading: boolean;
  error: string | null;
  emptyLabel: string;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
      {emptyLabel}
    </div>
  );
}

export function DataPanel({
  title,
  children,
  right,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function JsonView({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[480px] overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
