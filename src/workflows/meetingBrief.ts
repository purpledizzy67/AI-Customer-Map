/**
 * STEP 6 — Meeting brief when a meeting starts within 30 minutes.
 */

import { respondJson } from "@/lib/openai/client";
import { MEETING_BRIEF_SYSTEM } from "@/prompts/workflows";
import { calendarService } from "@/services/calendarService";
import {
  getLatestContext,
  saveMeetingBrief,
  logAutomation,
  addTimelineEvent,
} from "@/lib/db";
import type { EvidenceSource, MeetingBrief, MeetingItem, UnifiedContext } from "@/types";

interface BriefLlm {
  summary?: string;
  customerHistory?: string[];
  questionsToAsk?: string[];
  risks?: string[];
  actionItems?: string[];
}

function relatedContext(meeting: MeetingItem, context: UnifiedContext) {
  const attendeeEmails = new Set(
    meeting.attendees.map((a) => a.email.toLowerCase()).filter(Boolean),
  );
  const keywords = meeting.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);

  const previousEmails = context.emails.filter((e) => {
    const from = e.from.toLowerCase();
    return (
      [...attendeeEmails].some((a) => from.includes(a)) ||
      keywords.some((k) => e.subject.toLowerCase().includes(k))
    );
  });

  const slackConversations = context.slack.filter((s) =>
    keywords.some((k) => s.text.toLowerCase().includes(k)),
  );

  const githubIssues = context.github.filter(
    (g) =>
      (g.type === "issue" || g.type === "pr") &&
      keywords.some((k) => g.title.toLowerCase().includes(k)),
  );

  const openPrs = context.github.filter((g) => g.type === "pr" || g.type === "review_request");

  const notionDocs = context.notion.filter((n) =>
    keywords.some((k) => n.title.toLowerCase().includes(k)),
  );

  return { previousEmails, slackConversations, githubIssues, openPrs, notionDocs };
}

function buildEvidence(meeting: MeetingItem, related: ReturnType<typeof relatedContext>): EvidenceSource[] {
  const evidence: EvidenceSource[] = [
    {
      provider: "calendar",
      type: "meeting",
      id: meeting.id,
      title: meeting.title,
      url: meeting.url,
      timestamp: meeting.start,
    },
  ];
  for (const e of related.previousEmails.slice(0, 3)) {
    evidence.push({
      provider: "gmail",
      type: "email",
      id: e.id,
      title: e.subject,
      snippet: e.snippet,
      url: e.url,
    });
  }
  for (const s of related.slackConversations.slice(0, 3)) {
    evidence.push({
      provider: "slack",
      type: s.type,
      id: s.id,
      title: s.channelName,
      snippet: s.text,
      url: s.permalink,
    });
  }
  for (const g of [...related.githubIssues, ...related.openPrs].slice(0, 4)) {
    evidence.push({
      provider: "github",
      type: g.type,
      id: String(g.number ?? g.id),
      title: g.title,
      url: g.url,
    });
  }
  for (const n of related.notionDocs.slice(0, 3)) {
    evidence.push({
      provider: "notion",
      type: n.type,
      id: n.id,
      title: n.title,
      url: n.url,
    });
  }
  return evidence;
}

export async function buildMeetingBrief(
  userId: string,
  meeting: MeetingItem,
): Promise<MeetingBrief> {
  const context =
    (await getLatestContext(userId)) ?? {
      userId,
      emails: [],
      meetings: [meeting],
      github: [],
      slack: [],
      notion: [],
      timestamp: new Date().toISOString(),
      collectionErrors: [],
    };

  const related = relatedContext(meeting, context);
  const evidence = buildEvidence(meeting, related);

  const llm = await respondJson<BriefLlm>({
    system: MEETING_BRIEF_SYSTEM,
    user: JSON.stringify({ meeting, related }),
  });

  const brief: MeetingBrief = {
    meetingId: meeting.id,
    meetingTitle: meeting.title,
    start: meeting.start,
    attendees: meeting.attendees.map((a) => a.name || a.email),
    previousEmails: related.previousEmails,
    slackConversations: related.slackConversations,
    githubIssues: related.githubIssues.filter((g) => g.type === "issue"),
    openPrs: related.openPrs,
    notionDocs: related.notionDocs,
    customerHistory: llm?.customerHistory ?? [
      "See related emails and Slack threads cited in evidence.",
    ],
    questionsToAsk: llm?.questionsToAsk ?? [
      "What decisions are needed today?",
      "What blockers remain before launch?",
      "Who owns follow-up documentation?",
    ],
    risks: llm?.risks ?? [
      "Incomplete documentation may block partner integration.",
    ],
    actionItems: llm?.actionItems ?? [
      "Confirm owners for open action items after the meeting.",
    ],
    summary:
      llm?.summary ??
      `Brief for "${meeting.title}" with ${meeting.attendees.length} attendees. Grounded in ${evidence.length} cited sources.`,
    evidence,
    createdAt: new Date().toISOString(),
  };

  await saveMeetingBrief(userId, brief);
  await logAutomation(userId, {
    type: "meeting_brief",
    title: `Meeting brief: ${meeting.title}`,
    detail: brief.summary,
    status: "success",
    evidence,
  });
  await addTimelineEvent(userId, {
    provider: "ai",
    title: "Meeting brief ready",
    description: meeting.title,
    timestamp: brief.createdAt,
  });

  return brief;
}

export async function buildMeetingBriefsForUpcoming(
  userId: string,
  withinMinutes = 30,
): Promise<MeetingBrief[]> {
  const upcoming = await calendarService.meetingsStartingSoon(userId, withinMinutes);
  const briefs: MeetingBrief[] = [];
  for (const meeting of upcoming) {
    briefs.push(await buildMeetingBrief(userId, meeting));
  }
  if (!upcoming.length) {
    await logAutomation(userId, {
      type: "meeting_brief",
      title: "No imminent meetings",
      detail: `No meetings starting within ${withinMinutes} minutes`,
      status: "skipped",
    });
  }
  return briefs;
}
