import { NextResponse } from "next/server";
import { DEMO_USER_ID, listChatMessages } from "@/lib/db";
import { chatAsk } from "@/workflows/chat";

export async function GET() {
  const messages = await listChatMessages(DEMO_USER_ID);
  return NextResponse.json({ messages });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { message?: string };
  if (!body.message?.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }
  const reply = await chatAsk(DEMO_USER_ID, body.message.trim());
  const messages = await listChatMessages(DEMO_USER_ID);
  return NextResponse.json({ reply, messages });
}
