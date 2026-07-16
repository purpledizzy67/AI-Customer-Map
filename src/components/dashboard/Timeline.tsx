"use client";

import { format } from "date-fns";
import type { TimelineEvent } from "@/types";
import { Panel } from "@/components/ui/Panel";

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <Panel title="Activity timeline" eyebrow="Across apps" delay={180}>
      {!events.length ? (
        <p className="text-sm text-ink-muted">Timeline empty.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-canvas-border pl-4">
          {events.slice(0, 10).map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[21px] mt-1.5 h-2.5 w-2.5 rounded-full bg-brand ring-4 ring-canvas-raised" />
              <p className="text-xs text-ink-faint">
                {format(new Date(e.timestamp), "MMM d · h:mm a")} · {e.provider}
              </p>
              <p className="text-sm text-ink">{e.title}</p>
              <p className="text-xs text-ink-muted">{e.description}</p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
