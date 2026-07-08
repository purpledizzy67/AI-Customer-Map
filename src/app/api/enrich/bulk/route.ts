import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCommunities } from "@/lib/db";
import {
  enrichCommunityLeads,
  enrichOrganizationByDomain,
  extractDomains,
} from "@/lib/apollo";

const bulkSchema = z.object({
  communityIds: z.array(z.string()).optional(),
  limit: z.number().min(1).max(50).optional(),
});

export async function POST(request: NextRequest) {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "APOLLO_API_KEY not configured" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { communityIds, limit = 25 } = bulkSchema.parse(body);

    let communities = getCommunities({ limit: 500 });
    if (communityIds?.length) {
      const idSet = new Set(communityIds);
      communities = communities.filter((c) => idSet.has(c.id));
    }
    communities = communities.slice(0, limit);

    const enrichments = [];
    const seenDomains = new Set<string>();

    for (const community of communities) {
      const result = await enrichCommunityLeads({
        communityId: community.id,
        name: community.name,
        description: community.description,
        tags: community.tags,
        websiteUrl: community.websiteUrl,
        inviteUrl: community.inviteUrl,
        sourceUrl: community.sourceUrl,
        apiKey,
      });

      enrichments.push({
        community,
        enrichment: result,
      });

      for (const d of extractDomains(community.description, community.websiteUrl)) {
        seenDomains.add(d);
      }

      // Gentle rate limit (~6 req/sec max on Apollo)
      await new Promise((r) => setTimeout(r, 200));
    }

    return NextResponse.json({
      success: true,
      enriched: enrichments.length,
      uniqueDomains: seenDomains.size,
      results: enrichments,
      note:
        "Organization enrichment complete. Individual member contact data requires Apollo paid plan or the Apollo Chrome extension on exported LinkedIn URLs.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bulk enrich failed";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
