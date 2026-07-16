"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AutomationEvent,
  MeetingBrief,
  MorningDashboard,
  EveningSummary,
  OAuthAccount,
  PriorityAnalysis,
  ProjectBundle,
  SuggestedAction,
  SuggestedReply,
  TimelineEvent,
  UnifiedContext,
} from "@/types";

export interface DashboardData {
  demoMode: boolean;
  analysis: PriorityAnalysis | null;
  context: UnifiedContext | null;
  actions: SuggestedAction[];
  automation: AutomationEvent[];
  briefs: MeetingBrief[];
  accounts: OAuthAccount[];
  projects: ProjectBundle[];
  replies: SuggestedReply[];
  timeline: TimelineEvent[];
  morning: MorningDashboard | null;
  evening: EveningSummary | null;
}

export function useDashboard(autoLoad = true) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/dashboard${refresh ? "?refresh=1" : ""}`);
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as DashboardData;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) void load(false);
  }, [autoLoad, load]);

  const approve = useCallback(
    async (actionId: string, decision: "approved" | "rejected") => {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, decision, execute: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load(false);
      return res.json();
    },
    [load],
  );

  return { data, loading, error, refreshing, reload: load, approve };
}
