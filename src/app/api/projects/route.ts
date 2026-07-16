import { NextResponse } from "next/server";
import { DEMO_USER_ID, listProjects } from "@/lib/db";
import { maybeAutoPrepareWork, prepareProjectWork } from "@/workflows/prepareWork";
import { getLatestAnalysis } from "@/lib/db";

export async function GET() {
  const projects = await listProjects(DEMO_USER_ID);
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    project?: string;
    force?: boolean;
  };
  if (body.project) {
    const analysis = await getLatestAnalysis(DEMO_USER_ID);
    const bundle = await prepareProjectWork(
      DEMO_USER_ID,
      body.project,
      analysis?.confidence ?? 0.85,
      analysis?.evidence ?? [],
      analysis?.priority,
    );
    return NextResponse.json({ project: bundle });
  }
  const prepared = body.force
    ? await prepareProjectWork(
        DEMO_USER_ID,
        (await getLatestAnalysis(DEMO_USER_ID))?.project ?? "Untitled",
        0.9,
        (await getLatestAnalysis(DEMO_USER_ID))?.evidence ?? [],
      )
    : await maybeAutoPrepareWork(DEMO_USER_ID);
  return NextResponse.json({ project: prepared });
}
