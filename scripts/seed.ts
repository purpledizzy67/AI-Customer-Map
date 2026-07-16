/**
 * Seed demo user + run one collect pipeline for local preview.
 */

import { DEMO_USER_ID } from "../src/lib/db";
import { runCollectAnalyzePipeline } from "../src/workflows/collectPipeline";
import { generateMorningDashboard } from "../src/workflows/morningDashboard";

async function main() {
  console.log("Seeding demo pipeline for", DEMO_USER_ID);
  const result = await runCollectAnalyzePipeline(DEMO_USER_ID);
  const morning = await generateMorningDashboard(DEMO_USER_ID);
  console.log(
    JSON.stringify(
      {
        priority: result.analysis.priority,
        confidence: result.analysis.confidence,
        prepared: result.prepared?.slug ?? null,
        morningPriorities: morning.priorities.length,
      },
      null,
      2,
    ),
  );
}

void main();
