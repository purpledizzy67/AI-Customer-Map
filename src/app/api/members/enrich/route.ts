import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCommunityById,
  getUnenrichedMembers,
  updateMemberEnrichment,
} from "@/lib/db";
import {
  enrichPeopleBulk,
  extractDomains,
  splitDisplayName,
} from "@/lib/apollo";

const enrichSchema = z.object({
  communityId: z.string(),
  domain: z.string().optional(),
  limit: z.number().min(1).max(30).optional(),
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
    const { communityId, domain: manualDomain, limit = 10 } =
      enrichSchema.parse(body);

    const community = getCommunityById(communityId);
    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    const members = getUnenrichedMembers(communityId, limit);
    if (members.length === 0) {
      return NextResponse.json({
        success: true,
        enriched: 0,
        message: "No unenriched members. Fetch members first.",
      });
    }

    const domains = manualDomain
      ? [manualDomain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]]
      : extractDomains(
          community.websiteUrl,
          community.description,
          community.inviteUrl,
          community.sourceUrl,
          community.name
        );

    if (domains.length === 0) {
      return NextResponse.json({
        success: false,
        error:
          "No company domain found. Pass a domain in the request body to match members against.",
      }, { status: 400 });
    }

    const domain = domains[0];
    const inputs = members.map((m) => {
      const { firstName, lastName } = splitDisplayName(
        m.displayName ?? m.username
      );
      return { firstName, lastName, domain, memberId: m.id };
    });

    const { results, planBlocked } = await enrichPeopleBulk(
      inputs.map(({ firstName, lastName, domain: d }) => ({
        firstName,
        lastName,
        domain: d,
      })),
      apiKey
    );

    if (planBlocked) {
      return NextResponse.json({
        success: false,
        planBlocked: true,
        error:
          "Apollo people enrichment requires a paid plan. Member profiles were saved — export CSV and use Apollo Chrome extension for manual enrichment.",
        attempted: members.length,
      }, { status: 402 });
    }

    let enrichedCount = 0;
    for (let i = 0; i < members.length; i++) {
      const person = results[i];
      if (person) {
        updateMemberEnrichment(members[i].id, person);
        enrichedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      enriched: enrichedCount,
      attempted: members.length,
      domain,
      planNote:
        enrichedCount === 0
          ? "No Apollo matches found. Discord usernames rarely map to B2B contacts without email/LinkedIn."
          : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Member enrichment failed";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.APOLLO_API_KEY),
    note: "People enrichment requires paid Apollo plan. Free plan supports organization enrich only.",
    body: {
      communityId: "string",
      domain: "optional company domain for name matching",
      limit: "optional, max 10 per bulk call (default 10)",
    },
  });
}
