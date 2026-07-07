"use client";

import type { Community, MapStats } from "@/types";
import clsx from "clsx";
import { Search, Filter } from "lucide-react";

interface CommunityListProps {
  communities: Community[];
  selectedId?: string | null;
  onSelect: (community: Community) => void;
  search: string;
  onSearchChange: (value: string) => void;
  platformFilter: string;
  onPlatformChange: (value: string) => void;
  tierFilter: string;
  onTierChange: (value: string) => void;
}

export function CommunityList({
  communities,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  platformFilter,
  onPlatformChange,
  tierFilter,
  onTierChange,
}: CommunityListProps) {
  return (
    <div className="glass rounded-xl flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-white/10 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search communities..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-surface/50 border border-white/10 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-intent/50"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={platformFilter}
            onChange={(e) => onPlatformChange(e.target.value)}
            className="flex-1 text-xs py-1.5 px-2 bg-surface/50 border border-white/10 rounded-md text-slate-300 focus:outline-none"
          >
            <option value="all">All platforms</option>
            <option value="discord">Discord</option>
            <option value="slack">Slack</option>
          </select>
          <select
            value={tierFilter}
            onChange={(e) => onTierChange(e.target.value)}
            className="flex-1 text-xs py-1.5 px-2 bg-surface/50 border border-white/10 rounded-md text-slate-300 focus:outline-none"
          >
            <option value="all">All intent</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cool">Cool</option>
            <option value="cold">Cold</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {communities.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-sm">
            <Filter className="w-6 h-6 mx-auto mb-2 opacity-50" />
            No communities match your filters.
          </div>
        ) : (
          <ul>
            {communities.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => onSelect(c)}
                  className={clsx(
                    "w-full text-left px-3 py-2.5 border-b border-white/5 hover:bg-white/5 transition",
                    selectedId === c.id && "bg-accent-intent/10 border-l-2 border-l-accent-intent"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {c.name}
                    </span>
                    <span
                      className={clsx(
                        "text-xs font-bold shrink-0",
                        `intent-${c.intentTier}`
                      )}
                    >
                      {c.intentScore}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                    <span className="capitalize">{c.platform}</span>
                    <span>·</span>
                    <span>{c.memberCount.toLocaleString()} members</span>
                    {c.category && (
                      <>
                        <span>·</span>
                        <span className="truncate">{c.category}</span>
                      </>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface StatsBarProps {
  stats: MapStats;
}

export function StatsBar({ stats }: StatsBarProps) {
  const items = [
    { label: "Total", value: stats.total, color: "text-white" },
    { label: "Hot", value: stats.hot, color: "text-orange-400" },
    { label: "Warm", value: stats.warm, color: "text-amber-300" },
    { label: "Discord", value: stats.discord, color: "text-accent-discord" },
    { label: "Slack", value: stats.slack, color: "text-accent-slack" },
    { label: "Avg Intent", value: stats.avgIntent, color: "text-accent-intent" },
  ];

  return (
    <div className="flex flex-wrap gap-4">
      {items.map((item) => (
        <div key={item.label} className="glass rounded-lg px-4 py-2 min-w-[90px]">
          <div className="text-xs text-slate-500">{item.label}</div>
          <div className={clsx("text-xl font-bold", item.color)}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
