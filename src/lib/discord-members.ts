import type { CommunityMember } from "@/types";

const DISCORD_API = "https://discord.com/api/v10";

export interface DiscordFetchOptions {
  inviteUrl: string;
  communityId: string;
  botToken?: string;
}

interface DiscordInvite {
  guild?: { id: string; name: string };
  code?: string;
}

interface DiscordWidgetMember {
  id: string;
  username: string;
  discriminator?: string;
  avatar?: string | null;
  avatar_url?: string;
  status?: string;
  game?: { name: string };
  nick?: string;
}

interface DiscordWidget {
  id: string;
  name: string;
  members?: DiscordWidgetMember[];
  presence_count?: number;
}

interface DiscordGuildMember {
  user: {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
    discriminator?: string;
  };
  nick?: string | null;
  roles?: string[];
}

export function extractDiscordInviteCode(inviteUrl: string): string | null {
  try {
    const url = new URL(inviteUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const code = parts[parts.length - 1];
    return code || null;
  } catch {
    const match = inviteUrl.match(
      /(?:discord\.gg|discord\.com\/invite)\/([a-zA-Z0-9-]+)/i
    );
    return match?.[1] ?? null;
  }
}

export async function resolveDiscordGuildId(
  inviteUrl: string
): Promise<{ guildId: string; guildName: string } | null> {
  const code = extractDiscordInviteCode(inviteUrl);
  if (!code) return null;

  const res = await fetch(`${DISCORD_API}/invites/${code}?with_counts=true`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as DiscordInvite;
  if (!data.guild?.id) return null;

  return { guildId: data.guild.id, guildName: data.guild.name };
}

function widgetMemberToCommunityMember(
  member: DiscordWidgetMember,
  communityId: string
): CommunityMember {
  const displayName =
    member.nick ||
    (member.discriminator && member.discriminator !== "0"
      ? `${member.username}#${member.discriminator}`
      : member.username);

  return {
    id: `${communityId}-discord-${member.id}`,
    communityId,
    platform: "discord",
    platformUserId: member.id,
    username: member.username,
    displayName,
    avatarUrl: member.avatar_url,
    status: member.status,
    activity: member.game?.name,
    source: "widget",
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchDiscordWidgetMembers(
  guildId: string,
  communityId: string
): Promise<{ members: CommunityMember[]; presenceCount?: number }> {
  const res = await fetch(
    `https://discord.com/api/guilds/${guildId}/widget.json`,
    { next: { revalidate: 0 } }
  );

  if (!res.ok) {
    throw new Error(
      "Discord widget is disabled for this server. Enable Server Widget in Discord settings, or add a bot with member access."
    );
  }

  const data = (await res.json()) as DiscordWidget;
  const members = (data.members ?? []).map((m) =>
    widgetMemberToCommunityMember(m, communityId)
  );

  return { members, presenceCount: data.presence_count };
}

async function fetchDiscordBotMembersPage(
  guildId: string,
  botToken: string,
  after?: string
): Promise<DiscordGuildMember[]> {
  const params = new URLSearchParams({ limit: "1000" });
  if (after) params.set("after", after);

  const res = await fetch(
    `${DISCORD_API}/guilds/${guildId}/members?${params}`,
    {
      headers: {
        Authorization: `Bot ${botToken}`,
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      `Discord bot member fetch failed (${res.status}). Ensure the bot is in the server with GUILD_MEMBERS intent. ${err.slice(0, 120)}`
    );
  }

  return (await res.json()) as DiscordGuildMember[];
}

function botMemberToCommunityMember(
  member: DiscordGuildMember,
  communityId: string
): CommunityMember {
  const { user } = member;
  const displayName =
    member.nick ||
    user.global_name ||
    (user.discriminator && user.discriminator !== "0"
      ? `${user.username}#${user.discriminator}`
      : user.username);

  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : undefined;

  return {
    id: `${communityId}-discord-${user.id}`,
    communityId,
    platform: "discord",
    platformUserId: user.id,
    username: user.username,
    displayName,
    avatarUrl,
    source: "bot",
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchDiscordBotMembers(
  guildId: string,
  communityId: string,
  botToken: string
): Promise<CommunityMember[]> {
  const all: CommunityMember[] = [];
  let after: string | undefined;

  for (let page = 0; page < 50; page++) {
    const batch = await fetchDiscordBotMembersPage(guildId, botToken, after);
    if (batch.length === 0) break;

    all.push(
      ...batch.map((m) => botMemberToCommunityMember(m, communityId))
    );

    if (batch.length < 1000) break;
    after = batch[batch.length - 1].user.id;
  }

  return all;
}

export async function fetchDiscordMembers(
  options: DiscordFetchOptions
): Promise<{
  members: CommunityMember[];
  source: "widget" | "bot";
  guildId: string;
  limitation?: string;
}> {
  const resolved = await resolveDiscordGuildId(options.inviteUrl);
  if (!resolved) {
    throw new Error("Could not resolve Discord server from invite URL");
  }

  const { guildId } = resolved;

  if (options.botToken) {
    const members = await fetchDiscordBotMembers(
      guildId,
      options.communityId,
      options.botToken
    );
    return {
      members,
      source: "bot",
      guildId,
      limitation:
        members.length === 0
          ? "Bot returned 0 members. Check bot permissions and GUILD_MEMBERS privileged intent."
          : undefined,
    };
  }

  const { members, presenceCount } = await fetchDiscordWidgetMembers(
    guildId,
    options.communityId
  );

  return {
    members,
    source: "widget",
    guildId,
    limitation:
      presenceCount && members.length < presenceCount
        ? `Widget API returns online members only (${members.length} of ~${presenceCount} online). Add DISCORD_BOT_TOKEN for the full member list.`
        : members.length === 0
          ? "No online members visible via widget. Enable Server Widget or add a bot token."
          : "Widget API shows online members only. Add DISCORD_BOT_TOKEN for the full roster.",
  };
}
