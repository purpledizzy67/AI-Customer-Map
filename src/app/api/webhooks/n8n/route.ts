import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/lib/db";
import { runCollectAnalyzePipeline } from "@/workflows/collectPipeline";
import { generateMorningDashboard } from "@/workflows/morningDashboard";
import { generateEveningSummary } from "@/workflows/eveningSummary";

/**
 * n8n → app webhook bridge.
 * n8n schedules can hit this endpoint to trigger pipelines.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    workflow?: string;
  };

  switch (body.workflow) {
    case "collect": {
      const result = await runCollectAnalyzePipeline(DEMO_USER_ID);
      return NextResponse.json({ ok: true, result });
    }
    case "morning": {
      const dashboard = await generateMorningDashboard(DEMO_USER_ID);
      return NextResponse.json({ ok: true, dashboard });
    }
    case "evening": {
      const summary = await generateEveningSummary(DEMO_USER_ID);
      return NextResponse.json({ ok: true, summary });
    }
    default:
      return NextResponse.json(
        { error: "workflow must be collect|morning|evening" },
        { status: 400 },
      );
  }
}
