"use client";

import { RefreshCw, Search } from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { useSearch } from "@/hooks/useSearch";
import { ConfidenceIndicator } from "@/components/ui/ConfidenceIndicator";
import { EvidenceList } from "@/components/ui/EvidenceList";
import { Panel } from "@/components/ui/Panel";
import { PriorityCard } from "@/components/dashboard/PriorityCard";
import { MeetingsCard } from "@/components/dashboard/MeetingsCard";
import { SignalCards } from "@/components/dashboard/SignalCards";
import { SuggestionsCard } from "@/components/dashboard/SuggestionsCard";
import { AutomationHistory } from "@/components/dashboard/AutomationHistory";
import { Timeline } from "@/components/dashboard/Timeline";
import { MorningEvening } from "@/components/dashboard/MorningEvening";

export function Dashboard() {
  const { data, loading, error, refreshing, reload, approve } = useDashboard();
  const { query, results, loading: searching, search, setQuery } = useSearch();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-pulse-soft rounded-full bg-brand/40" />
          <p className="text-ink-muted">Collecting work context…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-signal-low">{error ?? "Unable to load dashboard"}</p>
        <button
          type="button"
          onClick={() => void reload(true)}
          className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-canvas"
        >
          Retry
        </button>
      </div>
    );
  }

  const { analysis, context, actions, automation, timeline, morning, evening, briefs, replies } =
    data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="animate-fade-up">
          <p className="label">Today</p>
          <h1 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">
            Work Assistant
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">
            Priorities from real activity across Gmail, Calendar, Slack, GitHub,
            and Notion — never guesses. Every suggestion cites its sources.
          </p>
          {data.demoMode ? (
            <p className="mt-2 text-xs text-signal-mid">
              Demo mode — sample activity loaded. Connect accounts in Settings for live data.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                void search(e.target.value);
              }}
              placeholder="Semantic search…"
              className="w-56 rounded-lg border border-canvas-border bg-canvas-raised py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none sm:w-64"
            />
          </div>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void reload(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-canvas-border bg-canvas-overlay px-3 py-2 text-sm text-ink hover:border-brand/50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {query && (
        <Panel title="Search results" eyebrow="Across connected apps" delay={40}>
          {searching ? (
            <p className="text-sm text-ink-muted">Searching…</p>
          ) : results.length ? (
            <ul className="space-y-2">
              {results.slice(0, 8).map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <span className="mr-2 font-mono text-xs uppercase text-brand">
                      {r.provider}
                    </span>
                    {r.url ? (
                      <a href={r.url} className="text-ink hover:underline" target="_blank" rel="noreferrer">
                        {r.title}
                      </a>
                    ) : (
                      <span>{r.title}</span>
                    )}
                    <p className="text-xs text-ink-muted">{r.snippet}</p>
                  </div>
                  <span className="font-mono text-xs text-ink-faint">
                    {Math.round(r.score * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">No matches.</p>
          )}
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <PriorityCard analysis={analysis} />
          <MorningEvening morning={morning} evening={evening} />
          <SuggestionsCard
            actions={actions}
            replies={replies}
            briefs={briefs}
            onDecide={(id, decision) => void approve(id, decision)}
          />
        </div>
        <div className="space-y-4">
          <Panel title="Today's project" eyebrow="Focus" delay={80}>
            <p className="font-display text-2xl text-brand">
              {analysis?.project ?? "—"}
            </p>
            {analysis ? (
              <div className="mt-3">
                <ConfidenceIndicator value={analysis.confidence} />
              </div>
            ) : null}
            {analysis?.likelyNextProject ? (
              <p className="mt-3 text-sm text-ink-muted">
                Likely next:{" "}
                <span className="text-ink">{analysis.likelyNextProject}</span>
              </p>
            ) : null}
          </Panel>
          <MeetingsCard meetings={context?.meetings ?? []} />
          <SignalCards context={context} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Why this priority?" eyebrow="Evidence" delay={160}>
          <EvidenceList evidence={analysis?.evidence ?? []} />
          {analysis?.rationale ? (
            <p className="mt-4 text-sm text-ink-muted">{analysis.rationale}</p>
          ) : null}
        </Panel>
        <Timeline events={timeline} />
      </div>

      <AutomationHistory events={automation} />
    </div>
  );
}
