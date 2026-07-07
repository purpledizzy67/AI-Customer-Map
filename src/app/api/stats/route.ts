import { NextResponse } from "next/server";
import { getMapStats, getRecentScrapeJobs } from "@/lib/db";
import { isApifyConfigured } from "@/lib/scrapers/disboard";
import { isApolloConfigured } from "@/lib/apollo";

export async function GET() {
  return NextResponse.json({
    stats: getMapStats(),
    recentJobs: getRecentScrapeJobs(5),
    config: {
      apify: isApifyConfigured(),
      openai: Boolean(process.env.OPENAI_API_KEY),
      apollo: isApolloConfigured(),
    },
  });
}
