import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/lib/db";
import { generateMorningDashboard } from "@/workflows/morningDashboard";
import { notifyN8n } from "@/lib/ai/automation";
import { config } from "@/lib/config";

export async function POST() {
  const dashboard = await generateMorningDashboard(DEMO_USER_ID);
  await notifyN8n(config.n8n.morningWebhook, { dashboard });
  return NextResponse.json(dashboard);
}

export async function GET() {
  return POST();
}
