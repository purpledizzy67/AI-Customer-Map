"use client";

import { format } from "date-fns";
import type { AutomationEvent } from "@/types";
import { Panel } from "@/components/ui/Panel";

export function AutomationHistory({ events }: { events: AutomationEvent[] }) {
  return (
    <Panel title="Automation history" eyebrow="Audit trail" delay={200}>
      {!events.length ? (
        <p className="text-sm text-ink-muted">No automation events yet.</p>
      ) : (
        <ul className="divide-y divide-canvas-border/50">
          {events.slice(0, 12).map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0"
            >
              <div>
                <p className="text-sm text-ink">{e.title}</p>
                <p className="text-xs text-ink-muted">{e.detail}</p>
              </div>
              <div className="text-right">
                <span
                  className={`font-mono text-[10px] uppercase ${
                    e.status === "success"
                      ? "text-signal-high"
                      : e.status === "failed"
                        ? "text-signal-low"
                        : "text-signal-mid"
                  }`}
                >
                  {e.status}
                </span>
                <p className="text-[10px] text-ink-faint">
                  {format(new Date(e.createdAt), "MMM d · HH:mm")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
