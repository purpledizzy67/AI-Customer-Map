"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Brain } from "lucide-react";
import clsx from "clsx";

const SIGNAL_CATEGORIES = [
  { label: "Active need", examples: '"looking for", "need a tool"', weight: "12–14" },
  { label: "Evaluation", examples: '"recommend", "best tool", "trial"', weight: "8–11" },
  { label: "Switching", examples: '"alternative to", "frustrated with"', weight: "12–14" },
  { label: "Commercial audience", examples: "saas, founder, marketing, seo", weight: "+5 each" },
  { label: "Budget / hiring", examples: '"pricing", "budget", "hire"', weight: "8–10" },
];

const TIERS = [
  { name: "Hot", range: "70–100", color: "text-orange-400", desc: "Strong buying signals — prioritize outreach" },
  { name: "Warm", range: "45–69", color: "text-amber-300", desc: "Commercial audience + some intent language" },
  { name: "Cool", range: "25–44", color: "text-cyan-300", desc: "Relevant community, weaker signals" },
  { name: "Cold", range: "0–24", color: "text-slate-400", desc: "Low commercial relevance" },
];

export function IntentExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Brain className="w-4 h-4 text-accent-intent" />
          How is intent scored?
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-3 text-sm text-slate-400">
          <p>
            Each community is scanned for <strong className="text-slate-300">buying-intent language</strong> in
            its name, description, tags, and category. Matching phrases add weighted points; the total is
            capped at 100.
          </p>

          <div>
            <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Signal types</h4>
            <div className="space-y-2">
              {SIGNAL_CATEGORIES.map((s) => (
                <div key={s.label} className="flex justify-between gap-4 text-xs">
                  <span>
                    <span className="text-slate-300">{s.label}</span>
                    <span className="text-slate-600 ml-1">({s.examples})</span>
                  </span>
                  <span className="text-accent-intent shrink-0">+{s.weight}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Intent tiers</h4>
            <div className="grid grid-cols-2 gap-2">
              {TIERS.map((t) => (
                <div key={t.name} className="bg-surface/50 rounded-lg p-2">
                  <div className="flex items-center gap-2">
                    <span className={clsx("font-semibold", t.color)}>{t.name}</span>
                    <span className="text-slate-600 text-xs">{t.range}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            With <code className="text-accent-intent">OPENAI_API_KEY</code> set, scores blend keyword
            detection (40%) with LLM analysis (60%) for richer context understanding.
          </p>
        </div>
      )}
    </div>
  );
}
