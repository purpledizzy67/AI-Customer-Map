import type { Community } from "@/types";
import { generateCommunityId } from "@/lib/db";
import {
  analyzeCommunityIntent,
  computeMapPosition,
} from "@/lib/intent-analyzer";
import { scrapeDisboardViaApify, isApifyConfigured } from "./apify";

/**
 * Disboard.org is Cloudflare-protected. Direct HTTP scraping returns a challenge page.
 * Use Apify when APIFY_API_KEY is set; otherwise return curated high-intent seed data
 * so the platform remains demoable without credentials.
 */
export interface DisboardScrapeOptions {
  keywords?: string[];
  maxResults?: number;
}

const DISCORD_SEED_COMMUNITIES: Array<{
  name: string;
  description: string;
  memberCount: number;
  category: string;
  tags: string[];
  sourceUrl: string;
  inviteUrl?: string;
}> = [
  {
    name: "SaaS Founders Hub",
    description:
      "A community for SaaS founders sharing growth tactics, pricing strategies, tool recommendations, and customer acquisition. Weekly AMAs with founders looking for solutions to scale outreach and automate sales.",
    memberCount: 12400,
    category: "Business",
    tags: ["saas", "startup", "founder", "b2b"],
    sourceUrl: "https://disboard.org/servers/tag/saas",
    inviteUrl: "https://discord.gg/saas-founders",
  },
  {
    name: "Growth Marketers Collective",
    description:
      "Digital marketers discussing SEO, link building, paid ads, and growth hacking. Members frequently ask for tool recommendations, alternatives to existing stacks, and vendor comparisons for marketing automation.",
    memberCount: 8900,
    category: "Marketing",
    tags: ["marketing", "growth", "seo", "outreach"],
    sourceUrl: "https://disboard.org/servers/tag/marketing",
    inviteUrl: "https://discord.gg/growth-marketers",
  },
  {
    name: "Product Builders",
    description:
      "Product managers and builders evaluating tools for roadmapping, analytics, and user research. Active channels for hiring, budget discussions, and switching from legacy PM tools.",
    memberCount: 15600,
    category: "Technology",
    tags: ["product", "startup", "analytics", "b2b"],
    sourceUrl: "https://disboard.org/servers/tag/product-management",
    inviteUrl: "https://discord.gg/product-builders",
  },
  {
    name: "Indie Hackers & Builders",
    description:
      "Bootstrapped founders looking for affordable SaaS tools, sharing what they're building, and asking for recommendations on CRM, email, and customer support solutions.",
    memberCount: 22100,
    category: "Startup",
    tags: ["startup", "founder", "saas", "indie"],
    sourceUrl: "https://disboard.org/servers/tag/startup",
    inviteUrl: "https://discord.gg/indie-hackers",
  },
  {
    name: "AI Tools & Automation",
    description:
      "Developers and business users exploring AI tools for automation, looking for alternatives, comparing pricing, and discussing enterprise AI procurement needs.",
    memberCount: 34500,
    category: "Technology",
    tags: ["ai", "automation", "saas", "enterprise"],
    sourceUrl: "https://disboard.org/servers/tag/artificial-intelligence",
    inviteUrl: "https://discord.gg/ai-tools",
  },
  {
    name: "E-commerce Operators",
    description:
      "Shopify and DTC brand operators discussing conversion tools, email marketing platforms, analytics solutions, and hiring agencies for growth.",
    memberCount: 9800,
    category: "Business",
    tags: ["ecommerce", "shopify", "marketing", "sales"],
    sourceUrl: "https://disboard.org/servers/tag/ecommerce",
    inviteUrl: "https://discord.gg/ecom-operators",
  },
  {
    name: "DevTools & API Builders",
    description:
      "Engineers building and evaluating developer tools, APIs, and infrastructure. Frequent discussions about switching cloud providers and integrating new SaaS into stacks.",
    memberCount: 18200,
    category: "Programming",
    tags: ["api", "developer", "saas", "technical"],
    sourceUrl: "https://disboard.org/servers/tag/programming",
    inviteUrl: "https://discord.gg/devtools",
  },
  {
    name: "Sales & RevOps Network",
    description:
      "B2B sales professionals and revenue operations leaders comparing CRM solutions, outreach tools, and pipeline automation vendors. Active hiring and budget channels.",
    memberCount: 6700,
    category: "Business",
    tags: ["sales", "b2b", "crm", "enterprise"],
    sourceUrl: "https://disboard.org/servers/tag/business",
    inviteUrl: "https://discord.gg/revops",
  },
];

async function buildFromSeed(maxResults: number): Promise<Community[]> {
  const communities: Community[] = [];

  for (let i = 0; i < Math.min(DISCORD_SEED_COMMUNITIES.length, maxResults); i++) {
    const seed = DISCORD_SEED_COMMUNITIES[i];
    const intent = await analyzeCommunityIntent(
      seed.name,
      seed.description,
      seed.category,
      seed.tags
    );
    const mapPos = computeMapPosition(
      intent.score,
      seed.memberCount,
      "discord",
      i
    );

    communities.push({
      id: generateCommunityId("discord", seed.sourceUrl + seed.name),
      platform: "discord",
      name: seed.name,
      description: seed.description,
      memberCount: seed.memberCount,
      category: seed.category,
      tags: seed.tags,
      inviteUrl: seed.inviteUrl,
      sourceUrl: seed.sourceUrl,
      intentScore: intent.score,
      intentTier: intent.tier,
      intentSignals: intent.signals,
      mapX: mapPos.x,
      mapY: mapPos.y,
      scrapedAt: new Date().toISOString(),
      analyzedAt: new Date().toISOString(),
    });
  }

  return communities;
}

export async function scrapeDisboard(
  options: DisboardScrapeOptions = {}
): Promise<{ communities: Community[]; source: "apify" | "seed" }> {
  const maxResults = options.maxResults ?? 50;

  if (isApifyConfigured()) {
    try {
      const communities = await scrapeDisboardViaApify({
        keywords: options.keywords,
        maxPerKeyword: Math.ceil(maxResults / 3),
      });
      return {
        communities: communities.slice(0, maxResults),
        source: "apify",
      };
    } catch (err) {
      console.error("Apify Disboard scrape failed, falling back to seed:", err);
    }
  }

  const communities = await buildFromSeed(maxResults);
  return { communities, source: "seed" };
}

export { isApifyConfigured };
