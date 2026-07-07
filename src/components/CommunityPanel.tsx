"use client";

import type { Community } from "@/types";
import clsx from "clsx";
import {
  ExternalLink,
  Users,
  Flame,
  MessageCircle,
  Hash,
} from "lucide-react";

interface CommunityPanelProps {
  community: Community | null;
  onClose: () => void;
}

function tierLabel(tier: string): string {
  const labels: Record<string, string> = {
    hot: "High Intent",
    warm: "Warm Lead",
    cool: "Moderate",
    cold: "Low Intent",
  };
  return labels[tier] ?? tier;
}

export function CommunityPanel({ community, onClose }: CommunityPanelProps) {
  if (!community) {
    return (
      <div className="glass rounded-xl p-6 h-full flex flex-col items-center justify-center text-center">
        <MessageCircle className="w-10 h-10 text-slate-600 mb-3" />
        <p className="text-slate-400 text-sm">
          Click a community on the map to see intent signals and outreach links.
        </p>
      </div>
    );
  }

  const topSignals = community.intentSignals.slice(0, 6);

  return (
    <div className="glass rounded-xl overflow-hidden h-full flex flex-col">
      <div className="p-4 border-b border-white/10 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                "text-xs font-medium px-2 py-0.5 rounded-full capitalize",
                community.platform === "discord"
                  ? "bg-accent-discord/20 text-accent-discord"
                  : "bg-accent-slack/20 text-accent-slack"
              )}
            >
              {community.platform}
            </span>
            <span
              className={clsx(
                "text-xs font-medium px-2 py-0.5 rounded-full capitalize",
                `intent-${community.intentTier}`
              )}
            >
              {tierLabel(community.intentTier)}
            </span>
          </div>
          <h2 className="text-lg font-semibold text-white mt-2">
            {community.name}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {community.memberCount.toLocaleString()} members
          </span>
          {community.category && (
            <span className="flex items-center gap-1">
              <Hash className="w-4 h-4" />
              {community.category}
            </span>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 uppercase tracking-wide">
              Intent Score
            </span>
            <span className="text-2xl font-bold text-accent-intent flex items-center gap-1">
              <Flame className="w-5 h-5 text-orange-400" />
              {community.intentScore}
            </span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-amber-400 to-orange-500 transition-all"
              style={{ width: `${community.intentScore}%` }}
            />
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed line-clamp-4">
          {community.description}
        </p>

        {topSignals.length > 0 && (
          <div>
            <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-2">
              Intent Signals
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {topSignals.map((signal, i) => (
                <span
                  key={`${signal.keyword}-${i}`}
                  className="text-xs px-2 py-1 rounded-md bg-surface-overlay text-slate-300"
                >
                  {signal.keyword}
                  <span className="text-slate-500 ml-1">+{signal.weight}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {community.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {community.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded bg-white/5 text-slate-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {(community.region || community.language) && (
          <p className="text-xs text-slate-500">
            {[community.region, community.language].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      <div className="p-4 border-t border-white/10 space-y-2">
        {community.inviteUrl && (
          <a
            href={community.inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-accent-intent/20 text-accent-intent hover:bg-accent-intent/30 transition text-sm font-medium"
          >
            Join Community
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
        <a
          href={community.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition text-sm"
        >
          View on {community.platform === "discord" ? "Disboard" : "Slofile"}
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
