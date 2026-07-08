import { randomUUID } from "crypto";
import type { Community, ScrapeRequest } from "@/types";
import {
  upsertCommunities,
  createScrapeJob,
  updateScrapeJob,
} from "@/lib/db";
import { scrapeDisboard } from "@/lib/scrapers/disboard";
import { scrapeSlofile } from "@/lib/scrapers/slofile";

export interface ScrapeResult {
  jobId: string;
  communities: Community[];
  counts: Record<string, number>;
  warnings: string[];
}

export async function runDiscovery(
  request: ScrapeRequest
): Promise<ScrapeResult> {
  const keywords =
    request.keywords ??
    process.env.DEFAULT_KEYWORDS?.split(",").map((k) => k.trim()) ??
    ["saas", "startup", "marketing"];
  const maxPerSource = request.maxPerSource ?? 40;
  const allCommunities: Community[] = [];
  const counts: Record<string, number> = {};
  const warnings: string[] = [];
  const jobId = randomUUID();

  for (const source of request.sources) {
    const sourceJobId = randomUUID();
    createScrapeJob({
      id: sourceJobId,
      source,
      status: "running",
      keyword: keywords.join(", "),
      communitiesFound: 0,
      startedAt: new Date().toISOString(),
    });

    try {
      let found: Community[] = [];

      if (source === "disboard") {
        const result = await scrapeDisboard({
          keywords,
          maxResults: maxPerSource,
        });
        found = result.communities;
        if (result.source === "seed") {
          warnings.push(
            "Disboard is Cloudflare-protected. Using curated Discord seed data. Add APIFY_API_KEY for live Disboard scraping."
          );
        }
      } else if (source === "slofile") {
        for (const keyword of keywords.slice(0, 3)) {
          const batch = await scrapeSlofile({
            keyword,
            maxResults: Math.ceil(maxPerSource / 3),
          });
          found.push(...batch);
        }
        if (found.length < maxPerSource / 2) {
          const extra = await scrapeSlofile({
            category: "Startup",
            maxResults: maxPerSource,
          });
          found.push(...extra);
        }
      } else if (source === "apify") {
        const result = await scrapeDisboard({ keywords, maxResults: maxPerSource });
        found = result.communities;
      }

      const seen = new Set(allCommunities.map((c) => c.id));
      const unique = found.filter((c) => !seen.has(c.id));
      allCommunities.push(...unique);
      counts[source] = unique.length;

      updateScrapeJob(sourceJobId, {
        status: "completed",
        communitiesFound: unique.length,
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      warnings.push(`${source}: ${message}`);
      updateScrapeJob(sourceJobId, {
        status: "failed",
        error: message,
        completedAt: new Date().toISOString(),
      });
      counts[source] = 0;
    }
  }

  if (allCommunities.length > 0) {
    upsertCommunities(allCommunities);
  }

  createScrapeJob({
    id: jobId,
    source: request.sources[0] ?? "disboard",
    status: "completed",
    keyword: keywords.join(", "),
    communitiesFound: allCommunities.length,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  });

  return { jobId, communities: allCommunities, counts, warnings };
}
