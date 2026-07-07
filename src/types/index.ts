export type Platform = "discord" | "slack";

export type IntentTier = "hot" | "warm" | "cool" | "cold";

export interface IntentSignal {
  keyword: string;
  weight: number;
  category: string;
}

export interface Community {
  id: string;
  platform: Platform;
  name: string;
  description: string;
  memberCount: number;
  onlineCount?: number;
  category?: string;
  tags: string[];
  region?: string;
  language?: string;
  inviteUrl?: string;
  sourceUrl: string;
  intentScore: number;
  intentTier: IntentTier;
  intentSignals: IntentSignal[];
  mapX: number;
  mapY: number;
  scrapedAt: string;
  analyzedAt?: string;
}

export interface ScrapeJob {
  id: string;
  source: "disboard" | "slofile" | "apify";
  status: "pending" | "running" | "completed" | "failed";
  keyword?: string;
  communitiesFound: number;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface CommunityFilters {
  platform?: Platform | "all";
  minIntent?: number;
  tier?: IntentTier | "all";
  search?: string;
  category?: string;
}

export interface ScrapeRequest {
  sources: Array<"disboard" | "slofile" | "apify">;
  keywords?: string[];
  maxPerSource?: number;
}

export interface MapStats {
  total: number;
  hot: number;
  warm: number;
  cool: number;
  cold: number;
  discord: number;
  slack: number;
  avgIntent: number;
}
