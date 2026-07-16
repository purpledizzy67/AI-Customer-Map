/**
 * Background worker — runs collect/analyze every N minutes,
 * morning/evening dashboards on schedule, and meeting-brief checks.
 *
 * Usage: npm run worker
 */

import { config, isDemoMode } from "../src/lib/config";
import { DEMO_USER_ID } from "../src/lib/db";
import { runCollectAnalyzePipeline } from "../src/workflows/collectPipeline";
import { generateMorningDashboard } from "../src/workflows/morningDashboard";
import { generateEveningSummary } from "../src/workflows/eveningSummary";
import { buildMeetingBriefsForUpcoming } from "../src/workflows/meetingBrief";

const intervalMs = config.collectIntervalMinutes * 60_000;

async function tick(label: string, fn: () => Promise<unknown>) {
  const started = Date.now();
  try {
    await fn();
    console.log(`[worker] ${label} ok (${Date.now() - started}ms)`);
  } catch (error) {
    console.error(`[worker] ${label} failed`, error);
  }
}

async function main() {
  console.log(
    `[worker] starting · interval=${config.collectIntervalMinutes}m · demo=${isDemoMode()}`,
  );

  await tick("collect", () => runCollectAnalyzePipeline(DEMO_USER_ID));
  await tick("meeting-briefs", () => buildMeetingBriefsForUpcoming(DEMO_USER_ID));

  setInterval(() => {
    void tick("collect", () => runCollectAnalyzePipeline(DEMO_USER_ID));
    void tick("meeting-briefs", () => buildMeetingBriefsForUpcoming(DEMO_USER_ID));
  }, intervalMs);

  // Rough daily hooks (check every hour)
  setInterval(() => {
    const hour = new Date().getHours();
    if (hour === 8) {
      void tick("morning", () => generateMorningDashboard(DEMO_USER_ID));
    }
    if (hour === 18) {
      void tick("evening", () => generateEveningSummary(DEMO_USER_ID));
    }
  }, 60 * 60_000);
}

void main();
