import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCommunityById, upsertMembers } from "@/lib/db";
import { fetchDiscordMembers } from "@/lib/discord-members";
import { fetchSlackMembers } from "@/lib/slack-members";

const fetchSchema = z.object({
  communityId: z.string(),
  botToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { communityId, botToken } = fetchSchema.parse(body);

    const community = getCommunityById(communityId);
    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    if (!community.inviteUrl) {
      return NextResponse.json(
        { error: "Community has no invite URL to resolve members from" },
        { status: 400 }
      );
    }

    if (community.platform === "discord") {
      const token = botToken ?? process.env.DISCORD_BOT_TOKEN;
      const result = await fetchDiscordMembers({
        inviteUrl: community.inviteUrl,
        communityId: community.id,
        botToken: token,
      });

      upsertMembers(result.members);

      return NextResponse.json({
        success: true,
        fetched: result.members.length,
        source: result.source,
        guildId: result.guildId,
        limitation: result.limitation,
        members: result.members,
      });
    }

    if (community.platform === "slack") {
      const token = botToken ?? process.env.SLACK_BOT_TOKEN;
      if (!token) {
        return NextResponse.json(
          {
            error:
              "Slack member fetch requires a bot token with users:read scope. Set SLACK_BOT_TOKEN in .env or pass botToken in the request.",
          },
          { status: 400 }
        );
      }

      const result = await fetchSlackMembers({
        communityId: community.id,
        botToken: token,
      });

      upsertMembers(result.members);

      return NextResponse.json({
        success: true,
        fetched: result.members.length,
        source: "slack_api",
        limitation: result.limitation,
        members: result.members,
      });
    }

    return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Member fetch failed";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoints: {
      POST: "Fetch members for a community",
      body: {
        communityId: "string",
        botToken: "optional — overrides DISCORD_BOT_TOKEN / SLACK_BOT_TOKEN",
      },
    },
    discord: {
      widget: "Public API — online members only (~100 cap). Requires Server Widget enabled.",
      bot: "Full roster via DISCORD_BOT_TOKEN with GUILD_MEMBERS intent",
    },
    slack: {
      note: "Requires SLACK_BOT_TOKEN with users:read, installed in that workspace",
    },
  });
}
