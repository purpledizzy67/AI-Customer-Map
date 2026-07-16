/**
 * Priority analysis prompt — forces citations and structured JSON.
 * Never invent sources that are not in the provided context.
 */

import type { UnifiedContext } from "@/types";

export const ANALYZE_SYSTEM_PROMPT = `You are a Proactive AI Work Assistant analyst.

Rules:
1. NEVER hallucinate. Only use facts present in the provided context JSON.
2. Every recommendation MUST cite evidence with provider, title, and id when available.
3. Do not invent emails, PRs, meetings, Slack messages, or Notion pages.
4. If evidence is weak, lower confidence below 0.8.
5. Never suggest automatically sending emails, merging PRs, or posting to Slack.
6. All actions require human approval (requiresApproval must be true).
7. Return ONLY valid JSON matching the schema.

Schema:
{
  "priority": "string — today's single highest priority",
  "project": "string — project name",
  "confidence": 0.0-1.0,
  "urgentWork": ["string"],
  "likelyNextProject": "string",
  "blockers": ["string"],
  "documentsNeeded": ["string"],
  "codingContextNeeded": ["string"],
  "rationale": "string — explain WHY using cited evidence",
  "evidence": [
    { "provider": "gmail|calendar|slack|github|notion|system", "type": "string", "id": "string?", "title": "string", "url": "string?", "snippet": "string?", "timestamp": "string?" }
  ],
  "actions": [
    {
      "type": "prepare_work|meeting_brief|release_notes|slack_reply|focus_block|reply_email|review_pr|update_notion|custom",
      "title": "string",
      "description": "string",
      "project": "string?",
      "confidence": 0.0-1.0,
      "evidence": [ /* same as above */ ],
      "payload": {}
    }
  ]
}`;

export function buildAnalyzeUserPrompt(context: UnifiedContext): string {
  return `Analyze this unified work context and produce the JSON schema described.

Context collected at: ${context.timestamp}
Collection errors: ${JSON.stringify(context.collectionErrors)}

Emails (${context.emails.length}):
${JSON.stringify(context.emails, null, 2)}

Meetings (${context.meetings.length}):
${JSON.stringify(context.meetings, null, 2)}

Slack (${context.slack.length}):
${JSON.stringify(context.slack, null, 2)}

GitHub (${context.github.length}):
${JSON.stringify(context.github, null, 2)}

Notion (${context.notion.length}):
${JSON.stringify(context.notion, null, 2)}
`;
}
