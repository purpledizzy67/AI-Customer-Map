import { NextRequest, NextResponse } from "next/server";
import { getMembersByCommunity } from "@/lib/db";

export async function GET(request: NextRequest) {
  const communityId = request.nextUrl.searchParams.get("communityId");
  if (!communityId) {
    return NextResponse.json(
      { error: "communityId query parameter required" },
      { status: 400 }
    );
  }

  const members = getMembersByCommunity(communityId);
  const enriched = members.filter((m) => m.apolloData).length;

  return NextResponse.json({
    success: true,
    members,
    total: members.length,
    enriched,
  });
}
