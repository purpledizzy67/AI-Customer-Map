/**
 * Action Generator — turns PriorityAnalysis into approval-gated actions.
 * Nothing is executed without explicit user approval.
 */

import { newId } from "@/lib/db";
import type { PriorityAnalysis, SuggestedAction, EvidenceSource } from "@/types";

export function ensureApprovalGate(
  actions: Array<Omit<SuggestedAction, "id" | "requiresApproval" | "status"> & {
    id?: string;
    requiresApproval?: true;
    status?: SuggestedAction["status"];
  }>,
): SuggestedAction[] {
  return actions.map((action) => ({
    ...action,
    id: action.id ?? newId(),
    requiresApproval: true as const,
    status: action.status ?? "pending",
    evidence: action.evidence ?? [],
  }));
}

export function buildHeuristicActions(
  analysis: Pick<
    PriorityAnalysis,
    "priority" | "project" | "confidence" | "evidence" | "urgentWork"
  >,
): SuggestedAction[] {
  const baseEvidence: EvidenceSource[] = analysis.evidence;
  const actions: SuggestedAction[] = [
    {
      id: newId(),
      type: "prepare_work",
      title: `Prepare work for ${analysis.project}`,
      description: `Generate README, roadmap, checklist, and Context.md for "${analysis.priority}"`,
      project: analysis.project,
      confidence: analysis.confidence,
      evidence: baseEvidence,
      requiresApproval: true,
      status: "pending",
      payload: { project: analysis.project, priority: analysis.priority },
    },
  ];

  if (analysis.urgentWork.some((u) => /meeting|brief|review/i.test(u))) {
    actions.push({
      id: newId(),
      type: "meeting_brief",
      title: "Prepare upcoming meeting brief",
      description: "Compile emails, Slack, GitHub, and Notion into a meeting brief",
      project: analysis.project,
      confidence: Math.min(analysis.confidence, 0.92),
      evidence: baseEvidence.filter((e) => e.provider === "calendar" || e.provider === "gmail"),
      requiresApproval: true,
      status: "pending",
    });
  }

  if (analysis.urgentWork.some((u) => /pr|review/i.test(u))) {
    actions.push({
      id: newId(),
      type: "review_pr",
      title: "Review open pull requests",
      description: "Surface assigned PRs and review requests needing attention",
      project: analysis.project,
      confidence: 0.85,
      evidence: baseEvidence.filter((e) => e.provider === "github"),
      requiresApproval: true,
      status: "pending",
    });
  }

  return actions;
}
