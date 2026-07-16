"use client";

import type {
  MeetingBrief,
  SuggestedAction,
  SuggestedReply,
} from "@/types";
import { Panel } from "@/components/ui/Panel";
import { ConfidenceIndicator } from "@/components/ui/ConfidenceIndicator";

export function SuggestionsCard({
  actions,
  replies,
  briefs,
  onDecide,
}: {
  actions: SuggestedAction[];
  replies: SuggestedReply[];
  briefs: MeetingBrief[];
  onDecide: (id: string, decision: "approved" | "rejected") => void;
}) {
  const pending = actions.filter((a) => a.status === "pending");

  return (
    <Panel title="AI suggestions" eyebrow="Approval required" delay={140}>
      <p className="mb-4 text-xs text-ink-faint">
        Never auto-sends email, merges PRs, or posts Slack replies.
      </p>

      {!pending.length && !replies.length && !briefs.length ? (
        <p className="text-sm text-ink-muted">No pending suggestions.</p>
      ) : null}

      <ul className="space-y-3">
        {pending.map((action) => (
          <li
            key={action.id}
            className="rounded-lg border border-canvas-border/70 bg-canvas/50 p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-ink">{action.title}</p>
                <p className="mt-1 text-xs text-ink-muted">{action.description}</p>
              </div>
              <ConfidenceIndicator value={action.confidence} className="w-28" />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => onDecide(action.id, "approved")}
                className="rounded-md bg-signal-high/20 px-3 py-1.5 text-xs font-medium text-signal-high hover:bg-signal-high/30"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => onDecide(action.id, "rejected")}
                className="rounded-md bg-canvas-overlay px-3 py-1.5 text-xs text-ink-muted hover:text-ink"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>

      {replies.length ? (
        <div className="mt-5">
          <p className="label mb-2">Suggested Slack replies</p>
          <ul className="space-y-2">
            {replies.slice(0, 3).map((r) => (
              <li key={r.id} className="rounded-lg bg-canvas/40 p-3 text-sm">
                <p className="text-xs text-ink-faint">Q: {r.question}</p>
                <p className="mt-1 text-ink-muted">{r.draftAnswer}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wide text-signal-mid">
                  Draft only · not posted
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {briefs.length ? (
        <div className="mt-5">
          <p className="label mb-2">Meeting briefs</p>
          <ul className="space-y-2">
            {briefs.slice(0, 2).map((b) => (
              <li key={b.meetingId} className="text-sm text-ink-muted">
                <span className="text-ink">{b.meetingTitle}</span> — {b.summary}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}
