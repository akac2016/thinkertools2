"use client";

import { useEffect, useState } from "react";

export function ActivityGroupsJumpLink() {
  const [workspaceIsVisible, setWorkspaceIsVisible] = useState(false);

  useEffect(() => {
    const workspace = document.getElementById("activity-groups-workspace");
    if (!workspace) return;

    const observer = new IntersectionObserver(
      ([entry]) => setWorkspaceIsVisible(entry.isIntersecting && entry.intersectionRatio >= 0.6),
      { threshold: [0, 0.6] },
    );

    observer.observe(workspace);
    return () => observer.disconnect();
  }, []);

  if (workspaceIsVisible) return null;

  return (
    <a
      href="#activity-groups-workspace"
      className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-slate-900/20 transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 sm:bottom-6 sm:right-6"
    >
      Activity groups
      <span aria-hidden="true">↓</span>
    </a>
  );
}
