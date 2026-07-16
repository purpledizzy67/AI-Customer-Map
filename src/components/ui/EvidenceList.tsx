"use client";

import type { EvidenceSource } from "@/types";

export function EvidenceList({ evidence }: { evidence: EvidenceSource[] }) {
  if (!evidence?.length) {
    return (
      <p className="text-sm text-ink-faint">No cited evidence for this item.</p>
    );
  }
  return (
    <ul className="space-y-2">
      {evidence.map((e, i) => (
        <li
          key={`${e.provider}-${e.id ?? i}-${e.title}`}
          className="rounded-lg border border-canvas-border/60 bg-canvas/40 px-3 py-2"
        >
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded bg-brand/15 px-1.5 py-0.5 font-mono uppercase text-brand">
              {e.provider}
            </span>
            <span className="text-ink-faint">{e.type}</span>
          </div>
          <p className="mt-1 text-sm text-ink">
            {e.url ? (
              <a
                href={e.url}
                target="_blank"
                rel="noreferrer"
                className="hover:text-brand hover:underline"
              >
                {e.title}
              </a>
            ) : (
              e.title
            )}
          </p>
          {e.snippet ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{e.snippet}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
