/**
 * AI Orchestration Layer
 *
 * Pipeline: Context → Prompt → LLM → Structured Analysis → Action Generator
 * The LLM never calls external APIs.
 */

import { respondJson } from "@/lib/openai/client";
import {
  ANALYZE_SYSTEM_PROMPT,
  buildAnalyzeUserPrompt,
} from "@/prompts/analyzeContext";
import { buildHeuristicActions, ensureApprovalGate } from "@/lib/ai/actionGenerator";
import { newId, saveAnalysis, logAutomation, addTimelineEvent } from "@/lib/db";
import type {
  EvidenceSource,
  PriorityAnalysis,
  SuggestedAction,
  UnifiedContext,
} from "@/types";

interface LlmAnalysisShape {
  priority?: string;
  project?: string;
  confidence?: number;
  urgentWork?: string[];
  likelyNextProject?: string;
  blockers?: string[];
  documentsNeeded?: string[];
  codingContextNeeded?: string[];
  rationale?: string;
  evidence?: EvidenceSource[];
  actions?: Array<{
    type?: SuggestedAction["type"];
    title?: string;
    description?: string;
    project?: string;
    confidence?: number;
    evidence?: EvidenceSource[];
    payload?: Record<string, unknown>;
  }>;
}

function heuristicAnalysis(context: UnifiedContext): PriorityAnalysis {
  const docPr = context.github.find(
    (g) => g.type === "pr" && /doc|openapi|api/i.test(g.title),
  );
  const urgentEmail = context.emails.find((e) => e.unread && e.starred);
  const soonMeeting = context.meetings
    .filter((m) => new Date(m.start).getTime() > Date.now())
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];
  const slackMention = context.slack.find((s) => s.type === "mention");

  const project =
    docPr?.repo.split("/")[1]?.replace(/-/g, " ") ??
    urgentEmail?.mentionsProject?.[0] ??
    "API Platform";

  const priority = docPr
    ? `Finish ${docPr.title}`
    : urgentEmail
      ? `Reply: ${urgentEmail.subject}`
      : soonMeeting
        ? `Prepare for ${soonMeeting.title}`
        : "Review today's priorities";

  const evidence: EvidenceSource[] = [];
  if (docPr) {
    evidence.push({
      provider: "github",
      type: "pr",
      id: String(docPr.number ?? docPr.id),
      title: `GitHub PR #${docPr.number}: ${docPr.title}`,
      url: docPr.url,
      timestamp: docPr.updatedAt,
    });
  }
  if (slackMention) {
    evidence.push({
      provider: "slack",
      type: "mention",
      id: slackMention.id,
      title: `Slack ${slackMention.channelName}`,
      snippet: slackMention.text,
      url: slackMention.permalink,
      timestamp: slackMention.timestamp,
    });
  }
  if (soonMeeting) {
    evidence.push({
      provider: "calendar",
      type: "meeting",
      id: soonMeeting.id,
      title: `Meeting: ${soonMeeting.title}`,
      url: soonMeeting.url,
      timestamp: soonMeeting.start,
    });
  }
  if (urgentEmail) {
    evidence.push({
      provider: "gmail",
      type: "email",
      id: urgentEmail.id,
      title: `Email from ${urgentEmail.from}`,
      snippet: urgentEmail.snippet,
      url: urgentEmail.url,
      timestamp: urgentEmail.receivedAt,
    });
  }

  const confidence =
    evidence.length >= 3 ? 0.91 : evidence.length === 2 ? 0.82 : 0.65;

  const base: Omit<PriorityAnalysis, "actions"> = {
    priority,
    project,
    confidence,
    urgentWork: [
      ...(docPr ? [`Complete PR #${docPr.number}`] : []),
      ...(soonMeeting ? [`Meeting soon: ${soonMeeting.title}`] : []),
      ...(urgentEmail ? [`Unread starred email: ${urgentEmail.subject}`] : []),
      ...context.github
        .filter((g) => g.type === "review_request")
        .map((g) => `Review requested: PR #${g.number}`),
    ],
    likelyNextProject:
      context.notion.find((n) => /search|rag/i.test(n.title))?.title ??
      "Search & RAG",
    blockers: context.github
      .filter((g) => g.type === "issue")
      .map((g) => `Open issue: ${g.title}`),
    documentsNeeded: [
      "API documentation",
      "Architecture summary",
      "Migration notes",
    ],
    codingContextNeeded: [
      "OpenAPI partner endpoints",
      "Rate limiter PR context",
      "Semantic search latency issue",
    ],
    evidence,
    rationale: `Highest signal cluster centers on "${priority}" based on ${evidence.length} independent sources across connected apps.`,
    analyzedAt: new Date().toISOString(),
  };

  return {
    ...base,
    actions: buildHeuristicActions(base),
  };
}

function normalizeAnalysis(
  raw: LlmAnalysisShape,
  fallback: PriorityAnalysis,
): PriorityAnalysis {
  const confidence = Math.max(
    0,
    Math.min(1, Number(raw.confidence ?? fallback.confidence)),
  );
  const evidence = raw.evidence?.length ? raw.evidence : fallback.evidence;
  const draftActions = ensureApprovalGate(
    (raw.actions ?? []).map((a) => ({
      type: a.type ?? "custom",
      title: a.title ?? "Suggested action",
      description: a.description ?? "",
      project: a.project,
      confidence: a.confidence ?? confidence,
      evidence: a.evidence ?? evidence,
      payload: a.payload,
    })),
  );

  return {
    priority: raw.priority || fallback.priority,
    project: raw.project || fallback.project,
    confidence,
    urgentWork: raw.urgentWork?.length ? raw.urgentWork : fallback.urgentWork,
    likelyNextProject: raw.likelyNextProject || fallback.likelyNextProject,
    blockers: raw.blockers ?? fallback.blockers,
    documentsNeeded: raw.documentsNeeded ?? fallback.documentsNeeded,
    codingContextNeeded: raw.codingContextNeeded ?? fallback.codingContextNeeded,
    evidence,
    rationale: raw.rationale || fallback.rationale,
    analyzedAt: new Date().toISOString(),
    actions: draftActions.length ? draftActions : fallback.actions,
  };
}

export async function analyzeContext(
  context: UnifiedContext,
): Promise<PriorityAnalysis> {
  const fallback = heuristicAnalysis(context);

  const llm = await respondJson<LlmAnalysisShape>({
    system: ANALYZE_SYSTEM_PROMPT,
    user: buildAnalyzeUserPrompt(context),
  });

  const analysis = llm ? normalizeAnalysis(llm, fallback) : fallback;

  // Guarantee every action is approval-gated
  analysis.actions = ensureApprovalGate(analysis.actions);

  await saveAnalysis(context.userId, analysis);
  await logAutomation(context.userId, {
    type: "analyze_priorities",
    title: "Priority analysis complete",
    detail: `${analysis.priority} (confidence ${analysis.confidence.toFixed(2)})`,
    status: "success",
    evidence: analysis.evidence,
    metadata: { project: analysis.project, confidence: analysis.confidence },
  });
  await addTimelineEvent(context.userId, {
    provider: "ai",
    title: "AI priority set",
    description: analysis.priority,
    timestamp: analysis.analyzedAt,
    confidence: analysis.confidence,
  });

  return analysis;
}

export async function orchestrate(
  userId: string,
  buildContext: () => Promise<UnifiedContext>,
): Promise<{ context: UnifiedContext; analysis: PriorityAnalysis }> {
  const context = await buildContext();
  const analysis = await analyzeContext(context);
  return { context, analysis };
}

export { newId };
