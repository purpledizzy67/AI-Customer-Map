import { NextResponse } from "next/server";
import { runDiscovery } from "@/lib/discovery";
import { communityCount } from "@/lib/db";

export async function POST() {
  if (communityCount() > 0) {
    return NextResponse.json({
      seeded: false,
      message: "Database already has communities",
      count: communityCount(),
    });
  }

  const result = await runDiscovery({
    sources: ["disboard", "slofile"],
    keywords: ["saas", "startup", "marketing", "seo", "product"],
    maxPerSource: 25,
  });

  return NextResponse.json({
    seeded: true,
    count: result.communities.length,
    warnings: result.warnings,
  });
}
