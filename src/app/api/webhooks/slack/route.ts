import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/lib/db";
import { draftSlackReply } from "@/workflows/slackDraft";
import { config } from "@/lib/config";
import { createHmac, timingSafeEqual } from "crypto";

function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean {
  if (!signingSecret) return true; // demo / unset
  const base = `v0:${timestamp}:${body}`;
  const digest = `v0=${createHmac("sha256", signingSecret).update(body).digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Slack Events API webhook.
 * On app_mention / message questions → draft suggested reply (never auto-post).
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  if (
    config.slack.signingSecret &&
    !verifySlackSignature(config.slack.signingSecret, timestamp, raw, signature)
  ) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const payload = JSON.parse(raw) as {
    type?: string;
    challenge?: string;
    event?: {
      type?: string;
      text?: string;
      channel?: string;
      thread_ts?: string;
      ts?: string;
      bot_id?: string;
    };
  };

  if (payload.type === "url_verification" && payload.challenge) {
    return NextResponse.json({ challenge: payload.challenge });
  }

  const event = payload.event;
  if (event?.bot_id) {
    return NextResponse.json({ ok: true, ignored: "bot" });
  }

  if (
    event &&
    (event.type === "app_mention" || event.type === "message") &&
    event.text &&
    event.channel
  ) {
    const question = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();
    if (question) {
      const reply = await draftSlackReply(DEMO_USER_ID, {
        question,
        channelId: event.channel,
        threadTs: event.thread_ts ?? event.ts,
      });
      return NextResponse.json({
        ok: true,
        suggestedReplyId: reply.id,
        posted: false,
        note: "Draft stored — approval required before posting",
      });
    }
  }

  return NextResponse.json({ ok: true });
}
