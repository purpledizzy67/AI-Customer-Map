/**
 * Semantic search across connected apps (embeddings + live provider search).
 */

import { searchEmbeddings } from "@/lib/db";
import { notionService } from "@/services/notionService";
import { githubService } from "@/services/githubService";
import { slackService } from "@/services/slackService";
import type { SearchResult } from "@/types";

export async function semanticSearch(
  userId: string,
  query: string,
): Promise<SearchResult[]> {
  const [memory, notion, github, slack] = await Promise.all([
    searchEmbeddings(userId, query, 10),
    notionService.search(userId, query).catch(() => []),
    githubService.searchCode(userId, query).catch(() => []),
    slackService.search(userId, query).catch(() => []),
  ]);

  const results: SearchResult[] = [
    ...memory.map((m) => ({
      id: m.id,
      provider: m.sourceProvider as SearchResult["provider"],
      title: m.content.slice(0, 80),
      snippet: m.content,
      score: m.score,
    })),
    ...notion.map((n) => ({
      id: n.id,
      provider: "notion" as const,
      title: n.title,
      snippet: `${n.type} · edited ${n.lastEdited}`,
      url: n.url,
      score: 0.7,
      timestamp: n.lastEdited,
    })),
    ...github.map((g) => ({
      id: g.id,
      provider: "github" as const,
      title: g.title,
      snippet: g.repo,
      url: g.url,
      score: 0.7,
      timestamp: g.updatedAt,
    })),
    ...slack.map((s) => ({
      id: s.id,
      provider: "slack" as const,
      title: s.channelName,
      snippet: s.text,
      url: s.permalink,
      score: 0.65,
      timestamp: s.timestamp,
    })),
  ];

  return results.sort((a, b) => b.score - a.score).slice(0, 25);
}
