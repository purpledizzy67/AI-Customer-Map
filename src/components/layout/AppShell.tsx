"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Settings,
  FolderKanban,
  Sparkles,
} from "lucide-react";
import { cn } from "@/utils/helpers";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Ask AI", icon: MessageSquare },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/settings", label: "Connections", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative z-10 min-h-screen">
      <header className="sticky top-0 z-40 border-b border-canvas-border/70 bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15 text-brand ring-1 ring-brand/30 transition group-hover:bg-brand/25">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="font-display text-lg leading-none tracking-tight text-ink">
                Work Assistant
              </p>
              <p className="mt-0.5 text-[11px] text-ink-faint">
                Proactive · Evidence-first
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                    active
                      ? "bg-canvas-overlay text-ink"
                      : "text-ink-muted hover:bg-canvas-overlay/60 hover:text-ink",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
