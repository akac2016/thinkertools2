"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AuthPanel } from "@/components/shared/auth-panel";

export function AuthFloatingPanel() {
  const pathname = usePathname();

  if (pathname === "/") {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/images/TTlogo.png"
              alt="Thinkertools logo"
              width={165}
              height={36}
              priority
            />
          </Link>
          {pathname.startsWith("/thinkertools-missions") && (
            <Link
              href="/thinkertools-missions-create"
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              + Create
            </Link>
          )}
        </div>
        <AuthPanel />
      </div>
    </header>
  );
}
