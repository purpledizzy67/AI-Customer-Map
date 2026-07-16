import { NextResponse } from "next/server";
import {
  DEMO_USER_ID,
  getLatestAnalysis,
  getLatestContext,
  listActions,
  listAutomation,
  listMeetingBriefs,
  listOAuthAccounts,
  listProjects,
  listSuggestedReplies,
  listTimeline,
  getMorningDashboard,
  getEveningSummary,
} from "@/lib/db";
import { isDemoMode } from "@/lib/config";
import { todayDateString } from "@/utils/helpers";
import { runCollectAnalyzePipeline } from "@/workflows/collectPipeline";
import { generateMorningDashboard } from "@/workflows/morningDashboard";

export async function GET(request: Request) {
  const userId = DEMO_USER_ID;
  const url = new URL(request.url);
  const refresh = url.searchParams.get("refresh") === "1";

  try {
    if (refresh || !(await getLatestContext(userId))) {
      await runCollectAnalyzePipeline(userId);
    }

    const date = todayDateString();
    let morning = await getMorningDashboard(userId, date);
    if (!morning) {
      morning = await generateMorningDashboard(userId, date);
    }

    const [
      analysis,
      context,
      actions,
      automation,
      briefs,
      accounts,
      projects,
      replies,
      timeline,
      evening,
    ] = await Promise.all([
      getLatestAnalysis(userId),
      getLatestContext(userId),
      listActions(userId),
      listAutomation(userId, 30),
      listMeetingBriefs(userId),
      listOAuthAccounts(userId),
      listProjects(userId),
      listSuggestedReplies(userId),
      listTimeline(userId, 40),
      getEveningSummary(userId, date),
    ]);

    return NextResponse.json({
      demoMode: isDemoMode(),
      analysis,
      context,
      actions,
      automation,
      briefs,
      accounts,
      projects,
      replies,
      timeline,
      morning,
      evening,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "dashboard_failed" },
      { status: 500 },
    );
  }
}
