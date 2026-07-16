"use client";

import type { EveningSummary, MorningDashboard } from "@/types";
import { Panel } from "@/components/ui/Panel";

export function MorningEvening({
  morning,
  evening,
}: {
  morning: MorningDashboard | null;
  evening: EveningSummary | null;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Panel title="Morning dashboard" eyebrow="Daily plan" delay={90}>
        {!morning ? (
          <p className="text-sm text-ink-muted">Not generated yet.</p>
        ) : (
          <>
            <ul className="space-y-2">
              {morning.priorities.slice(0, 4).map((p) => (
                <li key={p.text} className="text-sm text-ink">
                  {p.text}
                  <span className="ml-2 font-mono text-[10px] text-ink-faint">
                    {Math.round(p.confidence * 100)}%
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-muted">
              Est. workload · {morning.estimatedWorkloadHours}h
            </p>
            <div className="mt-3 space-y-1">
              {morning.suggestedFocusSchedule.slice(0, 3).map((s) => (
                <p key={`${s.start}-${s.focus}`} className="text-xs text-ink-faint">
                  <span className="font-mono text-brand">
                    {s.start}–{s.end}
                  </span>{" "}
                  {s.focus}
                </p>
              ))}
            </div>
          </>
        )}
      </Panel>
      <Panel title="Evening summary" eyebrow="Wrap-up" delay={110}>
        {!evening ? (
          <div>
            <p className="text-sm text-ink-muted">Generate at end of day.</p>
            <button
              type="button"
              onClick={() => void fetch("/api/evening", { method: "POST" })}
              className="mt-3 rounded-md border border-canvas-border px-3 py-1.5 text-xs text-ink-muted hover:text-ink"
            >
              Generate now
            </button>
          </div>
        ) : (
          <>
            <p className="label mb-1">Completed</p>
            <ul className="mb-3 space-y-1 text-sm text-ink-muted">
              {evening.completedWork.slice(0, 4).map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="label mb-1">Tomorrow</p>
            <ul className="space-y-1 text-sm text-ink">
              {evening.tomorrowPriorities.slice(0, 3).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}
