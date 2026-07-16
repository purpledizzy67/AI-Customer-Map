"use client";

import { useEffect, useState } from "react";
import type { ProjectBundle } from "@/types";
import { ConfidenceIndicator } from "@/components/ui/ConfidenceIndicator";
import { EvidenceList } from "@/components/ui/EvidenceList";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProjectBundle | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/projects");
      const json = (await res.json()) as { projects: ProjectBundle[] };
      setProjects(json.projects);
      setSelected(json.projects[0] ?? null);
      setLoading(false);
    })();
  }, []);

  async function prepare() {
    setLoading(true);
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const res = await fetch("/api/projects");
    const json = (await res.json()) as { projects: ProjectBundle[] };
    setProjects(json.projects);
    setSelected(json.projects[0] ?? null);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Projects</p>
          <h1 className="font-display text-3xl text-ink">Prepared work</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Artifacts under <code className="text-brand">/projects/{"{slug}"}</code> when
            confidence &gt; 0.8
          </p>
        </div>
        <button
          type="button"
          onClick={() => void prepare()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-canvas"
        >
          Prepare current project
        </button>
      </div>

      {loading ? <p className="text-ink-muted">Loading…</p> : null}

      {!loading && !projects.length ? (
        <div className="panel p-8 text-center text-sm text-ink-muted">
          No prepared projects yet. Refresh the dashboard or prepare manually.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p.slug}>
              <button
                type="button"
                onClick={() => setSelected(p)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  selected?.slug === p.slug
                    ? "border-brand/50 bg-brand/10"
                    : "border-canvas-border bg-canvas-raised/60 hover:border-brand/30"
                }`}
              >
                <p className="font-medium text-ink">{p.projectName}</p>
                <p className="text-xs text-ink-faint">/projects/{p.slug}</p>
              </button>
            </li>
          ))}
        </ul>

        {selected ? (
          <div className="panel space-y-4 p-5 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl text-ink">
                  {selected.projectName}
                </h2>
                <p className="text-xs text-ink-faint">
                  {selected.artifacts.length} artifacts · {selected.createdAt}
                </p>
              </div>
              <ConfidenceIndicator value={selected.confidence} />
            </div>
            <EvidenceList evidence={selected.evidence} />
            <div className="space-y-3">
              {selected.artifacts.map((a) => (
                <details
                  key={a.path}
                  className="rounded-lg border border-canvas-border/70 bg-canvas/40"
                >
                  <summary className="cursor-pointer px-3 py-2 text-sm text-ink">
                    {a.title}{" "}
                    <span className="text-xs text-ink-faint">{a.path}</span>
                  </summary>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-canvas-border/50 p-3 font-mono text-xs text-ink-muted">
                    {a.content}
                  </pre>
                </details>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
