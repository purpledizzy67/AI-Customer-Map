import { NextResponse } from "next/server";
import { DEMO_USER_ID, listTimeline } from "@/lib/db";

export async function GET() {
  const events = await listTimeline(DEMO_USER_ID, 100);
  return NextResponse.json({ events });
}
