import type { CommunityMember } from "@/types";

interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  profile?: {
    display_name?: string;
    real_name?: string;
    image_72?: string;
    title?: string;
    status_text?: string;
  };
  is_bot?: boolean;
  deleted?: boolean;
}

interface SlackUsersListResponse {
  ok: boolean;
  members?: SlackUser[];
  response_metadata?: { next_cursor?: string };
  error?: string;
}

export function extractSlackWorkspace(inviteUrl: string): string | null {
  try {
    const url = new URL(inviteUrl);
    const host = url.hostname;
    const match = host.match(/^([a-z0-9-]+)\.slack\.com$/i);
    if (match) return match[1];

    const joinMatch = inviteUrl.match(/join\.slack\.com\/t\/([a-z0-9-]+)/i);
    return joinMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

function slackUserToMember(
  user: SlackUser,
  communityId: string
): CommunityMember {
  const displayName =
    user.profile?.display_name ||
    user.profile?.real_name ||
    user.real_name ||
    user.name;

  return {
    id: `${communityId}-slack-${user.id}`,
    communityId,
    platform: "slack",
    platformUserId: user.id,
    username: user.name,
    displayName,
    avatarUrl: user.profile?.image_72,
    activity: user.profile?.status_text,
    role: user.profile?.title,
    source: "slack_api",
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchSlackMembers(options: {
  communityId: string;
  botToken: string;
}): Promise<{ members: CommunityMember[]; limitation?: string }> {
  const all: SlackUser[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({ limit: "200" });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(
      `https://slack.com/api/users.list?${params}`,
      {
        headers: {
          Authorization: `Bearer ${options.botToken}`,
          Accept: "application/json",
        },
        next: { revalidate: 0 },
      }
    );

    const data = (await res.json()) as SlackUsersListResponse;
    if (!data.ok) {
      throw new Error(
        `Slack API error: ${data.error ?? "unknown"}. Token must have users:read scope and belong to this workspace.`
      );
    }

    all.push(...(data.members ?? []));
    cursor = data.response_metadata?.next_cursor;
    if (!cursor) break;
  }

  const members = all
    .filter((u) => !u.is_bot && !u.deleted)
    .map((u) => slackUserToMember(u, options.communityId));

  return {
    members,
    limitation:
      "Slack bot tokens are workspace-specific. Use a token installed in this Slack workspace with users:read scope.",
  };
}
