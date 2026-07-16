import { describe, expect, it } from "vitest";
import { gmailService } from "@/services/gmailService";
import { calendarService } from "@/services/calendarService";
import { slackService } from "@/services/slackService";
import { githubService } from "@/services/githubService";
import { notionService } from "@/services/notionService";
import { buildUnifiedContext } from "@/lib/ai/contextBuilder";
import { slugify } from "@/utils/helpers";

process.env.DEMO_MODE = "true";
process.env.ENCRYPTION_KEY = "test-encryption-key-32chars-min!!";

const USER = "00000000-0000-4000-8000-000000000001";

describe("service collectors (demo)", () => {
  it("gmail returns unread/starred signals", async () => {
    const emails = await gmailService.collect(USER);
    expect(emails.length).toBeGreaterThan(0);
    expect(emails.some((e) => e.unread || e.starred)).toBe(true);
  });

  it("calendar returns meetings", async () => {
    const meetings = await calendarService.collect(USER);
    expect(meetings.length).toBeGreaterThan(0);
  });

  it("slack returns mentions", async () => {
    const items = await slackService.collect(USER);
    expect(items.some((s) => s.type === "mention")).toBe(true);
  });

  it("github returns PRs", async () => {
    const items = await githubService.collect(USER);
    expect(items.some((g) => g.type === "pr")).toBe(true);
  });

  it("notion returns docs/tasks", async () => {
    const items = await notionService.collect(USER);
    expect(items.length).toBeGreaterThan(0);
  });
});

describe("unified context builder", () => {
  it("merges all providers into one object", async () => {
    const ctx = await buildUnifiedContext(USER);
    expect(ctx.emails.length).toBeGreaterThan(0);
    expect(ctx.meetings.length).toBeGreaterThan(0);
    expect(ctx.slack.length).toBeGreaterThan(0);
    expect(ctx.github.length).toBeGreaterThan(0);
    expect(ctx.notion.length).toBeGreaterThan(0);
    expect(ctx.timestamp).toBeTruthy();
  });
});

describe("slugify", () => {
  it("normalizes project names", () => {
    expect(slugify("API Platform")).toBe("api-platform");
  });
});
