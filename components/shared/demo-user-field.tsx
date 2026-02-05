"use client";

import { useState } from "react";

import { getDemoUserId, setDemoUserId } from "@/components/quipx/client";

type DemoUserFieldProps = {
  onApplied?: (userId: string) => void;
};

export function DemoUserField({ onApplied }: DemoUserFieldProps) {
  const [value, setValue] = useState<string>(() => getDemoUserId());

  const handleApply = () => {
    const nextValue = value.trim() || getDemoUserId();
    setDemoUserId(nextValue);
    setValue(nextValue);
    onApplied?.(nextValue);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        Demo Actor
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm text-slate-700">
          <span className="mb-1 block">`x-demo-user-id`</span>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="demo-user-1"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
          />
        </label>
        <button
          type="button"
          onClick={handleApply}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Apply user
        </button>
      </div>
    </div>
  );
}
