import type { Community } from "@/types";
import { generateCommunityId } from "@/lib/db";
import {
  analyzeCommunityIntent,
  computeMapPosition,
} from "@/lib/intent-analyzer";

const APIFY_BASE = "https://api.apify.com/v2";
const DEFAULT_ACTOR = "magicfingers/discord-server-scraper";

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
  memberCount?: number | null;
  members?: number | null;
  onlineCount?: number | null;
  online?: number | null;
  tags?: string[];
  tag?: string;
  category?: string | null;
  inviteUrl?: string;
  invite?: string;
  inviteCode?: string;
  url?: string;
  sourceUrl?: string;
  link?: string;
  id?: string | null;
  source?: string;
  _diagnostic?: boolean;
  error?: string;
}

async function waitForRun(
  token: string,
  runId: string,
  maxWaitMs = 300000
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
    await new Promise((r) => setTimeout(r, 4000));
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
  const items = (await res.json()) as ApifyDatasetItem[];
  return items.filter((item) => !item._diagnostic && item.name);
}

function normalizeApifyItem(
  item: ApifyDatasetItem,
  index: number
): Omit<
  Community,
  "intentScore" | "intentTier" | "intentSignals" | "mapX" | "mapY" | "analyzedAt"
> | null {
  const name = item.name ?? item.serverName ?? item.title;
  if (!name) return null;

  const sourceUrl =
    item.sourceUrl ??
    item.url ??
    item.link ??
    `https://disboard.org/server/${item.id ?? index}`;
  const description = item.description ?? "";
  const memberCount = item.memberCount ?? item.members ?? 0;
  const rawTags = item.tags ?? (item.tag ? [item.tag] : []);
  const tags = [...new Set(rawTags.filter(Boolean))].slice(0, 12);
  const inviteUrl =
    item.inviteUrl ??
    item.invite ??
    (item.inviteCode ? `https://discord.gg/${item.inviteCode}` : undefined);

  return {
    id: generateCommunityId("discord", sourceUrl + name),
    platform: "discord",
    name,
    description,
    memberCount: memberCount ?? 0,
    onlineCount: item.onlineCount ?? item.online ?? undefined,
    category: item.category ?? tags[0],
    tags,
    inviteUrl,
    sourceUrl,
    scrapedAt: new Date().toISOString(),
  };
}

async function runActor(
  token: string,
  actorId: string,
  input: Record<string, unknown>
): Promise<ApifyDatasetItem[]> {
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
    throw new Error(`Apify run failed: ${errText}`);
  }

  const runJson = (await runRes.json()) as ApifyRunResponse;
  const datasetId = await waitForRun(token, runJson.data.id);
  return fetchDataset(token, datasetId);
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
  const maxPerKeyword = options.maxPerKeyword ?? 20;
  const actorId = options.actorId ?? DEFAULT_ACTOR;

  const allItems: ApifyDatasetItem[] = [];

  // Run one Apify job with comma-separated keywords (actor handles pagination)
  const items = await runActor(token, actorId, {
    mode: "disboard",
    searchKeywords: keywords.join(","),
    maxResults: maxPerKeyword * keywords.length,
    maxPages: 3,
    proxyConfiguration: { useApifyProxy: true },
  });
  allItems.push(...items);

  if (allItems.length === 0) {
    console.warn("Apify disboard scrape returned no communities");
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
