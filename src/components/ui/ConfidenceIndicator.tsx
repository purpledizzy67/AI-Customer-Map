"use client";

import { cn, formatConfidence } from "@/utils/helpers";

export function ConfidenceIndicator({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const tone =
    pct >= 80 ? "text-signal-high" : pct >= 60 ? "text-signal-mid" : "text-signal-low";
  const bar =
    pct >= 80 ? "bg-signal-high" : pct >= 60 ? "bg-signal-mid" : "bg-signal-low";

  return (
    <div className={cn("min-w-[120px]", className)}>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-ink-faint">Confidence</span>
        <span className={cn("font-mono font-medium", tone)}>
          {formatConfidence(value)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-canvas-overlay">
        <div
          className={cn("h-full rounded-full transition-all duration-700", bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
