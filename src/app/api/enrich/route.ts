import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCommunityById } from "@/lib/db";
import { enrichCommunityLeads, enrichOrganizationByDomain } from "@/lib/apollo";

const enrichSchema = z.object({
  communityId: z.string(),
  domain: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "APOLLO_API_KEY not configured. Add it to .env" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { communityId, domain } = enrichSchema.parse(body);

    const community = getCommunityById(communityId);
    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

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

    if (domain) {
      const cleanDomain = domain
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0];
      const manual = await enrichOrganizationByDomain(cleanDomain, apiKey);
      if (manual && !result.organizations.some((o) => o.domain === manual.domain)) {
        result.organizations.unshift(manual);
        if (!result.domains.includes(manual.domain)) {
          result.domains.unshift(manual.domain);
        }
      }
    }

    return NextResponse.json({ success: true, enrichment: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Enrichment failed";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.APOLLO_API_KEY),
    endpoints: {
      POST: "Enrich community leads via Apollo",
      body: { communityId: "string", domain: "optional manual domain" },
    },
    note: "Organization enrichment works on free plan. People search requires paid Apollo plan.",
  });
}
