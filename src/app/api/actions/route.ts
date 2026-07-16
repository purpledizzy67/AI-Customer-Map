import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/lib/db";
import { draftSlackReply } from "@/workflows/slackDraft";
import { generateReleasePackage } from "@/workflows/releaseNotes";
import { buildMeetingBriefsForUpcoming } from "@/workflows/meetingBrief";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    type?: string;
    question?: string;
    channelId?: string;
    threadTs?: string;
    owner?: string;
    repo?: string;
    prNumber?: number;
  };

  switch (body.type) {
    case "slack_reply": {
      if (!body.question || !body.channelId) {
        return NextResponse.json(
          { error: "question and channelId required" },
          { status: 400 },
        );
      }
      const reply = await draftSlackReply(DEMO_USER_ID, {
        question: body.question,
        channelId: body.channelId,
        threadTs: body.threadTs,
      });
      return NextResponse.json({ reply });
    }
    case "release_notes": {
      if (!body.owner || !body.repo || !body.prNumber) {
        return NextResponse.json(
          { error: "owner, repo, prNumber required" },
          { status: 400 },
        );
      }
      const pkg = await generateReleasePackage(
        DEMO_USER_ID,
        body.owner,
        body.repo,
        body.prNumber,
      );
      return NextResponse.json({ package: pkg });
    }
    case "meeting_brief": {
      const briefs = await buildMeetingBriefsForUpcoming(DEMO_USER_ID);
      return NextResponse.json({ briefs });
    }
    default:
      return NextResponse.json({ error: "unknown type" }, { status: 400 });
  }
}
