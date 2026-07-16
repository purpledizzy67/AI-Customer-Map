"use client";

import { format } from "date-fns";
import type { MeetingItem } from "@/types";
import { Panel } from "@/components/ui/Panel";
import { minutesUntil } from "@/utils/helpers";

export function MeetingsCard({ meetings }: { meetings: MeetingItem[] }) {
  const upcoming = [...meetings].sort(
    (a, b) => +new Date(a.start) - +new Date(b.start),
  );

  return (
    <Panel title="Meetings" eyebrow="Calendar" delay={100}>
      {!upcoming.length ? (
        <p className="text-sm text-ink-muted">No meetings in range.</p>
      ) : (
        <ul className="space-y-3">
          {upcoming.map((m) => {
            const mins = minutesUntil(m.start);
            const soon = mins >= 0 && mins <= 30;
            return (
              <li key={m.id} className="border-b border-canvas-border/50 pb-3 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{m.title}</p>
                  {soon ? (
                    <span className="shrink-0 animate-pulse-soft rounded bg-signal-warn/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-signal-warn">
                      in {mins}m
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-ink-faint">
                  {format(new Date(m.start), "h:mm a")} ·{" "}
                  {m.attendees.length} attendees
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
