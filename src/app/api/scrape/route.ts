import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runDiscovery } from "@/lib/discovery";

const scrapeSchema = z.object({
  sources: z
    .array(z.enum(["disboard", "slofile", "apify"]))
    .min(1)
    .default(["disboard", "slofile"]),
  keywords: z.array(z.string()).optional(),
  maxPerSource: z.number().min(1).max(200).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = scrapeSchema.parse(body);
    const result = await runDiscovery(parsed);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scrape failed";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoints: {
      POST: "Run discovery scrape",
      body: {
        sources: ["disboard", "slofile"],
        keywords: ["saas", "startup", "marketing"],
        maxPerSource: 40,
      },
    },
    env: {
      apifyConfigured: Boolean(process.env.APIFY_API_KEY),
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    },
  });
}
