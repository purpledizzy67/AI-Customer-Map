/**
 * Notion service — pages edited today, databases, assigned tasks, docs.
 */

import { requireAccessToken, NotConnectedError } from "@/lib/auth/tokens";
import { withRateLimit } from "@/lib/rate-limit";
import { withRetry } from "@/lib/retry";
import { isDemoMode } from "@/lib/config";
import type { NotionItem } from "@/types";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function demoNotion(): NotionItem[] {
  const now = Date.now();
  return [
    {
      id: "page-api-docs",
      type: "doc",
      title: "API Platform — Partner Integration Guide",
      url: "https://notion.so/acme/api-partner-guide",
      lastEdited: new Date(now - 70 * 60_000).toISOString(),
      status: "In progress",
      assignee: "You",
    },
    {
      id: "task-1",
      type: "task",
      title: "Finish OpenAPI examples for /v2/search",
      url: "https://notion.so/acme/task-openapi",
      lastEdited: new Date(now - 3 * 3600_000).toISOString(),
      status: "Doing",
      assignee: "You",
      parent: "Sprint Board",
    },
    {
      id: "db-projects",
      type: "database",
      title: "Active Projects",
      url: "https://notion.so/acme/active-projects",
      lastEdited: new Date(now - 8 * 3600_000).toISOString(),
    },
    {
      id: "page-arch",
      type: "page",
      title: "Search & RAG Architecture",
      url: "https://notion.so/acme/search-rag-arch",
      lastEdited: new Date(now - 20 * 3600_000).toISOString(),
      status: "Draft",
    },
  ];
}

async function notionFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  return withRateLimit("notion", () =>
    withRetry(async () => {
      const res = await fetch(`${NOTION_API}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
      if (!res.ok) {
        const err = new Error(`Notion ${res.status}: ${await res.text()}`);
        (err as Error & { status: number }).status = res.status;
        throw err;
      }
      return res.json() as Promise<T>;
    }),
  );
}

function extractTitle(props: Record<string, unknown> | undefined): string {
  if (!props) return "Untitled";
  for (const value of Object.values(props)) {
    if (
      value &&
      typeof value === "object" &&
      "type" in value &&
      (value as { type: string }).type === "title"
    ) {
      const title = (value as { title?: { plain_text?: string }[] }).title;
      return title?.map((t) => t.plain_text ?? "").join("") || "Untitled";
    }
  }
  return "Untitled";
}

export class NotionService {
  async collect(userId: string): Promise<NotionItem[]> {
    if (isDemoMode()) return demoNotion();

    let accessToken: string;
    try {
      accessToken = await requireAccessToken(userId, "notion");
    } catch (e) {
      if (e instanceof NotConnectedError) return [];
      throw e;
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const search = await notionFetch<{
      results?: {
        id: string;
        object: string;
        url?: string;
        last_edited_time?: string;
        properties?: Record<string, unknown>;
        parent?: { type?: string; database_id?: string };
      }[];
    }>(accessToken, "/search", {
      method: "POST",
      body: JSON.stringify({
        sort: { direction: "descending", timestamp: "last_edited_time" },
        page_size: 30,
      }),
    });

    const items: NotionItem[] = [];
    for (const page of search.results ?? []) {
      const lastEdited = page.last_edited_time ?? new Date().toISOString();
      const editedToday = new Date(lastEdited) >= startOfDay;
      const title = extractTitle(page.properties);
      let type: NotionItem["type"] = page.object === "database" ? "database" : "page";
      if (/task|todo|checklist/i.test(title)) type = "task";
      if (/doc|guide|spec|architecture/i.test(title)) type = "doc";

      if (editedToday || type === "task" || type === "database") {
        items.push({
          id: page.id,
          type,
          title,
          url: page.url,
          lastEdited,
          parent: page.parent?.database_id,
        });
      }
    }

    return items;
  }

  async search(userId: string, query: string): Promise<NotionItem[]> {
    if (isDemoMode()) {
      return demoNotion().filter((n) =>
        n.title.toLowerCase().includes(query.toLowerCase()),
      );
    }
    const accessToken = await requireAccessToken(userId, "notion");
    const result = await notionFetch<{
      results?: {
        id: string;
        object: string;
        url?: string;
        last_edited_time?: string;
        properties?: Record<string, unknown>;
      }[];
    }>(accessToken, "/search", {
      method: "POST",
      body: JSON.stringify({
        query,
        page_size: 15,
      }),
    });

    return (result.results ?? []).map((page) => ({
      id: page.id,
      type: page.object === "database" ? ("database" as const) : ("page" as const),
      title: extractTitle(page.properties),
      url: page.url,
      lastEdited: page.last_edited_time ?? new Date().toISOString(),
    }));
  }
}

export const notionService = new NotionService();
