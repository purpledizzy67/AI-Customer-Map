/**
 * STEP 9 — Morning dashboard generation.
 */

import { respondJson } from "@/lib/openai/client";
import { MORNING_SYSTEM } from "@/prompts/workflows";
import {
  getLatestContext,
  getLatestAnalysis,
  saveMorningDashboard,
  logAutomation,
} from "@/lib/db";
import { todayDateString } from "@/utils/helpers";
import type { EvidenceSource, MorningDashboard } from "@/types";

interface MorningLlm {
  priorities?: { text: string; confidence: number; evidence: EvidenceSource[] }[];
  blockedWork?: { text: string; evidence: EvidenceSource[] }[];
  suggestedFocusSchedule?: {
    start: string;
    end: string;
    focus: string;
    reason: string;
  }[];
  estimatedWorkloadHours?: number;
}

export async function generateMorningDashboard(
  userId: string,
  date = todayDateString(),
): Promise<MorningDashboard> {
  const context = await getLatestContext(userId);
  const analysis = await getLatestAnalysis(userId);

  const llm = await respondJson<MorningLlm>({
    system: MORNING_SYSTEM,
    user: JSON.stringify({ context, analysis, date }),
  });

  const dashboard: MorningDashboard = {
    date,
    priorities: llm?.priorities ?? [
      {
        text: analysis?.priority ?? "Review collected work context",
        confidence: analysis?.confidence ?? 0.7,
        evidence: analysis?.evidence ?? [],
      },
      ...(analysis?.urgentWork.slice(0, 3).map((text) => ({
        text,
        confidence: 0.8,
        evidence: analysis.evidence,
      })) ?? []),
    ],
    meetings: context?.meetings ?? [],
    openPrs:
      context?.github.filter((g) => g.type === "pr" || g.type === "review_request") ??
      [],
    emailsNeedingReplies:
      context?.emails.filter((e) => e.unread) ?? [],
    blockedWork: llm?.blockedWork ??
      (analysis?.blockers.map((text) => ({
        text,
        evidence: analysis.evidence,
      })) ?? []),
    suggestedFocusSchedule: llm?.suggestedFocusSchedule ?? [
      {
        start: "09:30",
        end: "11:00",
        focus: analysis?.priority ?? "Deep work on top priority",
        reason: "Highest confidence priority before midday meetings",
      },
      {
        start: "11:00",
        end: "12:00",
        focus: "Clear unread emails & Slack mentions",
        reason: "Communication debt reduction",
      },
      {
        start: "14:00",
        end: "15:00",
        focus: "Meeting follow-ups & documentation",
        reason: "Align with afternoon calendar load",
      },
    ],
    estimatedWorkloadHours: llm?.estimatedWorkloadHours ?? 6.5,
    generatedAt: new Date().toISOString(),
  };

  await saveMorningDashboard(userId, dashboard);
  await logAutomation(userId, {
    type: "morning_dashboard",
    title: `Morning dashboard — ${date}`,
    detail: `${dashboard.priorities.length} priorities, ${dashboard.meetings.length} meetings`,
    status: "success",
  });

  return dashboard;
}
