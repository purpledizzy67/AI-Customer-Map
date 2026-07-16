/**
 * Google Calendar service — meetings today, attendees, upcoming events.
 */

import { requireAccessToken, NotConnectedError } from "@/lib/auth/tokens";
import { withRateLimit } from "@/lib/rate-limit";
import { withRetry } from "@/lib/retry";
import { isDemoMode } from "@/lib/config";
import type { MeetingItem } from "@/types";

const CAL_API = "https://www.googleapis.com/calendar/v3";

function demoMeetings(): MeetingItem[] {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const at = (h: number, m = 0) => {
    const d = new Date(startOfDay);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const soon = new Date(Date.now() + 25 * 60_000);
  const soonEnd = new Date(soon.getTime() + 30 * 60_000);

  return [
    {
      id: "evt-standup",
      title: "Engineering standup",
      description: "Daily sync — blockers and priorities",
      start: at(9, 30).toISOString(),
      end: at(9, 45).toISOString(),
      attendees: [
        { email: "demo@workassistant.ai", name: "You", responseStatus: "accepted" },
        { email: "priya@acme.com", name: "Priya Shah", responseStatus: "accepted" },
        { email: "john@acme.com", name: "John Chen", responseStatus: "tentative" },
      ],
      hangoutLink: "https://meet.google.com/abc-defg-hij",
      url: "https://calendar.google.com/calendar/event?eid=evt-standup",
    },
    {
      id: "evt-api-review",
      title: "API documentation review",
      description: "Walk through OpenAPI changes for partner launch",
      start: soon.toISOString(),
      end: soonEnd.toISOString(),
      attendees: [
        { email: "demo@workassistant.ai", name: "You", responseStatus: "accepted" },
        { email: "john@acme.com", name: "John Chen", responseStatus: "accepted" },
        { email: "partner@external.io", name: "Alex Rivera", responseStatus: "needsAction" },
      ],
      hangoutLink: "https://meet.google.com/api-docs-01",
      url: "https://calendar.google.com/calendar/event?eid=evt-api-review",
    },
    {
      id: "evt-planning",
      title: "Q3 planning — Search & RAG",
      description: "Prioritize semantic search roadmap",
      start: at(15, 0).toISOString(),
      end: at(16, 0).toISOString(),
      attendees: [
        { email: "demo@workassistant.ai", name: "You", responseStatus: "accepted" },
        { email: "priya@acme.com", name: "Priya Shah", responseStatus: "accepted" },
      ],
      url: "https://calendar.google.com/calendar/event?eid=evt-planning",
    },
  ];
}

interface CalEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: {
    email?: string;
    displayName?: string;
    responseStatus?: string;
  }[];
  location?: string;
  hangoutLink?: string;
  htmlLink?: string;
}

function mapEvent(e: CalEvent): MeetingItem {
  return {
    id: e.id,
    title: e.summary ?? "(No title)",
    description: e.description,
    start: e.start?.dateTime ?? e.start?.date ?? new Date().toISOString(),
    end: e.end?.dateTime ?? e.end?.date ?? new Date().toISOString(),
    attendees: (e.attendees ?? []).map((a) => ({
      email: a.email ?? "",
      name: a.displayName,
      responseStatus: a.responseStatus,
    })),
    location: e.location,
    hangoutLink: e.hangoutLink,
    url: e.htmlLink,
  };
}

export class CalendarService {
  async collect(userId: string): Promise<MeetingItem[]> {
    if (isDemoMode()) {
      return demoMeetings();
    }

    let accessToken: string;
    try {
      accessToken = await requireAccessToken(userId, "google");
    } catch (e) {
      if (e instanceof NotConnectedError) return [];
      throw e;
    }

    const timeMin = new Date();
    timeMin.setHours(0, 0, 0, 0);
    const timeMax = new Date(timeMin);
    timeMax.setDate(timeMax.getDate() + 3);

    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "25",
    });

    const data = await withRateLimit("calendar", () =>
      withRetry(async () => {
        const res = await fetch(
          `${CAL_API}/calendars/primary/events?${params}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!res.ok) {
          const err = new Error(`Calendar API ${res.status}`);
          (err as Error & { status: number }).status = res.status;
          throw err;
        }
        return res.json() as Promise<{ items?: CalEvent[] }>;
      }),
    );

    return (data.items ?? []).map(mapEvent);
  }

  /** Meetings starting within the next `withinMinutes` minutes */
  async meetingsStartingSoon(
    userId: string,
    withinMinutes = 30,
  ): Promise<MeetingItem[]> {
    const meetings = await this.collect(userId);
    const now = Date.now();
    const until = now + withinMinutes * 60_000;
    return meetings.filter((m) => {
      const start = new Date(m.start).getTime();
      return start >= now && start <= until;
    });
  }
}

export const calendarService = new CalendarService();
