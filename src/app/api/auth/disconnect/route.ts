import { NextResponse } from "next/server";
import { deleteOAuthAccount, DEMO_USER_ID } from "@/lib/db";
import type { Provider } from "@/types";

export async function POST(request: Request) {
  const body = (await request.json()) as { provider?: Provider };
  if (!body.provider) {
    return NextResponse.json({ error: "provider required" }, { status: 400 });
  }
  await deleteOAuthAccount(DEMO_USER_ID, body.provider);
  return NextResponse.json({ ok: true });
}
