/**
 * Daily embeddings of work context for long-term memory / semantic search.
 */

import { embedTexts } from "@/lib/openai/client";
import { saveEmbedding } from "@/lib/db";
import type { UnifiedContext } from "@/types";

export async function embedAndStoreDailyContext(
  userId: string,
  context: UnifiedContext,
): Promise<number> {
  const chunks: { provider: string; sourceId: string; content: string }[] = [];

  for (const e of context.emails) {
    chunks.push({
      provider: "gmail",
      sourceId: e.id,
      content: `Email: ${e.subject} — ${e.snippet}`,
    });
  }
  for (const m of context.meetings) {
    chunks.push({
      provider: "calendar",
      sourceId: m.id,
      content: `Meeting: ${m.title} — ${m.description ?? ""} attendees: ${m.attendees.map((a) => a.email).join(", ")}`,
    });
  }
  for (const s of context.slack) {
    chunks.push({
      provider: "slack",
      sourceId: s.id,
      content: `Slack ${s.channelName}: ${s.text}`,
    });
  }
  for (const g of context.github) {
    chunks.push({
      provider: "github",
      sourceId: g.id,
      content: `GitHub ${g.type} ${g.repo}: ${g.title}`,
    });
  }
  for (const n of context.notion) {
    chunks.push({
      provider: "notion",
      sourceId: n.id,
      content: `Notion ${n.type}: ${n.title}`,
    });
  }

  const limited = chunks.slice(0, 40);
  if (!limited.length) return 0;

  const embeddings = await embedTexts(limited.map((c) => c.content));
  for (let i = 0; i < limited.length; i++) {
    const chunk = limited[i]!;
    await saveEmbedding({
      userId,
      sourceProvider: chunk.provider,
      sourceId: chunk.sourceId,
      content: chunk.content,
      embedding: embeddings[i],
      metadata: { collectedAt: context.timestamp },
    });
  }
  return limited.length;
}
