import { NextResponse } from "next/server";
import { DEMO_USER_ID, getLatestContext } from "@/lib/db";
import { analyzeContext } from "@/lib/ai/orchestrator";
import { buildUnifiedContext } from "@/lib/ai/contextBuilder";

export async function POST() {
  try {
    let context = await getLatestContext(DEMO_USER_ID);
    if (!context) {
      context = await buildUnifiedContext(DEMO_USER_ID);
    }
    const analysis = await analyzeContext(context);
    return NextResponse.json(analysis);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "analyze_failed" },
      { status: 500 },
    );
  }
}
