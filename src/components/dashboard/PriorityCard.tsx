"use client";

import type { PriorityAnalysis } from "@/types";
import { Panel } from "@/components/ui/Panel";
import { ConfidenceIndicator } from "@/components/ui/ConfidenceIndicator";

export function PriorityCard({
  analysis,
}: {
  analysis: PriorityAnalysis | null;
}) {
  return (
    <Panel title="Highest priority" eyebrow="AI recommendation" delay={60}>
      {!analysis ? (
        <p className="text-ink-muted">No analysis yet. Refresh to collect context.</p>
      ) : (
        <>
          <p className="font-display text-2xl leading-snug text-ink sm:text-3xl">
            {analysis.priority}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <ConfidenceIndicator value={analysis.confidence} />
            <span className="rounded-md bg-canvas-overlay px-2 py-1 text-xs text-ink-muted">
              Project · {analysis.project}
            </span>
          </div>
          {analysis.urgentWork.length ? (
            <div className="mt-4">
              <p className="label mb-2">Urgent</p>
              <ul className="space-y-1.5">
                {analysis.urgentWork.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-ink-muted">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-signal-warn" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {analysis.blockers.length ? (
            <div className="mt-4">
              <p className="label mb-2">Blockers</p>
              <ul className="space-y-1 text-sm text-signal-low">
                {analysis.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </Panel>
  );
}
