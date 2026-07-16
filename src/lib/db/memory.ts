/**
 * In-memory store used when Supabase is not configured (demo / local).
 * Mirrors the PostgreSQL schema shape so service code stays identical.
 */

import { randomUUID } from "crypto";
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
import type { EncryptedToken } from "@/types";

export interface StoredOAuthAccount extends OAuthAccount {
  accessToken: EncryptedToken;
  refreshToken?: EncryptedToken;
  expiresAt?: string;
}

interface Store {
  users: Map<string, UserProfile>;
  oauth: Map<string, StoredOAuthAccount>;
  contexts: Map<string, UnifiedContext[]>;
  analyses: Map<string, PriorityAnalysis[]>;
  actions: Map<string, SuggestedAction[]>;
  projects: Map<string, ProjectBundle[]>;
  briefs: Map<string, MeetingBrief[]>;
  releases: Map<string, ReleasePackage[]>;
  replies: Map<string, SuggestedReply[]>;
  mornings: Map<string, MorningDashboard>;
  evenings: Map<string, EveningSummary>;
  automation: Map<string, AutomationEvent[]>;
  timeline: Map<string, TimelineEvent[]>;
  chat: Map<string, ChatMessage[]>;
  embeddings: {
    id: string;
    userId: string;
    sourceProvider: string;
    sourceId: string;
    content: string;
    embedding?: number[];
    metadata: Record<string, unknown>;
    createdAt: string;
  }[];
}

const g = globalThis as typeof globalThis & { __pawStore?: Store };

function createStore(): Store {
  return {
    users: new Map(),
    oauth: new Map(),
    contexts: new Map(),
    analyses: new Map(),
    actions: new Map(),
    projects: new Map(),
    briefs: new Map(),
    releases: new Map(),
    replies: new Map(),
    mornings: new Map(),
    evenings: new Map(),
    automation: new Map(),
    timeline: new Map(),
    chat: new Map(),
    embeddings: [],
  };
}

export function getMemoryStore(): Store {
  if (!g.__pawStore) {
    g.__pawStore = createStore();
    // Seed demo user
    const demoUser: UserProfile = {
      id: "00000000-0000-4000-8000-000000000001",
      email: "demo@workassistant.ai",
      name: "Demo User",
      timezone: "America/Los_Angeles",
      createdAt: new Date().toISOString(),
    };
    g.__pawStore.users.set(demoUser.id, demoUser);
  }
  return g.__pawStore;
}

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

export function newId(): string {
  return randomUUID();
}
