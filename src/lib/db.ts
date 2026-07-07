import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type { Community, CommunityMember, IntentSignal, ScrapeJob } from "@/types";

const dbPath =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "intentmap.db");

let db: Database.Database | null = null;

function ensureDb(): Database.Database {
  if (db) return db;

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS communities (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      member_count INTEGER NOT NULL DEFAULT 0,
      online_count INTEGER,
      category TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      region TEXT,
      language TEXT,
      invite_url TEXT,
      website_url TEXT,
      source_url TEXT NOT NULL,
      intent_score REAL NOT NULL DEFAULT 0,
      intent_tier TEXT NOT NULL DEFAULT 'cold',
      intent_signals TEXT NOT NULL DEFAULT '[]',
      map_x REAL NOT NULL DEFAULT 0,
      map_y REAL NOT NULL DEFAULT 0,
      scraped_at TEXT NOT NULL,
      analyzed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_communities_platform ON communities(platform);
    CREATE INDEX IF NOT EXISTS idx_communities_intent ON communities(intent_score DESC);
    CREATE INDEX IF NOT EXISTS idx_communities_tier ON communities(intent_tier);

    CREATE TABLE IF NOT EXISTS scrape_jobs (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      keyword TEXT,
      communities_found INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS community_members (
      id TEXT PRIMARY KEY,
      community_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      platform_user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      status TEXT,
      activity TEXT,
      role TEXT,
      source TEXT NOT NULL,
      apollo_data TEXT,
      enriched_at TEXT,
      fetched_at TEXT NOT NULL,
      FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_members_community ON community_members(community_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_members_platform_user ON community_members(community_id, platform_user_id);
  `);

  // Migrate existing databases
  const cols = db
    .prepare("PRAGMA table_info(communities)")
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "website_url")) {
    db.exec("ALTER TABLE communities ADD COLUMN website_url TEXT");
  }

  return db;
}

function rowToCommunity(row: Record<string, unknown>): Community {
  return {
    id: row.id as string,
    platform: row.platform as Community["platform"],
    name: row.name as string,
    description: row.description as string,
    memberCount: row.member_count as number,
    onlineCount: row.online_count as number | undefined,
    category: row.category as string | undefined,
    tags: JSON.parse((row.tags as string) || "[]"),
    region: row.region as string | undefined,
    language: row.language as string | undefined,
    inviteUrl: row.invite_url as string | undefined,
    websiteUrl: row.website_url as string | undefined,
    sourceUrl: row.source_url as string,
    intentScore: row.intent_score as number,
    intentTier: row.intent_tier as Community["intentTier"],
    intentSignals: JSON.parse((row.intent_signals as string) || "[]"),
    mapX: row.map_x as number,
    mapY: row.map_y as number,
    scrapedAt: row.scraped_at as string,
    analyzedAt: row.analyzed_at as string | undefined,
  };
}

function communityToParams(community: Community) {
  return {
    id: community.id,
    platform: community.platform,
    name: community.name,
    description: community.description,
    memberCount: community.memberCount,
    onlineCount: community.onlineCount ?? null,
    category: community.category ?? null,
    tags: JSON.stringify(community.tags),
    region: community.region ?? null,
    language: community.language ?? null,
    inviteUrl: community.inviteUrl ?? null,
    websiteUrl: community.websiteUrl ?? null,
    sourceUrl: community.sourceUrl,
    intentScore: community.intentScore,
    intentTier: community.intentTier,
    intentSignals: JSON.stringify(community.intentSignals),
    mapX: community.mapX,
    mapY: community.mapY,
    scrapedAt: community.scrapedAt,
    analyzedAt: community.analyzedAt ?? null,
  };
}

export function upsertCommunity(community: Community): void {
  const database = ensureDb();
  database
    .prepare(
      `INSERT INTO communities (
        id, platform, name, description, member_count, online_count,
        category, tags, region, language, invite_url, website_url, source_url,
        intent_score, intent_tier, intent_signals, map_x, map_y,
        scraped_at, analyzed_at
      ) VALUES (
        @id, @platform, @name, @description, @memberCount, @onlineCount,
        @category, @tags, @region, @language, @inviteUrl, @websiteUrl, @sourceUrl,
        @intentScore, @intentTier, @intentSignals, @mapX, @mapY,
        @scrapedAt, @analyzedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        member_count = excluded.member_count,
        online_count = excluded.online_count,
        category = excluded.category,
        tags = excluded.tags,
        region = excluded.region,
        language = excluded.language,
        invite_url = excluded.invite_url,
        website_url = excluded.website_url,
        source_url = excluded.source_url,
        intent_score = excluded.intent_score,
        intent_tier = excluded.intent_tier,
        intent_signals = excluded.intent_signals,
        map_x = excluded.map_x,
        map_y = excluded.map_y,
        scraped_at = excluded.scraped_at,
        analyzed_at = excluded.analyzed_at`
    )
    .run(communityToParams(community));
}

export function upsertCommunities(communities: Community[]): number {
  const database = ensureDb();
  const stmt = database.prepare(
    `INSERT INTO communities (
      id, platform, name, description, member_count, online_count,
      category, tags, region, language, invite_url, website_url, source_url,
      intent_score, intent_tier, intent_signals, map_x, map_y,
      scraped_at, analyzed_at
    ) VALUES (
      @id, @platform, @name, @description, @memberCount, @onlineCount,
      @category, @tags, @region, @language, @inviteUrl, @websiteUrl, @sourceUrl,
      @intentScore, @intentTier, @intentSignals, @mapX, @mapY,
      @scrapedAt, @analyzedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      member_count = excluded.member_count,
      online_count = excluded.online_count,
      category = excluded.category,
      tags = excluded.tags,
      region = excluded.region,
      language = excluded.language,
      invite_url = excluded.invite_url,
      website_url = excluded.website_url,
      source_url = excluded.source_url,
      intent_score = excluded.intent_score,
      intent_tier = excluded.intent_tier,
      intent_signals = excluded.intent_signals,
      map_x = excluded.map_x,
      map_y = excluded.map_y,
      scraped_at = excluded.scraped_at,
      analyzed_at = excluded.analyzed_at`
  );

  const tx = database.transaction((items: Community[]) => {
    for (const c of items) {
      stmt.run(communityToParams(c));
    }
  });
  tx(communities);
  return communities.length;
}

export function getCommunities(filters?: {
  platform?: string;
  minIntent?: number;
  tier?: string;
  search?: string;
  category?: string;
  limit?: number;
}): Community[] {
  const database = ensureDb();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters?.platform && filters.platform !== "all") {
    conditions.push("platform = @platform");
    params.platform = filters.platform;
  }
  if (filters?.minIntent !== undefined) {
    conditions.push("intent_score >= @minIntent");
    params.minIntent = filters.minIntent;
  }
  if (filters?.tier && filters.tier !== "all") {
    conditions.push("intent_tier = @tier");
    params.tier = filters.tier;
  }
  if (filters?.search) {
    conditions.push(
      "(name LIKE @search OR description LIKE @search OR category LIKE @search)"
    );
    params.search = `%${filters.search}%`;
  }
  if (filters?.category) {
    conditions.push("category LIKE @category");
    params.category = `%${filters.category}%`;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters?.limit ?? 500;

  const rows = database
    .prepare(
      `SELECT * FROM communities ${where} ORDER BY intent_score DESC LIMIT @limit`
    )
    .all({ ...params, limit }) as Record<string, unknown>[];

  return rows.map(rowToCommunity);
}

export function getCommunityById(id: string): Community | null {
  const database = ensureDb();
  const row = database
    .prepare("SELECT * FROM communities WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToCommunity(row) : null;
}

export function getMapStats(): {
  total: number;
  hot: number;
  warm: number;
  cool: number;
  cold: number;
  discord: number;
  slack: number;
  avgIntent: number;
} {
  const database = ensureDb();
  const row = database
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN intent_tier = 'hot' THEN 1 ELSE 0 END) as hot,
        SUM(CASE WHEN intent_tier = 'warm' THEN 1 ELSE 0 END) as warm,
        SUM(CASE WHEN intent_tier = 'cool' THEN 1 ELSE 0 END) as cool,
        SUM(CASE WHEN intent_tier = 'cold' THEN 1 ELSE 0 END) as cold,
        SUM(CASE WHEN platform = 'discord' THEN 1 ELSE 0 END) as discord,
        SUM(CASE WHEN platform = 'slack' THEN 1 ELSE 0 END) as slack,
        AVG(intent_score) as avgIntent
      FROM communities`
    )
    .get() as Record<string, number>;

  return {
    total: row.total ?? 0,
    hot: row.hot ?? 0,
    warm: row.warm ?? 0,
    cool: row.cool ?? 0,
    cold: row.cold ?? 0,
    discord: row.discord ?? 0,
    slack: row.slack ?? 0,
    avgIntent: Math.round((row.avgIntent ?? 0) * 10) / 10,
  };
}

export function createScrapeJob(job: ScrapeJob): void {
  const database = ensureDb();
  database
    .prepare(
      `INSERT INTO scrape_jobs (id, source, status, keyword, communities_found, error, started_at, completed_at)
       VALUES (@id, @source, @status, @keyword, @communitiesFound, @error, @startedAt, @completedAt)`
    )
    .run({
      id: job.id,
      source: job.source,
      status: job.status,
      keyword: job.keyword ?? null,
      communitiesFound: job.communitiesFound,
      error: job.error ?? null,
      startedAt: job.startedAt,
      completedAt: job.completedAt ?? null,
    });
}

export function updateScrapeJob(
  id: string,
  updates: Partial<Pick<ScrapeJob, "status" | "communitiesFound" | "error" | "completedAt">>
): void {
  const database = ensureDb();
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };

  if (updates.status) {
    fields.push("status = @status");
    params.status = updates.status;
  }
  if (updates.communitiesFound !== undefined) {
    fields.push("communities_found = @communitiesFound");
    params.communitiesFound = updates.communitiesFound;
  }
  if (updates.error !== undefined) {
    fields.push("error = @error");
    params.error = updates.error;
  }
  if (updates.completedAt) {
    fields.push("completed_at = @completedAt");
    params.completedAt = updates.completedAt;
  }

  if (fields.length === 0) return;

  database
    .prepare(`UPDATE scrape_jobs SET ${fields.join(", ")} WHERE id = @id`)
    .run(params);
}

export function getRecentScrapeJobs(limit = 10): ScrapeJob[] {
  const database = ensureDb();
  const rows = database
    .prepare(
      "SELECT * FROM scrape_jobs ORDER BY started_at DESC LIMIT ?"
    )
    .all(limit) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: row.id as string,
    source: row.source as ScrapeJob["source"],
    status: row.status as ScrapeJob["status"],
    keyword: row.keyword as string | undefined,
    communitiesFound: row.communities_found as number,
    error: row.error as string | undefined,
    startedAt: row.started_at as string,
    completedAt: row.completed_at as string | undefined,
  }));
}

export function clearCommunities(): void {
  const database = ensureDb();
  database.prepare("DELETE FROM communities").run();
}

export function communityCount(): number {
  const database = ensureDb();
  const row = database
    .prepare("SELECT COUNT(*) as count FROM communities")
    .get() as { count: number };
  return row.count;
}

export function generateCommunityId(
  platform: string,
  sourceUrl: string
): string {
  const slug = sourceUrl
    .replace(/https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .slice(0, 80);
  return `${platform}-${slug}`;
}

function rowToMember(row: Record<string, unknown>): CommunityMember {
  return {
    id: row.id as string,
    communityId: row.community_id as string,
    platform: row.platform as CommunityMember["platform"],
    platformUserId: row.platform_user_id as string,
    username: row.username as string,
    displayName: row.display_name as string | undefined,
    avatarUrl: row.avatar_url as string | undefined,
    status: row.status as string | undefined,
    activity: row.activity as string | undefined,
    role: row.role as string | undefined,
    source: row.source as CommunityMember["source"],
    apolloData: row.apollo_data
      ? JSON.parse(row.apollo_data as string)
      : undefined,
    enrichedAt: row.enriched_at as string | undefined,
    fetchedAt: row.fetched_at as string,
  };
}

function memberToParams(member: CommunityMember) {
  return {
    id: member.id,
    communityId: member.communityId,
    platform: member.platform,
    platformUserId: member.platformUserId,
    username: member.username,
    displayName: member.displayName ?? null,
    avatarUrl: member.avatarUrl ?? null,
    status: member.status ?? null,
    activity: member.activity ?? null,
    role: member.role ?? null,
    source: member.source,
    apolloData: member.apolloData ? JSON.stringify(member.apolloData) : null,
    enrichedAt: member.enrichedAt ?? null,
    fetchedAt: member.fetchedAt,
  };
}

export function upsertMembers(members: CommunityMember[]): number {
  const database = ensureDb();
  const stmt = database.prepare(
    `INSERT INTO community_members (
      id, community_id, platform, platform_user_id, username, display_name,
      avatar_url, status, activity, role, source, apollo_data, enriched_at, fetched_at
    ) VALUES (
      @id, @communityId, @platform, @platformUserId, @username, @displayName,
      @avatarUrl, @status, @activity, @role, @source, @apolloData, @enrichedAt, @fetchedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      username = excluded.username,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      status = excluded.status,
      activity = excluded.activity,
      role = excluded.role,
      source = excluded.source,
      fetched_at = excluded.fetched_at`
  );

  const tx = database.transaction((items: CommunityMember[]) => {
    for (const m of items) {
      stmt.run(memberToParams(m));
    }
  });
  tx(members);
  return members.length;
}

export function updateMemberEnrichment(
  memberId: string,
  apolloData: CommunityMember["apolloData"]
): void {
  const database = ensureDb();
  database
    .prepare(
      `UPDATE community_members
       SET apollo_data = @apolloData, enriched_at = @enrichedAt
       WHERE id = @id`
    )
    .run({
      id: memberId,
      apolloData: apolloData ? JSON.stringify(apolloData) : null,
      enrichedAt: new Date().toISOString(),
    });
}

export function getMembersByCommunity(
  communityId: string,
  limit = 500
): CommunityMember[] {
  const database = ensureDb();
  const rows = database
    .prepare(
      `SELECT * FROM community_members
       WHERE community_id = ?
       ORDER BY CASE WHEN enriched_at IS NULL THEN 1 ELSE 0 END, enriched_at DESC, display_name ASC
       LIMIT ?`
    )
    .all(communityId, limit) as Record<string, unknown>[];

  return rows.map(rowToMember);
}

export function getMemberById(id: string): CommunityMember | null {
  const database = ensureDb();
  const row = database
    .prepare("SELECT * FROM community_members WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToMember(row) : null;
}

export function getUnenrichedMembers(
  communityId: string,
  limit = 30
): CommunityMember[] {
  const database = ensureDb();
  const rows = database
    .prepare(
      `SELECT * FROM community_members
       WHERE community_id = ? AND apollo_data IS NULL
       ORDER BY fetched_at DESC
       LIMIT ?`
    )
    .all(communityId, limit) as Record<string, unknown>[];

  return rows.map(rowToMember);
}

export function memberCountByCommunity(communityId: string): number {
  const database = ensureDb();
  const row = database
    .prepare(
      "SELECT COUNT(*) as count FROM community_members WHERE community_id = ?"
    )
    .get(communityId) as { count: number };
  return row.count;
}

export type { IntentSignal };
