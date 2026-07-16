import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/lib/db";
import { generateEveningSummary } from "@/workflows/eveningSummary";
import { notifyN8n } from "@/lib/ai/automation";
import { config } from "@/lib/config";

export async function POST() {
  const summary = await generateEveningSummary(DEMO_USER_ID);
  await notifyN8n(config.n8n.eveningWebhook, { summary });
  return NextResponse.json(summary);
}

export async function GET() {
  return POST();
}
