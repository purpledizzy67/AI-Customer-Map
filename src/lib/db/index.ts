/**
 * Database access layer.
 * Uses Supabase when configured; falls back to in-memory store for demo mode.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config, isDemoMode } from "@/lib/config";
import {
  DEMO_USER_ID,
  getMemoryStore,
  newId,
  type StoredOAuthAccount,
} from "@/lib/db/memory";
import type {
  AutomationEvent,
  ChatMessage,
  EveningSummary,
  MeetingBrief,
  MorningDashboard,
  OAuthAccount,
  PriorityAnalysis,
  ProjectBundle,
  ReleasePackage,
  SuggestedAction,
  SuggestedReply,
  TimelineEvent,
  UnifiedContext,
  UserProfile,
} from "@/types";

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (isDemoMode() || !config.supabase.url || !config.supabase.serviceRoleKey) {
    return null;
  }
  if (!supabase) {
    supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return supabase;
}

export async function getDefaultUserId(): Promise<string> {
  return DEMO_USER_ID;
}

export async function getUser(userId: string): Promise<UserProfile | null> {
  const sb = getSupabase();
  if (!sb) {
    return getMemoryStore().users.get(userId) ?? null;
  }
  const { data, error } = await sb.from("users").select("*").eq("id", userId).single();
  if (error || !data) return null;
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    timezone: data.timezone,
    createdAt: data.created_at,
  };
}

export async function listOAuthAccounts(userId: string): Promise<OAuthAccount[]> {
  const sb = getSupabase();
  if (!sb) {
    return [...getMemoryStore().oauth.values()]
      .filter((a) => a.userId === userId)
      .map(stripTokens);
  }
  const { data } = await sb.from("oauth_accounts").select("*").eq("user_id", userId);
  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    accountEmail: row.account_email ?? undefined,
    accountName: row.account_name ?? undefined,
    status: row.status,
    scopes: row.scopes ?? [],
    connectedAt: row.connected_at,
    updatedAt: row.updated_at,
    lastSyncAt: row.last_sync_at ?? undefined,
  }));
}

function stripTokens(account: StoredOAuthAccount): OAuthAccount {
  const { accessToken: _a, refreshToken: _r, expiresAt: _e, ...rest } = account;
  return rest;
}

export async function getStoredOAuthAccount(
  userId: string,
  provider: string,
): Promise<StoredOAuthAccount | null> {
  const sb = getSupabase();
  if (!sb) {
    return (
      [...getMemoryStore().oauth.values()].find(
        (a) => a.userId === userId && a.provider === provider,
      ) ?? null
    );
  }
  const { data } = await sb
    .from("oauth_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    userId: data.user_id,
    provider: data.provider,
    accountEmail: data.account_email ?? undefined,
    accountName: data.account_name ?? undefined,
    status: data.status,
    scopes: data.scopes ?? [],
    connectedAt: data.connected_at,
    updatedAt: data.updated_at,
    lastSyncAt: data.last_sync_at ?? undefined,
    expiresAt: data.expires_at ?? undefined,
    accessToken: {
      ciphertext: data.access_token_enc,
      iv: data.access_token_iv,
      tag: data.access_token_tag,
    },
    refreshToken:
      data.refresh_token_enc && data.refresh_token_iv && data.refresh_token_tag
        ? {
            ciphertext: data.refresh_token_enc,
            iv: data.refresh_token_iv,
            tag: data.refresh_token_tag,
          }
        : undefined,
  };
}

export async function upsertOAuthAccount(
  account: StoredOAuthAccount,
): Promise<StoredOAuthAccount> {
  const sb = getSupabase();
  if (!sb) {
    getMemoryStore().oauth.set(account.id, account);
    return account;
  }
  await sb.from("oauth_accounts").upsert({
    id: account.id,
    user_id: account.userId,
    provider: account.provider,
    account_email: account.accountEmail,
    account_name: account.accountName,
    status: account.status,
    scopes: account.scopes,
    access_token_enc: account.accessToken.ciphertext,
    access_token_iv: account.accessToken.iv,
    access_token_tag: account.accessToken.tag,
    refresh_token_enc: account.refreshToken?.ciphertext,
    refresh_token_iv: account.refreshToken?.iv,
    refresh_token_tag: account.refreshToken?.tag,
    expires_at: account.expiresAt,
    connected_at: account.connectedAt,
    updated_at: account.updatedAt,
    last_sync_at: account.lastSyncAt,
  });
  return account;
}

export async function deleteOAuthAccount(
  userId: string,
  provider: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const store = getMemoryStore();
    for (const [id, account] of store.oauth) {
      if (account.userId === userId && account.provider === provider) {
        store.oauth.delete(id);
      }
    }
    return;
  }
  await sb
    .from("oauth_accounts")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);
}

export async function saveContextSnapshot(
  userId: string,
  context: UnifiedContext,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const store = getMemoryStore();
    const list = store.contexts.get(userId) ?? [];
    list.unshift(context);
    store.contexts.set(userId, list.slice(0, 50));
    return;
  }
  await sb.from("context_snapshots").insert({
    user_id: userId,
    payload: context,
    collected_at: context.timestamp,
  });
}

export async function getLatestContext(
  userId: string,
): Promise<UnifiedContext | null> {
  const sb = getSupabase();
  if (!sb) {
    return getMemoryStore().contexts.get(userId)?.[0] ?? null;
  }
  const { data } = await sb
    .from("context_snapshots")
    .select("payload")
    .eq("user_id", userId)
    .order("collected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.payload as UnifiedContext) ?? null;
}

export async function saveAnalysis(
  userId: string,
  analysis: PriorityAnalysis,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const store = getMemoryStore();
    const list = store.analyses.get(userId) ?? [];
    list.unshift(analysis);
    store.analyses.set(userId, list.slice(0, 30));
    store.actions.set(userId, analysis.actions);
    return;
  }
  await sb.from("priority_analyses").insert({
    user_id: userId,
    analysis,
    confidence: analysis.confidence,
  });
  for (const action of analysis.actions) {
    await sb.from("suggested_actions").insert({
      id: action.id,
      user_id: userId,
      action,
      status: action.status,
    });
  }
}

export async function getLatestAnalysis(
  userId: string,
): Promise<PriorityAnalysis | null> {
  const sb = getSupabase();
  if (!sb) {
    return getMemoryStore().analyses.get(userId)?.[0] ?? null;
  }
  const { data } = await sb
    .from("priority_analyses")
    .select("analysis")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.analysis as PriorityAnalysis) ?? null;
}

export async function listActions(
  userId: string,
  status?: string,
): Promise<SuggestedAction[]> {
  const sb = getSupabase();
  if (!sb) {
    const actions = getMemoryStore().actions.get(userId) ?? [];
    return status ? actions.filter((a) => a.status === status) : actions;
  }
  let query = sb.from("suggested_actions").select("action").eq("user_id", userId);
  if (status) query = query.eq("status", status);
  const { data } = await query.order("created_at", { ascending: false });
  return (data ?? []).map((row) => row.action as SuggestedAction);
}

export async function updateActionStatus(
  userId: string,
  actionId: string,
  status: SuggestedAction["status"],
): Promise<SuggestedAction | null> {
  const sb = getSupabase();
  if (!sb) {
    const actions = getMemoryStore().actions.get(userId) ?? [];
    const action = actions.find((a) => a.id === actionId);
    if (!action) return null;
    action.status = status;
    return action;
  }
  const { data } = await sb
    .from("suggested_actions")
    .select("action")
    .eq("user_id", userId)
    .eq("id", actionId)
    .maybeSingle();
  if (!data) return null;
  const action = { ...(data.action as SuggestedAction), status };
  await sb
    .from("suggested_actions")
    .update({ action, status, updated_at: new Date().toISOString() })
    .eq("id", actionId);
  return action;
}

export async function saveProject(
  userId: string,
  bundle: ProjectBundle,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const store = getMemoryStore();
    const list = store.projects.get(userId) ?? [];
    const idx = list.findIndex((p) => p.slug === bundle.slug);
    if (idx >= 0) list[idx] = bundle;
    else list.unshift(bundle);
    store.projects.set(userId, list);
    return;
  }
  await sb.from("projects").upsert({
    user_id: userId,
    name: bundle.projectName,
    slug: bundle.slug,
    bundle,
  });
}

export async function listProjects(userId: string): Promise<ProjectBundle[]> {
  const sb = getSupabase();
  if (!sb) {
    return getMemoryStore().projects.get(userId) ?? [];
  }
  const { data } = await sb
    .from("projects")
    .select("bundle")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => row.bundle as ProjectBundle);
}

export async function saveMeetingBrief(
  userId: string,
  brief: MeetingBrief,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const store = getMemoryStore();
    const list = store.briefs.get(userId) ?? [];
    const idx = list.findIndex((b) => b.meetingId === brief.meetingId);
    if (idx >= 0) list[idx] = brief;
    else list.unshift(brief);
    store.briefs.set(userId, list);
    return;
  }
  await sb.from("meeting_briefs").upsert({
    user_id: userId,
    meeting_id: brief.meetingId,
    brief,
  });
}

export async function listMeetingBriefs(userId: string): Promise<MeetingBrief[]> {
  const sb = getSupabase();
  if (!sb) return getMemoryStore().briefs.get(userId) ?? [];
  const { data } = await sb
    .from("meeting_briefs")
    .select("brief")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => row.brief as MeetingBrief);
}

export async function saveReleasePackage(
  userId: string,
  pkg: ReleasePackage,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const list = getMemoryStore().releases.get(userId) ?? [];
    list.unshift(pkg);
    getMemoryStore().releases.set(userId, list);
    return;
  }
  await sb.from("release_packages").insert({
    user_id: userId,
    package: pkg,
    status: pkg.status,
  });
}

export async function listReleasePackages(userId: string): Promise<ReleasePackage[]> {
  const sb = getSupabase();
  if (!sb) return getMemoryStore().releases.get(userId) ?? [];
  const { data } = await sb
    .from("release_packages")
    .select("package")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => row.package as ReleasePackage);
}

export async function saveSuggestedReply(
  userId: string,
  reply: SuggestedReply,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const list = getMemoryStore().replies.get(userId) ?? [];
    list.unshift(reply);
    getMemoryStore().replies.set(userId, list);
    return;
  }
  await sb.from("suggested_replies").insert({
    id: reply.id,
    user_id: userId,
    reply,
    status: reply.status,
  });
}

export async function listSuggestedReplies(
  userId: string,
): Promise<SuggestedReply[]> {
  const sb = getSupabase();
  if (!sb) return getMemoryStore().replies.get(userId) ?? [];
  const { data } = await sb
    .from("suggested_replies")
    .select("reply")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => row.reply as SuggestedReply);
}

export async function saveMorningDashboard(
  userId: string,
  dashboard: MorningDashboard,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    getMemoryStore().mornings.set(`${userId}:${dashboard.date}`, dashboard);
    return;
  }
  await sb.from("daily_dashboards").upsert({
    user_id: userId,
    date: dashboard.date,
    kind: "morning",
    payload: dashboard,
  });
}

export async function getMorningDashboard(
  userId: string,
  date: string,
): Promise<MorningDashboard | null> {
  const sb = getSupabase();
  if (!sb) {
    return getMemoryStore().mornings.get(`${userId}:${date}`) ?? null;
  }
  const { data } = await sb
    .from("daily_dashboards")
    .select("payload")
    .eq("user_id", userId)
    .eq("date", date)
    .eq("kind", "morning")
    .maybeSingle();
  return (data?.payload as MorningDashboard) ?? null;
}

export async function saveEveningSummary(
  userId: string,
  summary: EveningSummary,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    getMemoryStore().evenings.set(`${userId}:${summary.date}`, summary);
    return;
  }
  await sb.from("daily_dashboards").upsert({
    user_id: userId,
    date: summary.date,
    kind: "evening",
    payload: summary,
  });
}

export async function getEveningSummary(
  userId: string,
  date: string,
): Promise<EveningSummary | null> {
  const sb = getSupabase();
  if (!sb) {
    return getMemoryStore().evenings.get(`${userId}:${date}`) ?? null;
  }
  const { data } = await sb
    .from("daily_dashboards")
    .select("payload")
    .eq("user_id", userId)
    .eq("date", date)
    .eq("kind", "evening")
    .maybeSingle();
  return (data?.payload as EveningSummary) ?? null;
}

export async function logAutomation(
  userId: string,
  event: Omit<AutomationEvent, "id" | "userId" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): Promise<AutomationEvent> {
  const full: AutomationEvent = {
    id: event.id ?? newId(),
    userId,
    type: event.type,
    title: event.title,
    detail: event.detail,
    status: event.status,
    evidence: event.evidence,
    metadata: event.metadata,
    createdAt: event.createdAt ?? new Date().toISOString(),
  };
  const sb = getSupabase();
  if (!sb) {
    const list = getMemoryStore().automation.get(userId) ?? [];
    list.unshift(full);
    getMemoryStore().automation.set(userId, list.slice(0, 200));
    return full;
  }
  await sb.from("automation_events").insert({
    id: full.id,
    user_id: userId,
    type: full.type,
    title: full.title,
    detail: full.detail,
    status: full.status,
    evidence: full.evidence,
    metadata: full.metadata,
    created_at: full.createdAt,
  });
  return full;
}

export async function listAutomation(
  userId: string,
  limit = 50,
): Promise<AutomationEvent[]> {
  const sb = getSupabase();
  if (!sb) {
    return (getMemoryStore().automation.get(userId) ?? []).slice(0, limit);
  }
  const { data } = await sb
    .from("automation_events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    detail: row.detail,
    status: row.status,
    evidence: row.evidence,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}

export async function addTimelineEvent(
  userId: string,
  event: Omit<TimelineEvent, "id" | "userId"> & { id?: string },
): Promise<TimelineEvent> {
  const full: TimelineEvent = {
    id: event.id ?? newId(),
    userId,
    provider: event.provider,
    title: event.title,
    description: event.description,
    timestamp: event.timestamp,
    url: event.url,
    confidence: event.confidence,
  };
  const sb = getSupabase();
  if (!sb) {
    const list = getMemoryStore().timeline.get(userId) ?? [];
    list.unshift(full);
    getMemoryStore().timeline.set(userId, list.slice(0, 500));
    return full;
  }
  await sb.from("timeline_events").insert({
    id: full.id,
    user_id: userId,
    provider: full.provider,
    title: full.title,
    description: full.description,
    url: full.url,
    confidence: full.confidence,
    event_at: full.timestamp,
  });
  return full;
}

export async function listTimeline(
  userId: string,
  limit = 100,
): Promise<TimelineEvent[]> {
  const sb = getSupabase();
  if (!sb) {
    return (getMemoryStore().timeline.get(userId) ?? []).slice(0, limit);
  }
  const { data } = await sb
    .from("timeline_events")
    .select("*")
    .eq("user_id", userId)
    .order("event_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    title: row.title,
    description: row.description,
    timestamp: row.event_at,
    url: row.url,
    confidence: row.confidence,
  }));
}

export async function saveChatMessage(
  userId: string,
  message: ChatMessage,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const list = getMemoryStore().chat.get(userId) ?? [];
    list.push(message);
    getMemoryStore().chat.set(userId, list);
    return;
  }
  await sb.from("chat_messages").insert({
    id: message.id,
    user_id: userId,
    role: message.role,
    content: message.content,
    evidence: message.evidence,
    confidence: message.confidence,
    created_at: message.createdAt,
  });
}

export async function listChatMessages(userId: string): Promise<ChatMessage[]> {
  const sb = getSupabase();
  if (!sb) return getMemoryStore().chat.get(userId) ?? [];
  const { data } = await sb
    .from("chat_messages")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(100);
  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    evidence: row.evidence,
    confidence: row.confidence,
    createdAt: row.created_at,
  }));
}

export async function saveEmbedding(input: {
  userId: string;
  sourceProvider: string;
  sourceId: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    getMemoryStore().embeddings.push({
      id: newId(),
      userId: input.userId,
      sourceProvider: input.sourceProvider,
      sourceId: input.sourceId,
      content: input.content,
      embedding: input.embedding,
      metadata: input.metadata ?? {},
      createdAt: new Date().toISOString(),
    });
    return;
  }
  await sb.from("embeddings").insert({
    user_id: input.userId,
    source_provider: input.sourceProvider,
    source_id: input.sourceId,
    content: input.content,
    embedding: input.embedding,
    metadata: input.metadata ?? {},
  });
}

export async function searchEmbeddings(
  userId: string,
  query: string,
  limit = 10,
): Promise<
  {
    id: string;
    sourceProvider: string;
    sourceId: string;
    content: string;
    score: number;
    metadata: Record<string, unknown>;
  }[]
> {
  const sb = getSupabase();
  const q = query.toLowerCase();
  if (!sb) {
    return getMemoryStore()
      .embeddings.filter((e) => e.userId === userId)
      .map((e) => {
        const hay = e.content.toLowerCase();
        const score = hay.includes(q)
          ? 0.9
          : q.split(/\s+/).filter((t) => hay.includes(t)).length /
            Math.max(q.split(/\s+/).length, 1);
        return { ...e, score };
      })
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((e) => ({
        id: e.id,
        sourceProvider: e.sourceProvider,
        sourceId: e.sourceId,
        content: e.content,
        score: e.score,
        metadata: e.metadata,
      }));
  }
  // Fallback lexical search when vector query isn't wired
  const { data } = await sb
    .from("embeddings")
    .select("*")
    .eq("user_id", userId)
    .ilike("content", `%${query}%`)
    .limit(limit);
  return (data ?? []).map((row) => ({
    id: row.id,
    sourceProvider: row.source_provider,
    sourceId: row.source_id,
    content: row.content,
    score: 0.75,
    metadata: row.metadata ?? {},
  }));
}

export { newId, DEMO_USER_ID };
export type { StoredOAuthAccount } from "@/lib/db/memory";
