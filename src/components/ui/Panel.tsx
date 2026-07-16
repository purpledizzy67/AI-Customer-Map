"use client";

import { cn } from "@/utils/helpers";

export function Panel({
  title,
  eyebrow,
  action,
  children,
  className,
  delay = 0,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <section
      className={cn("panel animate-fade-up p-4 sm:p-5", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          {eyebrow ? <p className="label mb-1">{eyebrow}</p> : null}
          <h2 className="font-display text-lg text-ink">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
