import { NextRequest, NextResponse } from "next/server";
import { getCommunities, getMapStats } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const platform = searchParams.get("platform") ?? undefined;
  const minIntent = searchParams.get("minIntent");
  const tier = searchParams.get("tier") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const limit = searchParams.get("limit");

  const communities = getCommunities({
    platform,
    minIntent: minIntent ? parseInt(minIntent, 10) : undefined,
    tier,
    search,
    category,
    limit: limit ? parseInt(limit, 10) : 500,
  });

  const stats = getMapStats();

  return NextResponse.json({ communities, stats });
}
