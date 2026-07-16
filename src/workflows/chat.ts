/**
 * Chat interface — "What should I work on next?"
 * Grounded in context + semantic search; always cites evidence.
 */

import { respondJson } from "@/lib/openai/client";
import { CHAT_SYSTEM } from "@/prompts/workflows";
import { getLatestAnalysis, getLatestContext, newId, saveChatMessage } from "@/lib/db";
import { semanticSearch } from "@/workflows/semanticSearch";
import type { ChatMessage, EvidenceSource } from "@/types";

interface ChatLlm {
  answer?: string;
  confidence?: number;
  evidence?: EvidenceSource[];
}

export async function chatAsk(
  userId: string,
  question: string,
): Promise<ChatMessage> {
  const userMsg: ChatMessage = {
    id: newId(),
    role: "user",
    content: question,
    createdAt: new Date().toISOString(),
  };
  await saveChatMessage(userId, userMsg);

  const [context, analysis, searchHits] = await Promise.all([
    getLatestContext(userId),
    getLatestAnalysis(userId),
    semanticSearch(userId, question),
  ]);

  const llm = await respondJson<ChatLlm>({
    system: CHAT_SYSTEM,
    user: JSON.stringify({ question, context, analysis, searchHits }),
  });

  const evidence =
    llm?.evidence ??
    analysis?.evidence ??
    searchHits.slice(0, 5).map((s) => ({
      provider: s.provider,
      type: "search",
      id: s.id,
      title: s.title,
      snippet: s.snippet,
      url: s.url,
    }));

  const answer =
    llm?.answer ??
    (analysis
      ? `Based on your connected activity, work on: **${analysis.priority}** (project: ${analysis.project}).\n\nWhy: ${analysis.rationale}\n\nConfidence: ${Math.round(analysis.confidence * 100)}%`
      : "I don't have enough collected context yet. Run a context collection first.");

  const assistantMsg: ChatMessage = {
    id: newId(),
    role: "assistant",
    content: answer,
    evidence,
    confidence: llm?.confidence ?? analysis?.confidence ?? 0.6,
    createdAt: new Date().toISOString(),
  };
  await saveChatMessage(userId, assistantMsg);
  return assistantMsg;
}
