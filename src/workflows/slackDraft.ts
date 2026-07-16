/**
 * STEP 8 — Slack question → search Notion + GitHub → draft suggested reply.
 * NEVER auto-posts to Slack.
 */

import { respondJson } from "@/lib/openai/client";
import { SLACK_REPLY_SYSTEM } from "@/prompts/workflows";
import { notionService } from "@/services/notionService";
import { githubService } from "@/services/githubService";
import { newId, saveSuggestedReply, logAutomation } from "@/lib/db";
import type { EvidenceSource, SuggestedReply } from "@/types";

interface ReplyLlm {
  draftAnswer?: string;
  confidence?: number;
  sources?: EvidenceSource[];
}

export async function draftSlackReply(
  userId: string,
  input: {
    question: string;
    channelId: string;
    threadTs?: string;
  },
): Promise<SuggestedReply> {
  const [notionHits, githubHits] = await Promise.all([
    notionService.search(userId, input.question),
    githubService.searchCode(userId, input.question),
  ]);

  const sources: EvidenceSource[] = [
    ...notionHits.map((n) => ({
      provider: "notion" as const,
      type: n.type,
      id: n.id,
      title: n.title,
      url: n.url,
    })),
    ...githubHits.map((g) => ({
      provider: "github" as const,
      type: g.type,
      id: g.id,
      title: `${g.repo}: ${g.title}`,
      url: g.url,
    })),
  ];

  const llm = await respondJson<ReplyLlm>({
    system: SLACK_REPLY_SYSTEM,
    user: JSON.stringify({
      question: input.question,
      notionHits,
      githubHits,
    }),
  });

  const reply: SuggestedReply = {
    id: newId(),
    slackChannelId: input.channelId,
    slackThreadTs: input.threadTs,
    question: input.question,
    draftAnswer:
      llm?.draftAnswer ??
      (sources.length
        ? `Based on connected sources:\n\n${sources
            .slice(0, 3)
            .map((s) => `- ${s.title}${s.url ? ` (${s.url})` : ""}`)
            .join("\n")}\n\n(Draft only — not posted to Slack.)`
        : "I could not find grounded sources in Notion or GitHub for this question. Please clarify."),
    sources: llm?.sources?.length ? llm.sources : sources,
    confidence: llm?.confidence ?? (sources.length ? 0.72 : 0.35),
    status: "draft",
    createdAt: new Date().toISOString(),
  };

  await saveSuggestedReply(userId, reply);
  await logAutomation(userId, {
    type: "slack_reply",
    title: "Suggested Slack reply drafted",
    detail: "Stored as draft — not posted",
    status: "pending",
    evidence: reply.sources,
  });

  return reply;
}
