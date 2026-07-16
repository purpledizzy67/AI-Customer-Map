import { NextResponse } from "next/server";
import { DEMO_USER_ID, listActions, updateActionStatus } from "@/lib/db";
import { executeApprovedAction } from "@/lib/ai/automation";

export async function GET() {
  const actions = await listActions(DEMO_USER_ID);
  return NextResponse.json({ actions });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    actionId?: string;
    decision?: "approved" | "rejected";
    execute?: boolean;
  };

  if (!body.actionId || !body.decision) {
    return NextResponse.json(
      { error: "actionId and decision required" },
      { status: 400 },
    );
  }

  const updated = await updateActionStatus(
    DEMO_USER_ID,
    body.actionId,
    body.decision,
  );
  if (!updated) {
    return NextResponse.json({ error: "action_not_found" }, { status: 404 });
  }

  let execution = null;
  if (body.decision === "approved" && body.execute !== false) {
    const executed = await updateActionStatus(
      DEMO_USER_ID,
      body.actionId,
      "approved",
    );
    if (executed) {
      execution = await executeApprovedAction(DEMO_USER_ID, executed);
      await updateActionStatus(
        DEMO_USER_ID,
        body.actionId,
        execution.ok ? "executed" : "failed",
      );
    }
  }

  return NextResponse.json({ action: updated, execution });
}
