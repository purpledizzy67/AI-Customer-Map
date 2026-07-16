import { describe, expect, it, beforeEach } from "vitest";
import { ensureApprovalGate, buildHeuristicActions } from "@/lib/ai/actionGenerator";
import { analyzeContext } from "@/lib/ai/orchestrator";
import type { UnifiedContext } from "@/types";

process.env.DEMO_MODE = "true";
process.env.ENCRYPTION_KEY = "test-encryption-key-32chars-min!!";

describe("action generator", () => {
  it("forces requiresApproval on all actions", () => {
    const actions = ensureApprovalGate([
      {
        type: "prepare_work",
        title: "Prep",
        description: "desc",
        confidence: 0.9,
        evidence: [],
      },
    ]);
    expect(actions[0]?.requiresApproval).toBe(true);
    expect(actions[0]?.status).toBe("pending");
  });

  it("builds prepare_work heuristic action", () => {
    const actions = buildHeuristicActions({
      priority: "Finish docs",
      project: "API Platform",
      confidence: 0.91,
      evidence: [
        {
          provider: "github",
          type: "pr",
          title: "PR #92",
          id: "92",
        },
      ],
      urgentWork: ["Meeting soon: API review"],
    });
    expect(actions.some((a) => a.type === "prepare_work")).toBe(true);
    expect(actions.some((a) => a.type === "meeting_brief")).toBe(true);
  });
});

describe("orchestrator heuristic analysis", () => {
  beforeEach(() => {
    process.env.DEMO_MODE = "true";
  });

  it("analyzes demo context with citations and confidence", async () => {
    const context: UnifiedContext = {
      userId: "00000000-0000-4000-8000-000000000001",
      timestamp: new Date().toISOString(),
      collectionErrors: [],
      emails: [
        {
          id: "1",
          threadId: "t",
          subject: "Need API documentation",
          from: "John <john@acme.com>",
          to: ["me@acme.com"],
          snippet: "finish docs",
          labels: ["UNREAD", "STARRED"],
          starred: true,
          unread: true,
          receivedAt: new Date().toISOString(),
        },
      ],
      meetings: [
        {
          id: "m1",
          title: "API documentation review",
          start: new Date(Date.now() + 20 * 60_000).toISOString(),
          end: new Date(Date.now() + 50 * 60_000).toISOString(),
          attendees: [{ email: "john@acme.com", name: "John" }],
        },
      ],
      slack: [
        {
          id: "s1",
          channelId: "C",
          channelName: "#engineering",
          type: "mention",
          text: "update OpenAPI before review",
          user: "U",
          timestamp: new Date().toISOString(),
        },
      ],
      github: [
        {
          id: "pr-92",
          type: "pr",
          number: 92,
          title: "Add OpenAPI docs for partner endpoints",
          repo: "acme/api-platform",
          state: "open",
          url: "https://github.com/acme/api-platform/pull/92",
          updatedAt: new Date().toISOString(),
        },
      ],
      notion: [
        {
          id: "n1",
          type: "doc",
          title: "API Platform — Partner Integration Guide",
          lastEdited: new Date().toISOString(),
        },
      ],
    };

    const analysis = await analyzeContext(context);
    expect(analysis.priority).toBeTruthy();
    expect(analysis.confidence).toBeGreaterThan(0.5);
    expect(analysis.evidence.length).toBeGreaterThan(0);
    expect(analysis.actions.every((a) => a.requiresApproval)).toBe(true);
  });
});
