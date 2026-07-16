import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/lib/db";
import { runCollectAnalyzePipeline } from "@/workflows/collectPipeline";

export async function POST() {
  try {
    const result = await runCollectAnalyzePipeline(DEMO_USER_ID);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "collect_failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return POST();
}
