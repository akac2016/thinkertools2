"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AuthPanel } from "@/components/shared/auth-panel";

export function AuthFloatingPanel() {
  const pathname = usePathname();

  if (pathname === "/" || pathname === "/thinkertool-missions") {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="inline-flex items-center">
          <Image
            src="/images/TTlogo.png"
            alt="Thinkertools logo"
            width={165}
            height={36}
            priority
          />
        </Link>
        <AuthPanel />
      </div>
    </header>
  );
}
