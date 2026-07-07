import * as cheerio from "cheerio";
import type { Community } from "@/types";
import { generateCommunityId } from "@/lib/db";
import {
  analyzeCommunityIntent,
  computeMapPosition,
} from "@/lib/intent-analyzer";

const USER_AGENT =
  "Mozilla/5.0 (compatible; IntentMap/1.0; +https://github.com/intentmap)";

export interface SlofileScrapeOptions {
  keyword?: string;
  category?: string;
  maxResults?: number;
  fetchDetails?: boolean;
}

interface SlofileCard {
  slug: string;
  name: string;
  description: string;
  memberCount: number;
  sourceUrl: string;
}

function parseMemberCount(text: string): number {
  const match = text.replace(/,/g, "").match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function parseListingPage(html: string): SlofileCard[] {
  const $ = cheerio.load(html);
  const cards: SlofileCard[] = [];

  $(".team").each((_, el) => {
    const card = $(el);
    const link = card.find(".name a").first();
    const href = link.attr("href") ?? "";
    const slug = href.replace("/slack/", "");
    if (!slug) return;

    const name = link.text().trim();
    const description = card.find(".description").text().trim();
    const memberText =
      card.find('.count[title*="members"]').attr("title") ??
      card.find(".count").first().text();
    const memberCount = parseMemberCount(memberText);

    cards.push({
      slug,
      name,
      description,
      memberCount,
      sourceUrl: `https://slofile.com/slack/${slug}`,
    });
  });

  return cards;
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 0 },
  });
  if (!response.ok) {
    throw new Error(`Slofile fetch failed: ${response.status} ${url}`);
  }
  return response.text();
}

async function fetchTeamDetails(slug: string): Promise<{
  description: string;
  tags: string[];
  region?: string;
  language?: string;
  inviteUrl?: string;
  websiteUrl?: string;
  memberCount?: number;
}> {
  const html = await fetchPage(`https://slofile.com/slack/${slug}`);
  const $ = cheerio.load(html);

  const description = $(".team-detail .description").text().trim();
  const tags: string[] = [];
  $('.links a[href^="/category/"]').each((_, el) => {
    const tag = $(el).text().trim();
    if (tag) tags.push(tag);
  });

  const region = $('.links a[href^="/region/"]').first().text().trim() || undefined;
  const language = $('.links a[href^="/lang/"]').first().text().trim() || undefined;
  const inviteUrl =
    $('.actions a[href*="slack.com"]').attr("href") ||
    $('a[href*=".slack.com"]').first().attr("href") ||
    undefined;

  let websiteUrl: string | undefined;
  $('.links a[href^="http"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (
      href &&
      !href.includes("slofile.com") &&
      !href.includes("slack.com") &&
      !href.includes("twitter.com") &&
      !href.includes("linkedin.com")
    ) {
      websiteUrl = href;
    }
  });

  const memberTitle = $('.counts .count[title*="members"]').attr("title");
  const memberCount = memberTitle ? parseMemberCount(memberTitle) : undefined;

  return { description, tags, region, language, inviteUrl, websiteUrl, memberCount };
}

export async function scrapeSlofile(
  options: SlofileScrapeOptions = {}
): Promise<Community[]> {
  const { keyword, category, maxResults = 50, fetchDetails = true } = options;
  const urls: string[] = [];

  if (keyword) {
    urls.push(
      `https://slofile.com/slack?q=${encodeURIComponent(keyword)}`
    );
  } else if (category) {
    urls.push(`https://slofile.com/category/${encodeURIComponent(category)}`);
  } else {
    urls.push("https://slofile.com/");
    urls.push("https://slofile.com/category/Startup");
    urls.push("https://slofile.com/category/Marketing");
    urls.push("https://slofile.com/category/Business");
  }

  const seen = new Set<string>();
  const cards: SlofileCard[] = [];

  for (const url of urls) {
    if (cards.length >= maxResults) break;
    try {
      const html = await fetchPage(url);
      for (const card of parseListingPage(html)) {
        if (seen.has(card.slug)) continue;
        seen.add(card.slug);
        cards.push(card);
        if (cards.length >= maxResults) break;
      }
    } catch (err) {
      console.error(`Slofile scrape error for ${url}:`, err);
    }
  }

  const communities: Community[] = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    let details = {
      description: card.description,
      tags: [] as string[],
      region: undefined as string | undefined,
      language: undefined as string | undefined,
      inviteUrl: undefined as string | undefined,
      websiteUrl: undefined as string | undefined,
      memberCount: card.memberCount,
    };

    if (fetchDetails) {
      try {
        const enriched = await fetchTeamDetails(card.slug);
        details = {
          description: enriched.description || card.description,
          tags: enriched.tags,
          region: enriched.region,
          language: enriched.language,
          inviteUrl: enriched.inviteUrl,
          websiteUrl: enriched.websiteUrl,
          memberCount: enriched.memberCount ?? card.memberCount,
        };
      } catch {
        // Use listing data as fallback
      }
    }

    const category = details.tags[0];
    const intent = await analyzeCommunityIntent(
      card.name,
      details.description,
      category,
      details.tags
    );
    const mapPos = computeMapPosition(
      intent.score,
      details.memberCount,
      "slack",
      i
    );

    communities.push({
      id: generateCommunityId("slack", card.sourceUrl),
      platform: "slack",
      name: card.name,
      description: details.description,
      memberCount: details.memberCount,
      category,
      tags: details.tags,
      region: details.region,
      language: details.language,
      inviteUrl: details.inviteUrl,
      websiteUrl: details.websiteUrl,
      sourceUrl: card.sourceUrl,
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
