import type { Community } from "@/types";
import { generateCommunityId } from "@/lib/db";
import {
  analyzeCommunityIntent,
  computeMapPosition,
} from "@/lib/intent-analyzer";

const APIFY_BASE = "https://api.apify.com/v2";

export interface ApifyScrapeOptions {
  keywords?: string[];
  maxPerKeyword?: number;
  actorId?: string;
}

interface ApifyRunResponse {
  data: { id: string; defaultDatasetId: string; status: string };
}

interface ApifyDatasetItem {
  name?: string;
  serverName?: string;
  title?: string;
  description?: string;
  memberCount?: number;
  members?: number;
  onlineCount?: number;
  online?: number;
  tags?: string[];
  tag?: string;
  category?: string;
  inviteUrl?: string;
  invite?: string;
  url?: string;
  sourceUrl?: string;
  link?: string;
  id?: string;
  platform?: string;
}

const DEFAULT_ACTOR = "khadinakbar/discord-all-in-one-scraper";

async function waitForRun(
  token: string,
  runId: string,
  maxWaitMs = 120000
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`);
    const json = (await res.json()) as {
      data: { status: string; defaultDatasetId: string };
    };
    const status = json.data.status;
    if (status === "SUCCEEDED") return json.data.defaultDatasetId;
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify run ${status}`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Apify run timed out");
}

async function fetchDataset(
  token: string,
  datasetId: string
): Promise<ApifyDatasetItem[]> {
  const res = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&format=json`
  );
  if (!res.ok) throw new Error(`Apify dataset fetch failed: ${res.status}`);
  return res.json() as Promise<ApifyDatasetItem[]>;
}

function normalizeApifyItem(
  item: ApifyDatasetItem,
  index: number
): Omit<Community, "intentScore" | "intentTier" | "intentSignals" | "mapX" | "mapY" | "analyzedAt"> | null {
  const name = item.name ?? item.serverName ?? item.title;
  if (!name) return null;

  const sourceUrl =
    item.sourceUrl ?? item.url ?? item.link ?? `https://disboard.org/server/${item.id ?? index}`;
  const description = item.description ?? "";
  const memberCount = item.memberCount ?? item.members ?? 0;
  const tags = item.tags ?? (item.tag ? [item.tag] : []);
  const inviteUrl = item.inviteUrl ?? item.invite;

  return {
    id: generateCommunityId("discord", sourceUrl),
    platform: "discord",
    name,
    description,
    memberCount,
    onlineCount: item.onlineCount ?? item.online,
    category: item.category ?? tags[0],
    tags,
    inviteUrl,
    sourceUrl,
    scrapedAt: new Date().toISOString(),
  };
}

export async function scrapeDisboardViaApify(
  options: ApifyScrapeOptions = {}
): Promise<Community[]> {
  const token = process.env.APIFY_API_KEY;
  if (!token) {
    throw new Error(
      "APIFY_API_KEY is required for Disboard scraping (Cloudflare protected). Add your key to .env"
    );
  }

  const keywords =
    options.keywords ??
    (process.env.DEFAULT_KEYWORDS?.split(",").map((k) => k.trim()) ?? [
      "saas",
      "startup",
      "marketing",
    ]);
  const maxPerKeyword = options.maxPerKeyword ?? 30;
  const actorId = options.actorId ?? DEFAULT_ACTOR;

  const allItems: ApifyDatasetItem[] = [];

  for (const keyword of keywords) {
    const input = {
      mode: "search",
      searchQuery: keyword,
      maxResults: maxPerKeyword,
    };

    const runRes = await fetch(
      `${APIFY_BASE}/acts/${actorId.replace("/", "~")}/runs?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );

    if (!runRes.ok) {
      const errText = await runRes.text();
      console.error(`Apify run failed for keyword "${keyword}":`, errText);
      continue;
    }

    const runJson = (await runRes.json()) as ApifyRunResponse;
    const datasetId = await waitForRun(token, runJson.data.id);
    const items = await fetchDataset(token, datasetId);
    allItems.push(...items);
  }

  const seen = new Set<string>();
  const communities: Community[] = [];

  for (let i = 0; i < allItems.length; i++) {
    const base = normalizeApifyItem(allItems[i], i);
    if (!base || seen.has(base.id)) continue;
    seen.add(base.id);

    const intent = await analyzeCommunityIntent(
      base.name,
      base.description,
      base.category,
      base.tags
    );
    const mapPos = computeMapPosition(
      intent.score,
      base.memberCount,
      "discord",
      i
    );

    communities.push({
      ...base,
      intentScore: intent.score,
      intentTier: intent.tier,
      intentSignals: intent.signals,
      mapX: mapPos.x,
      mapY: mapPos.y,
      analyzedAt: new Date().toISOString(),
    });
  }

  return communities;
}

export function isApifyConfigured(): boolean {
  return Boolean(process.env.APIFY_API_KEY);
}
