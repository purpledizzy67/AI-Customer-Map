/**
 * Master collect + analyze + conditional prepare pipeline (every 15 minutes).
 */

import { buildUnifiedContext } from "@/lib/ai/contextBuilder";
import { analyzeContext } from "@/lib/ai/orchestrator";
import { maybeAutoPrepareWork } from "@/workflows/prepareWork";
import { buildMeetingBriefsForUpcoming } from "@/workflows/meetingBrief";
import { embedAndStoreDailyContext } from "@/workflows/embeddings";
import { notifyN8n } from "@/lib/ai/automation";
import { config } from "@/lib/config";
import type { PriorityAnalysis, ProjectBundle, UnifiedContext, MeetingBrief } from "@/types";

export interface PipelineResult {
  context: UnifiedContext;
  analysis: PriorityAnalysis;
  prepared: ProjectBundle | null;
  meetingBriefs: MeetingBrief[];
}

export async function runCollectAnalyzePipeline(
  userId: string,
): Promise<PipelineResult> {
  const context = await buildUnifiedContext(userId, {
    projectNames: ["API Platform", "Search", "Roadmap"],
  });
  const analysis = await analyzeContext(context);
  const prepared = await maybeAutoPrepareWork(userId);
  const meetingBriefs = await buildMeetingBriefsForUpcoming(userId, 30);
  await embedAndStoreDailyContext(userId, context);

  await notifyN8n(config.n8n.collectWebhook, {
    userId,
    timestamp: context.timestamp,
    priority: analysis.priority,
    confidence: analysis.confidence,
  });

  return { context, analysis, prepared, meetingBriefs };
}
