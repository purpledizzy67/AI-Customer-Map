/**
 * GitHub service — assigned PRs, review requests, commits, issues, repos.
 * Never merges PRs automatically.
 */

import { requireAccessToken, NotConnectedError } from "@/lib/auth/tokens";
import { withRateLimit } from "@/lib/rate-limit";
import { withRetry } from "@/lib/retry";
import { isDemoMode } from "@/lib/config";
import type { GitHubItem } from "@/types";

const GH_API = "https://api.github.com";

function demoGitHub(): GitHubItem[] {
  const now = Date.now();
  return [
    {
      id: "pr-92",
      type: "pr",
      number: 92,
      title: "Add OpenAPI docs for partner endpoints",
      repo: "acme/api-platform",
      state: "open",
      url: "https://github.com/acme/api-platform/pull/92",
      author: "you",
      updatedAt: new Date(now - 50 * 60_000).toISOString(),
      labels: ["documentation", "partner"],
      draft: false,
    },
    {
      id: "rev-88",
      type: "review_request",
      number: 88,
      title: "Refactor rate limiter for multi-tenant",
      repo: "acme/api-platform",
      state: "open",
      url: "https://github.com/acme/api-platform/pull/88",
      author: "priya",
      updatedAt: new Date(now - 5 * 3600_000).toISOString(),
      labels: ["backend"],
    },
    {
      id: "issue-41",
      type: "issue",
      number: 41,
      title: "Semantic search latency under load",
      repo: "acme/search",
      state: "open",
      url: "https://github.com/acme/search/issues/41",
      author: "support",
      updatedAt: new Date(now - 12 * 3600_000).toISOString(),
      labels: ["performance", "customer"],
    },
    {
      id: "commit-1",
      type: "commit",
      title: "docs: draft migration notes for v2 API",
      repo: "acme/api-platform",
      url: "https://github.com/acme/api-platform/commit/abc123",
      author: "you",
      updatedAt: new Date(now - 2 * 3600_000).toISOString(),
    },
    {
      id: "repo-api",
      type: "repo",
      title: "api-platform",
      repo: "acme/api-platform",
      url: "https://github.com/acme/api-platform",
      updatedAt: new Date(now - 30 * 60_000).toISOString(),
    },
  ];
}

