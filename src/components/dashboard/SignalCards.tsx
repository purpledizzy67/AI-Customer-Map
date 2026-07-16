"use client";

import type { UnifiedContext } from "@/types";
import { Panel } from "@/components/ui/Panel";
import { Github, Mail, MessageSquare, BookOpen } from "lucide-react";

export function SignalCards({ context }: { context: UnifiedContext | null }) {
  const cards = [
    {
      title: "Emails",
      icon: Mail,
      count: context?.emails.filter((e) => e.unread).length ?? 0,
      detail: `${context?.emails.length ?? 0} recent`,
      items: (context?.emails ?? []).slice(0, 3).map((e) => e.subject),
    },
    {
      title: "Slack",
      icon: MessageSquare,
      count: context?.slack.filter((s) => s.unread).length ?? 0,
      detail: `${context?.slack.length ?? 0} signals`,
      items: (context?.slack ?? []).slice(0, 3).map((s) => s.text.slice(0, 60)),
    },
    {
      title: "GitHub",
      icon: Github,
      count:
        context?.github.filter(
          (g) => g.type === "pr" || g.type === "review_request",
        ).length ?? 0,
      detail: `${context?.github.length ?? 0} items`,
      items: (context?.github ?? [])
        .filter((g) => g.type !== "repo")
        .slice(0, 3)
        .map((g) => g.title),
    },
    {
      title: "Notion",
      icon: BookOpen,
      count: context?.notion.length ?? 0,
      detail: "docs & tasks",
      items: (context?.notion ?? []).slice(0, 3).map((n) => n.title),
    },
  ];

  return (
    <Panel title="Connected signals" eyebrow="Live context" delay={120}>
      <div className="space-y-4">
        {cards.map(({ title, icon: Icon, count, detail, items }) => (
          <div key={title}>
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-ink">
                <Icon className="h-3.5 w-3.5 text-brand" />
                {title}
              </div>
              <span className="font-mono text-xs text-ink-faint">
                {count} · {detail}
              </span>
            </div>
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item} className="truncate text-xs text-ink-muted">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}
