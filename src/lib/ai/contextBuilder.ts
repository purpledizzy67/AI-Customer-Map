/**
 * Unified Context Builder
 *
 * App → Service Layer → Unified Context Builder → LLM → Action Generator → Automation
 *
 * The LLM never calls APIs directly — it only receives this merged context.
 */

import { gmailService } from "@/services/gmailService";
import { calendarService } from "@/services/calendarService";
import { slackService } from "@/services/slackService";
import { githubService } from "@/services/githubService";
import { notionService } from "@/services/notionService";
import { saveContextSnapshot, addTimelineEvent, logAutomation } from "@/lib/db";
import type { Provider, UnifiedContext } from "@/types";

export async function buildUnifiedContext(
  userId: string,
  options: { projectNames?: string[] } = {},
): Promise<UnifiedContext> {
  const timestamp = new Date().toISOString();
  const collectionErrors: UnifiedContext["collectionErrors"] = [];

  const settle = async <T>(
    provider: Provider,
    fn: () => Promise<T>,
    fallback: T,
  ): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      collectionErrors.push({
        provider,
        message: error instanceof Error ? error.message : String(error),
      });
      return fallback;
    }
  };

  const [emails, meetings, slack, github, notion] = await Promise.all([
    settle("gmail", () => gmailService.collect(userId, options), []),
    settle("calendar", () => calendarService.collect(userId), []),
    settle("slack", () => slackService.collect(userId), []),
    settle("github", () => githubService.collect(userId), []),
    settle("notion", () => notionService.collect(userId), []),
  ]);

  const context: UnifiedContext = {
    userId,
    emails,
    meetings,
    github,
    slack,
    notion,
    timestamp,
    collectionErrors,
  };

  await saveContextSnapshot(userId, context);
  await logAutomation(userId, {
    type: "collect_context",
    title: "Collected work context",
    detail: `emails=${emails.length} meetings=${meetings.length} slack=${slack.length} github=${github.length} notion=${notion.length}`,
    status: collectionErrors.length ? "pending" : "success",
    metadata: { collectionErrors },
  });

  await addTimelineEvent(userId, {
    provider: "system",
    title: "Context collected",
    description: `Merged signals from ${5 - collectionErrors.length}/5 providers`,
    timestamp,
  });

  return context;
}
