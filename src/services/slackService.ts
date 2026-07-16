/**
 * Slack service — mentions, unread channels, assigned threads, reactions.
 * Never posts replies automatically.
 */

import { requireAccessToken, NotConnectedError } from "@/lib/auth/tokens";
import { withRateLimit } from "@/lib/rate-limit";
import { withRetry } from "@/lib/retry";
import { isDemoMode } from "@/lib/config";
import type { SlackItem } from "@/types";

const SLACK_API = "https://slack.com/api";

function demoSlack(): SlackItem[] {
  const now = Date.now();
  return [
    {
      id: "S1",
      channelId: "C-eng",
      channelName: "#engineering",
      type: "mention",
      text: "<@UDEMO> can you update the OpenAPI spec for the partner endpoints before the 2pm review?",
      user: "UJOHN",
      timestamp: new Date(now - 20 * 60_000).toISOString(),
      permalink: "https://acme.slack.com/archives/C-eng/p1",
      unread: true,
    },
    {
      id: "S2",
      channelId: "C-product",
      channelName: "#product",
      type: "thread",
      text: "Assigned: draft architecture summary for Search & RAG planning.",
      user: "UPRIYA",
      timestamp: new Date(now - 90 * 60_000).toISOString(),
      threadTs: "1710000000.000200",
      permalink: "https://acme.slack.com/archives/C-product/p2",
      unread: true,
    },
    {
      id: "S3",
      channelId: "C-eng",
      channelName: "#engineering",
      type: "reaction",
      text: "PR #92 looks good — :eyes: from design",
      user: "UDESIGN",
      timestamp: new Date(now - 2 * 3600_000).toISOString(),
      permalink: "https://acme.slack.com/archives/C-eng/p3",
    },
    {
      id: "S4",
      channelId: "D-dm",
      channelName: "dm-support",
      type: "dm",
      text: "Customer asked how migration notes work for the new API version.",
      user: "USUPPORT",
      timestamp: new Date(now - 4 * 3600_000).toISOString(),
      unread: true,
    },
  ];
}

async function slackApi<T>(
  accessToken: string,
  method: string,
  params: Record<string, string> = {},
): Promise<T> {
  return withRateLimit("slack", () =>
    withRetry(async () => {
      const url = new URL(`${SLACK_API}/${method}`);
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = (await res.json()) as T & { ok?: boolean; error?: string };
      if (!res.ok || (data as { ok?: boolean }).ok === false) {
        const err = new Error(
          `Slack ${method}: ${(data as { error?: string }).error ?? res.status}`,
        );
        (err as Error & { status: number }).status = res.status || 500;
        throw err;
      }
      return data;
    }),
  );
}

export class SlackService {
  async collect(userId: string): Promise<SlackItem[]> {
    if (isDemoMode()) return demoSlack();

    let accessToken: string;
    try {
      accessToken = await requireAccessToken(userId, "slack");
    } catch (e) {
      if (e instanceof NotConnectedError) return [];
      throw e;
    }

    const items: SlackItem[] = [];

    try {
      const mentions = await slackApi<{
        messages?: {
          matches?: {
            iid?: string;
            channel?: { id?: string; name?: string };
            text?: string;
            username?: string;
            ts?: string;
            permalink?: string;
          }[];
        };
      }>(accessToken, "search.messages", {
        query: "is:mention",
        count: "20",
        sort: "timestamp",
      });

      for (const m of mentions.messages?.matches ?? []) {
        items.push({
          id: m.iid ?? m.ts ?? Math.random().toString(36),
          channelId: m.channel?.id ?? "",
          channelName: m.channel?.name ? `#${m.channel.name}` : "unknown",
          type: "mention",
          text: m.text ?? "",
          user: m.username ?? "unknown",
          timestamp: m.ts
            ? new Date(Number(m.ts.split(".")[0]) * 1000).toISOString()
            : new Date().toISOString(),
          permalink: m.permalink,
          unread: true,
        });
      }
    } catch {
      // Search may require additional scopes; continue with other signals
    }

    const convos = await slackApi<{
      channels?: {
        id: string;
        name?: string;
        is_im?: boolean;
        is_member?: boolean;
        unread_count?: number;
      }[];
    }>(accessToken, "conversations.list", {
      types: "public_channel,private_channel,im,mpim",
      limit: "50",
      exclude_archived: "true",
    });

    for (const ch of convos.channels ?? []) {
      if ((ch.unread_count ?? 0) > 0) {
        items.push({
          id: `unread-${ch.id}`,
          channelId: ch.id,
          channelName: ch.is_im ? "dm" : `#${ch.name ?? ch.id}`,
          type: ch.is_im ? "dm" : "unread",
          text: `${ch.unread_count} unread message(s)`,
          user: "system",
          timestamp: new Date().toISOString(),
          unread: true,
        });
      }
    }

    return items;
  }

  /**
   * Search Slack for context matching a question (read-only).
   */
  async search(userId: string, query: string): Promise<SlackItem[]> {
    if (isDemoMode()) {
      return demoSlack().filter((s) =>
        s.text.toLowerCase().includes(query.toLowerCase()),
      );
    }
    const accessToken = await requireAccessToken(userId, "slack");
    const result = await slackApi<{
      messages?: {
        matches?: {
          iid?: string;
          channel?: { id?: string; name?: string };
          text?: string;
          username?: string;
          ts?: string;
          permalink?: string;
        }[];
      };
    }>(accessToken, "search.messages", { query, count: "10" });

    return (result.messages?.matches ?? []).map((m) => ({
      id: m.iid ?? m.ts ?? Math.random().toString(36),
      channelId: m.channel?.id ?? "",
      channelName: m.channel?.name ? `#${m.channel.name}` : "unknown",
      type: "thread" as const,
      text: m.text ?? "",
      user: m.username ?? "unknown",
      timestamp: m.ts
        ? new Date(Number(m.ts.split(".")[0]) * 1000).toISOString()
        : new Date().toISOString(),
      permalink: m.permalink,
    }));
  }
}

export const slackService = new SlackService();