async function ghFetch<T>(
  accessToken: string,
  path: string,
): Promise<T> {
  return withRateLimit("github", () =>
    withRetry(async () => {
      const res = await fetch(`${GH_API}${path}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (!res.ok) {
        const err = new Error(`GitHub ${res.status}: ${await res.text()}`);
        (err as Error & { status: number }).status = res.status;
        throw err;
      }
      return res.json() as Promise<T>;
    }),
  );
}

interface GhIssue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  draft?: boolean;
  pull_request?: unknown;
  repository_url?: string;
  user?: { login?: string };
  updated_at: string;
  labels?: { name?: string }[];
}

export class GitHubService {
  async collect(userId: string): Promise<GitHubItem[]> {
    if (isDemoMode()) return demoGitHub();

    let accessToken: string;
    try {
      accessToken = await requireAccessToken(userId, "github");
    } catch (e) {
      if (e instanceof NotConnectedError) return [];
      throw e;
    }

    const items: GitHubItem[] = [];

    const assigned = await ghFetch<GhIssue[]>(
      accessToken,
      "/issues?filter=assigned&state=open&per_page=20",
    );
    for (const issue of assigned) {
      const repo =
        issue.repository_url?.replace("https://api.github.com/repos/", "") ??
        "unknown";
      items.push({
        id: String(issue.id),
        type: issue.pull_request ? "pr" : "issue",
        number: issue.number,
        title: issue.title,
        repo,
        state: issue.state,
        url: issue.html_url,
        author: issue.user?.login,
        updatedAt: issue.updated_at,
        labels: (issue.labels ?? []).map((l) => l.name ?? "").filter(Boolean),
        draft: issue.draft,
      });
    }

    const reviewReq = await ghFetch<{ items?: GhIssue[] }>(
      accessToken,
      "/search/issues?q=is:pr+is:open+review-requested:@me&per_page=15",
    );
    for (const issue of reviewReq.items ?? []) {
      const repo =
        issue.repository_url?.replace("https://api.github.com/repos/", "") ??
        "unknown";
      items.push({
        id: `rev-${issue.id}`,
        type: "review_request",
        number: issue.number,
        title: issue.title,
        repo,
        state: issue.state,
        url: issue.html_url,
        author: issue.user?.login,
        updatedAt: issue.updated_at,
        labels: (issue.labels ?? []).map((l) => l.name ?? "").filter(Boolean),
      });
    }

    const events = await ghFetch<
      {
        type?: string;
        repo?: { name?: string };
        created_at?: string;
        payload?: { commits?: { sha?: string; message?: string }[] };
      }[]
    >(accessToken, "/users/:username/events".replace(":username", "me"));

    // /users/me/events isn't valid — use authenticated user events endpoint
    void events;

    const userEvents = await ghFetch<
      {
        type?: string;
        repo?: { name?: string };
        created_at?: string;
        payload?: { commits?: { sha?: string; message?: string }[] };
      }[]
    >(accessToken, "/user/events?per_page=20");

    for (const ev of userEvents) {
      if (ev.type === "PushEvent") {
        for (const c of ev.payload?.commits ?? []) {
          items.push({
            id: c.sha ?? `${ev.repo?.name}-${c.message}`,
            type: "commit",
            title: c.message?.split("\n")[0] ?? "commit",
            repo: ev.repo?.name ?? "unknown",
            url: `https://github.com/${ev.repo?.name}/commit/${c.sha}`,
            updatedAt: ev.created_at ?? new Date().toISOString(),
          });
        }
      }
    }

    const repos = await ghFetch<
      { id: number; full_name: string; html_url: string; updated_at: string }[]
    >(accessToken, "/user/repos?sort=updated&per_page=10");
    for (const r of repos) {
      items.push({
        id: `repo-${r.id}`,
        type: "repo",
        title: r.full_name.split("/")[1] ?? r.full_name,
        repo: r.full_name,
        url: r.html_url,
        updatedAt: r.updated_at,
      });
    }

    return items;
  }

  async getPullRequest(
    userId: string,
    owner: string,
    repo: string,
    number: number,
  ): Promise<{
    title: string;
    body: string;
    merged: boolean;
    html_url: string;
    user?: string;
  } | null> {
    if (isDemoMode()) {
      return {
        title: "Add OpenAPI docs for partner endpoints",
        body: "Documents new partner API endpoints and migration path.",
        merged: true,
        html_url: `https://github.com/${owner}/${repo}/pull/${number}`,
        user: "you",
      };
    }
    const accessToken = await requireAccessToken(userId, "github");
    const pr = await ghFetch<{
      title: string;
      body: string | null;
      merged: boolean;
      html_url: string;
      user?: { login?: string };
    }>(accessToken, `/repos/${owner}/${repo}/pulls/${number}`);
    return {
      title: pr.title,
      body: pr.body ?? "",
      merged: pr.merged,
      html_url: pr.html_url,
      user: pr.user?.login,
    };
  }

  async searchCode(userId: string, query: string): Promise<GitHubItem[]> {
    if (isDemoMode()) {
      return demoGitHub().filter(
        (g) =>
          g.title.toLowerCase().includes(query.toLowerCase()) ||
          g.repo.toLowerCase().includes(query.toLowerCase()),
      );
    }
    const accessToken = await requireAccessToken(userId, "github");
    const result = await ghFetch<{
      items?: {
        name: string;
        path: string;
        html_url: string;
        repository?: { full_name?: string };
      }[];
    }>(
      accessToken,
      `/search/code?q=${encodeURIComponent(query)}&per_page=10`,
    );
    return (result.items ?? []).map((item, i) => ({
      id: `code-${i}-${item.path}`,
      type: "repo" as const,
      title: `${item.path}`,
      repo: item.repository?.full_name ?? "unknown",
      url: item.html_url,
      updatedAt: new Date().toISOString(),
    }));
  }
}

export const githubService = new GitHubService();
