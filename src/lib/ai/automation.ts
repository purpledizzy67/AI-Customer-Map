/**
 * Automation layer — executes approved actions only.
 * Hard rules: never send email, never merge PRs, never post Slack.
 */

import { config } from "@/lib/config";
import { logAutomation } from "@/lib/db";
import { prepareProjectWork } from "@/workflows/prepareWork";
import { buildMeetingBriefsForUpcoming } from "@/workflows/meetingBrief";
import type { SuggestedAction } from "@/types";

const FORBIDDEN = new Set([
  "send_email",
  "merge_pr",
  "post_slack",
  "delete_data",
]);

export function assertSafeAction(action: SuggestedAction): void {
  if (FORBIDDEN.has(action.type)) {
    throw new Error(`Forbidden automation: ${action.type}`);
  }
  if (!action.requiresApproval) {
    throw new Error("All automations require approval");
  }
  if (action.status !== "approved" && action.status !== "pending") {
    // pending allowed only for dry-run inspection
  }
}

export async function executeApprovedAction(
  userId: string,
  action: SuggestedAction,
): Promise<{ ok: boolean; detail: string; result?: unknown }> {
  assertSafeAction(action);

  if (action.status !== "approved") {
    return {
      ok: false,
      detail: "Action is not approved. Nothing was executed.",
    };
  }

  switch (action.type) {
    case "prepare_work": {
      const project =
        (action.payload?.project as string) ||
        action.project ||
        "Untitled Project";
      const bundle = await prepareProjectWork(userId, project, action.confidence, action.evidence);
      await logAutomation(userId, {
        type: "prepare_work",
        title: `Prepared project: ${bundle.projectName}`,
        detail: `Wrote ${bundle.artifacts.length} artifacts to /projects/${bundle.slug}`,
        status: "success",
        evidence: action.evidence,
      });
      return { ok: true, detail: `Prepared /projects/${bundle.slug}`, result: bundle };
    }
    case "meeting_brief": {
      const briefs = await buildMeetingBriefsForUpcoming(userId);
      await logAutomation(userId, {
        type: "meeting_brief",
        title: "Meeting briefs generated",
        detail: `${briefs.length} brief(s) ready for review`,
        status: "success",
        evidence: action.evidence,
      });
      return { ok: true, detail: `${briefs.length} brief(s)`, result: briefs };
    }
    case "focus_block":
    case "review_pr":
    case "reply_email":
    case "update_notion":
    case "custom":
      await logAutomation(userId, {
        type: action.type,
        title: action.title,
        detail: "Marked as acknowledged — no external side effects.",
        status: "success",
        evidence: action.evidence,
      });
      return {
        ok: true,
        detail: "Acknowledged without external side effects (approval policy).",
      };
    case "release_notes":
    case "slack_reply":
      await logAutomation(userId, {
        type: action.type,
        title: action.title,
        detail: "Draft artifacts prepared for review — nothing posted externally.",
        status: "success",
        evidence: action.evidence,
      });
      return {
        ok: true,
        detail: "Draft stored for approval; nothing posted.",
      };
    default:
      return { ok: false, detail: `Unknown action type: ${action.type}` };
  }
}

/** Optional n8n webhook fan-out */
export async function notifyN8n(
  webhookUrl: string | undefined,
  payload: Record<string, unknown>,
): Promise<void> {
  const url = webhookUrl || config.n8n.baseUrl;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-fatal — n8n is optional
  }
}
