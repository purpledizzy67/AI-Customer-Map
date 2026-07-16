/**
 * STEP 10 — Evening summary generation.
 */

import { respondJson } from "@/lib/openai/client";
import { EVENING_SYSTEM } from "@/prompts/workflows";
import {
  getLatestContext,
  getLatestAnalysis,
  saveEveningSummary,
  logAutomation,
} from "@/lib/db";
import { todayDateString } from "@/utils/helpers";
import type { EveningSummary } from "@/types";

interface EveningLlm {
  completedWork?: string[];
  remainingBlockers?: string[];
  tomorrowPriorities?: string[];
}

export async function generateEveningSummary(
  userId: string,
  date = todayDateString(),
): Promise<EveningSummary> {
  const context = await getLatestContext(userId);
  const analysis = await getLatestAnalysis(userId);

  const mergedPrs =
    context?.github.filter(
      (g) => g.type === "pr" && /merged|closed/i.test(g.state ?? ""),
    ) ?? [];

  // In demo, treat documentation PR progress as "in progress" rather than merged
  const emailsAnswered =
    context?.emails.filter((e) => !e.unread && e.starred) ?? [];

  const meetingsAttended =
    context?.meetings.filter((m) => new Date(m.end).getTime() < Date.now()) ??
    [];

  const llm = await respondJson<EveningLlm>({
    system: EVENING_SYSTEM,
    user: JSON.stringify({ context, analysis, date }),
  });

  const summary: EveningSummary = {
    date,
    completedWork: llm?.completedWork ?? [
      ...(meetingsAttended.map((m) => `Attended: ${m.title}`) ?? []),
      ...(context?.github
        .filter((g) => g.type === "commit")
        .slice(0, 3)
        .map((c) => `Commit: ${c.title}`) ?? []),
    ],
    mergedPrs,
    emailsAnswered,
    meetingsAttended,
    remainingBlockers: llm?.remainingBlockers ?? analysis?.blockers ?? [],
    tomorrowPriorities: llm?.tomorrowPriorities ?? [
      analysis?.likelyNextProject ?? "Continue top project",
      "Clear remaining review requests",
      "Update Notion project docs",
    ],
    generatedAt: new Date().toISOString(),
  };

  await saveEveningSummary(userId, summary);
  await logAutomation(userId, {
    type: "evening_summary",
    title: `Evening summary — ${date}`,
    detail: `${summary.completedWork.length} completed items logged`,
    status: "success",
  });

  return summary;
}
