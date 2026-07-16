/**
 * Gmail service — never called directly by the LLM.
 * Collects unread, starred, recent, and project-mention emails.
 */

import { requireAccessToken, NotConnectedError } from "@/lib/auth/tokens";
import { withRateLimit } from "@/lib/rate-limit";
import { withRetry } from "@/lib/retry";
import { isDemoMode } from "@/lib/config";
import type { EmailItem } from "@/types";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GmailCollectOptions {
  projectNames?: string[];
  maxResults?: number;
}

function demoEmails(projectNames: string[] = ["API Platform"]): EmailItem[] {
  const now = Date.now();
  return [
    {
      id: "mail-1",
      threadId: "thread-1",
      subject: "Need API documentation before Friday launch",
      from: "John Chen <john@acme.com>",
      to: ["demo@workassistant.ai"],
      snippet:
        "Can we finish the API docs for the new endpoints? Blockers for the partner integration.",
      labels: ["INBOX", "UNREAD", "IMPORTANT"],
      starred: true,
      unread: true,
      mentionsProject: projectNames.slice(0, 1),
      receivedAt: new Date(now - 45 * 60_000).toISOString(),
      url: "https://mail.google.com/mail/u/0/#inbox/mail-1",
    },
    {
      id: "mail-2",
      threadId: "thread-2",
      subject: "Re: Q3 roadmap sync follow-ups",
      from: "Priya Shah <priya@acme.com>",
      to: ["demo@workassistant.ai"],
      snippet: "Please send the architecture summary we discussed yesterday.",
      labels: ["INBOX", "UNREAD"],
      starred: false,
      unread: true,
      mentionsProject: ["Roadmap"],
      receivedAt: new Date(now - 3 * 3600_000).toISOString(),
      url: "https://mail.google.com/mail/u/0/#inbox/mail-2",
    },
    {
      id: "mail-3",
      threadId: "thread-3",
      subject: "Customer feedback — search latency",
      from: "Support <support@acme.com>",
      to: ["demo@workassistant.ai"],
      snippet: "Enterprise customer reported slow semantic search responses.",
      labels: ["INBOX", "STARRED"],
      starred: true,
      unread: false,
      mentionsProject: ["Search"],
      receivedAt: new Date(now - 26 * 3600_000).toISOString(),
      url: "https://mail.google.com/mail/u/0/#inbox/mail-3",
    },
  ];
}

async function gmailFetch<T>(
  accessToken: string,
  path: string,
): Promise<T> {
  return withRateLimit("gmail", () =>
    withRetry(async () => {
      const res = await fetch(`${GMAIL_API}${path}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const err = new Error(`Gmail API ${res.status}: ${await res.text()}`);
        (err as Error & { status: number }).status = res.status;
        throw err;
      }
      return res.json() as Promise<T>;
    }),
  );
}

interface GmailMessageList {
  messages?: { id: string; threadId: string }[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet?: string;
  labelIds?: string[];
  payload?: {
    headers?: { name: string; value: string }[];
  };
  internalDate?: string;
}

function header(msg: GmailMessage, name: string): string {
  return (
    msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())
      ?.value ?? ""
  );
}

function toEmailItem(msg: GmailMessage, projectNames: string[]): EmailItem {
  const subject = header(msg, "Subject");
  const from = header(msg, "From");
  const to = header(msg, "To")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const hay = `${subject} ${msg.snippet ?? ""}`.toLowerCase();
  const mentionsProject = projectNames.filter((p) =>
    hay.includes(p.toLowerCase()),
  );
  return {
    id: msg.id,
    threadId: msg.threadId,
    subject,
    from,
    to,
    snippet: msg.snippet ?? "",
    labels: msg.labelIds ?? [],
    starred: (msg.labelIds ?? []).includes("STARRED"),
    unread: (msg.labelIds ?? []).includes("UNREAD"),
    mentionsProject: mentionsProject.length ? mentionsProject : undefined,
    receivedAt: msg.internalDate
      ? new Date(Number(msg.internalDate)).toISOString()
      : new Date().toISOString(),
    url: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
  };
}

async function listByQuery(
  accessToken: string,
  query: string,
  maxResults: number,
  projectNames: string[],
): Promise<EmailItem[]> {
  const list = await gmailFetch<GmailMessageList>(
    accessToken,
    `/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
  );
  const ids = list.messages ?? [];
  const items: EmailItem[] = [];
  for (const { id } of ids.slice(0, maxResults)) {
    const msg = await gmailFetch<GmailMessage>(
      accessToken,
      `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`,
    );
    items.push(toEmailItem(msg, projectNames));
  }
  return items;
}

export class GmailService {
  async collect(
    userId: string,
    options: GmailCollectOptions = {},
  ): Promise<EmailItem[]> {
    const projectNames = options.projectNames ?? [];
    const maxResults = options.maxResults ?? 10;

    if (isDemoMode()) {
      try {
        await requireAccessToken(userId, "google");
      } catch {
        return demoEmails(projectNames.length ? projectNames : ["API Platform"]);
      }
      // Demo with connected account still returns rich sample if no live key path
      return demoEmails(projectNames.length ? projectNames : ["API Platform"]);
    }

    let accessToken: string;
    try {
      accessToken = await requireAccessToken(userId, "google");
    } catch (e) {
      if (e instanceof NotConnectedError) return [];
      throw e;
    }

    const [unread, starred, recent, projectHits] = await Promise.all([
      listByQuery(accessToken, "is:unread", maxResults, projectNames),
      listByQuery(accessToken, "is:starred newer_than:14d", maxResults, projectNames),
      listByQuery(accessToken, "newer_than:3d", maxResults, projectNames),
      projectNames.length
        ? listByQuery(
            accessToken,
            projectNames.map((p) => `"${p}"`).join(" OR "),
            maxResults,
            projectNames,
          )
        : Promise.resolve([] as EmailItem[]),
    ]);

    const map = new Map<string, EmailItem>();
    for (const item of [...unread, ...starred, ...recent, ...projectHits]) {
      map.set(item.id, item);
    }
    return [...map.values()].sort(
      (a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt),
    );
  }
}

export const gmailService = new GmailService();
